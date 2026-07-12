mod generations;
mod profiles;
mod projects;
mod tasks;
#[cfg(test)]
mod tests;

use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::Value;

use crate::models::{
    errors::{AppError, AppResult},
    settings::{AppSettings, SettingKey},
};

const LEGACY_SETTING_KEYS: &[&str] = &["backendCommandPath"];

#[derive(Debug, Clone)]
pub struct Database {
    pub(crate) path: PathBuf,
}

impl Database {
    pub fn new(app_data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(app_data_dir)
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        let path = app_data_dir.join("openloop.sqlite3");
        let database = Self { path };
        database.migrate()?;
        database.prune_legacy_settings()?;
        database.ensure_default_settings()?;
        Ok(database)
    }

    pub(crate) fn connection(&self) -> AppResult<Connection> {
        Connection::open(&self.path).map_err(|error| AppError::db_read_failed(error.to_string()))
    }

    fn migrate(&self) -> AppResult<()> {
        let connection = self.connection()?;
        connection
            .execute_batch(include_str!("../../../migrations/001_init.sql"))
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        // Apply 002+ migrations idempotently: ignore "duplicate column" errors
        for sql in [
            include_str!("../../../migrations/002_add_cancel_requested_at.sql"),
            include_str!("../../../migrations/003_add_favorite.sql"),
            include_str!("../../../migrations/004_add_failed_runs.sql"),
            include_str!("../../../migrations/005_history_indexes.sql"),
            include_str!("../../../migrations/006_add_projects.sql"),
            include_str!("../../../migrations/007_add_profiles.sql"),
        ] {
            if let Err(e) = connection.execute_batch(sql) {
                tracing::warn!("Migration step failed (may be idempotent): {e}");
            }
        }

        Ok(())
    }

    fn ensure_default_settings(&self) -> AppResult<()> {
        let defaults = AppSettings::default();
        let connection = self.connection()?;
        let now = Utc::now().to_rfc3339();

        for (key, value) in defaults.entries()? {
            connection
                .execute(
                    "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                    params![key, value, now],
                )
                .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        }

        Ok(())
    }

    fn prune_legacy_settings(&self) -> AppResult<()> {
        let connection = self.connection()?;
        for key in LEGACY_SETTING_KEYS {
            connection
                .execute("DELETE FROM settings WHERE key = ?1", [key])
                .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        }
        Ok(())
    }

    pub fn get_settings(&self) -> AppResult<AppSettings> {
        self.prune_legacy_settings()?;
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT key, value FROM settings")
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;

        let rows = statement
            .query_map([], |row| {
                let key: String = row.get(0)?;
                let value: String = row.get(1)?;
                Ok((key, value))
            })
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;

        let mut settings = AppSettings::default();
        for row in rows {
            let (key, value) = row.map_err(|error| AppError::db_read_failed(error.to_string()))?;
            let parsed: Value = serde_json::from_str(&value)
                .map_err(|error| AppError::db_read_failed(error.to_string()))?;
            settings.apply_setting(SettingKey::parse(&key)?, parsed)?;
        }

        Ok(settings)
    }

    pub fn set_setting(&self, key: &str, value: Value) -> AppResult<AppSettings> {
        let key = SettingKey::parse(key)?;
        let mut settings = self.get_settings()?;
        settings.apply_setting(key, value.clone())?;

        let serialized = serde_json::to_string(&value)
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        let connection = self.connection()?;
        connection
            .execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![key.as_str(), serialized, Utc::now().to_rfc3339()],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        Ok(settings)
    }
}
