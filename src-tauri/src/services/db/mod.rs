mod generations;
mod profiles;
mod projects;
mod tasks;
#[cfg(test)]
mod tests;

use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::Value;

use crate::models::{
    errors::{AppError, AppResult},
    settings::{AppSettings, SettingKey},
};

const LEGACY_SETTING_KEYS: &[&str] = &["backendCommandPath"];

/// Whether `table` already has a column named `column`, via `PRAGMA table_info`.
/// Used to keep ALTER TABLE ADD COLUMN migrations idempotent (SQLite has no
/// IF NOT EXISTS for column adds). Rejects untrusted identifiers so the
/// interpolated PRAGMA cannot be abused; all call sites pass literals.
fn column_exists(connection: &Connection, table: &str, column: &str) -> AppResult<bool> {
    if table.is_empty()
        || table.chars().next().is_some_and(|c| c.is_ascii_digit())
        || !table.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(AppError::db_read_failed(format!(
            "invalid table identifier: {table}"
        )));
    }
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info(\"{table}\")"))
        .map_err(|error| AppError::db_read_failed(error.to_string()))?;
    let mut names = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| AppError::db_read_failed(error.to_string()))?;
    names.try_fold(false, |found, name| {
        let name = name.map_err(|error| AppError::db_read_failed(error.to_string()))?;
        Ok(found || name == column)
    })
}

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
        let connection = Connection::open(&self.path)
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        // WAL keeps the read-heavy history views from blocking writers; the busy
        // timeout absorbs SQLITE_BUSY across the app's many short-lived
        // connections; foreign_keys enforces the generations.project_id ->
        // projects(id) FK from migration 006 (SQLite leaves enforcement off by
        // default, per-connection).
        connection
            .pragma_update(None, "journal_mode", "WAL")
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(connection)
    }

    fn migrate(&self) -> AppResult<()> {
        let connection = self.connection()?;
        connection
            .execute_batch(include_str!("../../../migrations/001_init.sql"))
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        // Migrations 002-007 must stay idempotent: existing installs already
        // applied them and there is no user_version stamp to gate on. ALTER TABLE
        // ADD COLUMN has no IF NOT EXISTS in SQLite, so those steps are guarded by
        // a column-existence check and real errors propagate with `?`. The
        // remaining steps use only CREATE ... IF NOT EXISTS and are naturally
        // re-runnable.

        // 002: generations task cancel timestamp.
        if !column_exists(
            &connection,
            "active_generation_tasks",
            "cancel_requested_at",
        )? {
            connection
                .execute_batch(include_str!(
                    "../../../migrations/002_add_cancel_requested_at.sql"
                ))
                .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        }

        // 003: favorite flag.
        if !column_exists(&connection, "generations", "is_favorite")? {
            connection
                .execute_batch(include_str!("../../../migrations/003_add_favorite.sql"))
                .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        }

        // 004 + 005: table/index creation guarded by IF NOT EXISTS.
        for sql in [
            include_str!("../../../migrations/004_add_failed_runs.sql"),
            include_str!("../../../migrations/005_history_indexes.sql"),
        ] {
            connection
                .execute_batch(sql)
                .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        }

        // 006: creates the projects table/indexes and adds
        // generations.project_id. The column add is the only non-idempotent
        // statement, so gate the whole batch on its absence — on an already
        // migrated DB the table and indexes exist alongside the column.
        if !column_exists(&connection, "generations", "project_id")? {
            connection
                .execute_batch(include_str!("../../../migrations/006_add_projects.sql"))
                .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        }

        // 007: table/index creation guarded by IF NOT EXISTS.
        connection
            .execute_batch(include_str!("../../../migrations/007_add_profiles.sql"))
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

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
