use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use crate::models::{
    errors::{AppError, AppResult},
    generation::{ActiveGenerationTask, FailedRun, GenerationRecord, GenerationRequest},
    project::Project,
    settings::{AppSettings, SettingKey},
};

const LEGACY_SETTING_KEYS: &[&str] = &["backendCommandPath"];

#[derive(Debug, Clone)]
pub struct Database {
    path: PathBuf,
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

    fn connection(&self) -> AppResult<Connection> {
        Connection::open(&self.path).map_err(|error| AppError::db_read_failed(error.to_string()))
    }

    fn migrate(&self) -> AppResult<()> {
        let connection = self.connection()?;
        connection
            .execute_batch(include_str!("../../migrations/001_init.sql"))
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        // Apply 002+ migrations idempotently: ignore "duplicate column" errors
        for sql in [
            include_str!("../../migrations/002_add_cancel_requested_at.sql"),
            include_str!("../../migrations/003_add_favorite.sql"),
            include_str!("../../migrations/004_add_failed_runs.sql"),
            include_str!("../../migrations/005_history_indexes.sql"),
            include_str!("../../migrations/006_add_projects.sql"),
        ] {
            let _ = connection.execute_batch(sql);
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

    pub fn list_generations(
        &self,
        query: Option<&str>,
        limit: Option<u32>,
    ) -> AppResult<Vec<GenerationRecord>> {
        let connection = self.connection()?;
        let query = query.map(str::trim).filter(|value| !value.is_empty());
        let limit_i64: Option<i64> = limit.map(i64::from);

        const SELECT: &str = "SELECT id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info, is_favorite, project_id FROM generations WHERE status = 'completed' AND COALESCE(output_path, '') <> ''";
        const ORDER: &str = " ORDER BY is_favorite DESC, created_at DESC";

        match (query, limit_i64) {
            (Some(value), Some(limit_i64)) => {
                let like_query = format!("%{value}%");
                let mut statement = connection
                    .prepare(&format!(
                        "{SELECT} AND (COALESCE(prompt, '') LIKE ?1 OR COALESCE(lyrics, '') LIKE ?1){ORDER} LIMIT ?2"
                    ))
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                let mapped = statement
                    .query_map(params![like_query, limit_i64], Self::map_generation_row)
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                mapped
                    .into_iter()
                    .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
                    .collect()
            }
            (Some(value), None) => {
                let like_query = format!("%{value}%");
                let mut statement = connection
                    .prepare(&format!(
                        "{SELECT} AND (COALESCE(prompt, '') LIKE ?1 OR COALESCE(lyrics, '') LIKE ?1){ORDER}"
                    ))
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                let mapped = statement
                    .query_map(params![like_query], Self::map_generation_row)
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                mapped
                    .into_iter()
                    .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
                    .collect()
            }
            (None, Some(limit_i64)) => {
                let mut statement = connection
                    .prepare(&format!("{SELECT}{ORDER} LIMIT ?1"))
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                let mapped = statement
                    .query_map(params![limit_i64], Self::map_generation_row)
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                mapped
                    .into_iter()
                    .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
                    .collect()
            }
            (None, None) => {
                let mut statement = connection
                    .prepare(&format!("{SELECT}{ORDER}"))
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                let mapped = statement
                    .query_map([], Self::map_generation_row)
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                mapped
                    .into_iter()
                    .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
                    .collect()
            }
        }
    }

    pub fn get_generation(&self, id: &str) -> AppResult<Option<GenerationRecord>> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info, is_favorite, project_id FROM generations WHERE id = ?1",
                [id],
                Self::map_generation_row,
            )
            .optional()
            .map_err(|error| AppError::db_read_failed(error.to_string()))
    }

    pub fn insert_generation(&self, record: &GenerationRecord) -> AppResult<GenerationRecord> {
        let connection = self.connection()?;
        connection
            .execute(
                "INSERT INTO generations (id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info, is_favorite, project_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23) ON CONFLICT(id) DO UPDATE SET created_at = excluded.created_at, prompt = excluded.prompt, lyrics = excluded.lyrics, vocal_language = excluded.vocal_language, duration_seconds = excluded.duration_seconds, bpm = excluded.bpm, key_scale = excluded.key_scale, time_signature = excluded.time_signature, model = excluded.model, lm_model = excluded.lm_model, thinking = excluded.thinking, inference_steps = excluded.inference_steps, guidance_scale = excluded.guidance_scale, use_random_seed = excluded.use_random_seed, seed = excluded.seed, audio_format = excluded.audio_format, output_path = excluded.output_path, status = excluded.status, error_message = excluded.error_message, generation_info = excluded.generation_info, is_favorite = excluded.is_favorite, project_id = excluded.project_id",
                params![
                    record.id,
                    record.created_at,
                    record.prompt,
                    record.lyrics,
                    record.vocal_language,
                    record.duration_seconds,
                    record.bpm,
                    record.key_scale,
                    record.time_signature,
                    record.model,
                    record.lm_model,
                    record.thinking,
                    record.inference_steps,
                    record.guidance_scale,
                    record.use_random_seed,
                    record.seed.map(|seed| seed.to_string()),
                    record.audio_format,
                    record.output_path.clone().unwrap_or_default(),
                    record.status,
                    record.error_message,
                    record.generation_info,
                    record.is_favorite,
                    record.project_id,
                ],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        Ok(record.clone())
    }

    pub fn set_generation_favorite(&self, id: &str, is_favorite: bool) -> AppResult<()> {
        let connection = self.connection()?;
        let updated = connection
            .execute(
                "UPDATE generations SET is_favorite = ?1 WHERE id = ?2",
                params![is_favorite, id],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        if updated == 0 {
            return Err(AppError::not_found(
                "Generation record",
                format!("No generation record exists for id {id}"),
            ));
        }
        Ok(())
    }

    pub fn delete_generation(&self, id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        let deleted = connection
            .execute("DELETE FROM generations WHERE id = ?1", [id])
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        if deleted == 0 {
            return Err(AppError::not_found(
                "Generation record",
                format!("No generation record exists for id {id}"),
            ));
        }

        Ok(())
    }

    pub fn clear_generations(&self) -> AppResult<()> {
        let connection = self.connection()?;
        connection
            .execute("DELETE FROM generations", [])
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(())
    }

    // -----------------------------------------------------------------
    // Projects
    // -----------------------------------------------------------------

    pub fn list_projects(&self) -> AppResult<Vec<Project>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC")
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        let mapped = statement
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        mapped
            .into_iter()
            .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
            .collect()
    }

    pub fn create_project(&self, name: &str) -> AppResult<Project> {
        let connection = self.connection()?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        connection
            .execute(
                "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                params![id, name, now, now],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(Project {
            id,
            name: name.to_string(),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn rename_project(&self, id: &str, name: &str) -> AppResult<Project> {
        let connection = self.connection()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection
            .execute(
                "UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        if updated == 0 {
            return Err(AppError::not_found(
                "Project",
                format!("No project exists for id {id}"),
            ));
        }
        Ok(Project {
            id: id.to_string(),
            name: name.to_string(),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn delete_project(&self, id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        let deleted = connection
            .execute("DELETE FROM projects WHERE id = ?1", [id])
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        if deleted == 0 {
            return Err(AppError::not_found(
                "Project",
                format!("No project exists for id {id}"),
            ));
        }
        Ok(())
    }

    pub fn set_generation_project(
        &self,
        generation_id: &str,
        project_id: Option<&str>,
    ) -> AppResult<()> {
        let connection = self.connection()?;
        let updated = connection
            .execute(
                "UPDATE generations SET project_id = ?1 WHERE id = ?2",
                params![project_id, generation_id],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        if updated == 0 {
            return Err(AppError::not_found(
                "Generation record",
                format!("No generation record exists for id {generation_id}"),
            ));
        }
        Ok(())
    }

    pub fn list_generations_by_project(
        &self,
        project_id: &str,
        limit: Option<u32>,
    ) -> AppResult<Vec<GenerationRecord>> {
        let connection = self.connection()?;
        let limit_i64: Option<i64> = limit.map(i64::from);
        const SELECT: &str = "SELECT id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info, is_favorite, project_id FROM generations WHERE status = 'completed' AND COALESCE(output_path, '') <> '' AND project_id = ?1";
        const ORDER: &str = " ORDER BY is_favorite DESC, created_at DESC";

        match limit_i64 {
            Some(limit_i64) => {
                let mut statement = connection
                    .prepare(&format!("{SELECT}{ORDER} LIMIT ?2"))
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                let mapped = statement
                    .query_map(params![project_id, limit_i64], Self::map_generation_row)
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                mapped
                    .into_iter()
                    .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
                    .collect()
            }
            None => {
                let mut statement = connection
                    .prepare(&format!("{SELECT}{ORDER}"))
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                let mapped = statement
                    .query_map(params![project_id], Self::map_generation_row)
                    .map_err(|error| AppError::db_read_failed(error.to_string()))?;
                mapped
                    .into_iter()
                    .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
                    .collect()
            }
        }
    }

    pub fn upsert_active_generation_task(
        &self,
        task: &ActiveGenerationTask,
    ) -> AppResult<ActiveGenerationTask> {
        let connection = self.connection()?;
        let request_json = serde_json::to_string(&task.request)
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        connection
            .execute(
                "INSERT INTO active_generation_tasks (id, task_id, request_json, variation_index, variation_total, created_at, updated_at, cancel_requested_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(id) DO UPDATE SET task_id = excluded.task_id, request_json = excluded.request_json, variation_index = excluded.variation_index, variation_total = excluded.variation_total, updated_at = excluded.updated_at, cancel_requested_at = excluded.cancel_requested_at",
                params![
                    task.id,
                    task.task_id,
                    request_json,
                    task.variation_index,
                    task.variation_total,
                    task.created_at,
                    task.updated_at,
                    task.cancel_requested_at,
                ],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(task.clone())
    }

    pub fn list_active_generation_tasks(&self) -> AppResult<Vec<ActiveGenerationTask>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, task_id, request_json, variation_index, variation_total, created_at, updated_at, cancel_requested_at FROM active_generation_tasks ORDER BY created_at ASC",
            )
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        let rows = statement
            .query_map([], Self::map_active_generation_task_row)
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;

        rows.into_iter()
            .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
            .collect()
    }

    pub fn get_active_generation_task(&self, id: &str) -> AppResult<Option<ActiveGenerationTask>> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, task_id, request_json, variation_index, variation_total, created_at, updated_at, cancel_requested_at FROM active_generation_tasks WHERE id = ?1",
                [id],
                Self::map_active_generation_task_row,
            )
            .optional()
            .map_err(|error| AppError::db_read_failed(error.to_string()))
    }

    pub fn delete_active_generation_task(&self, id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        connection
            .execute("DELETE FROM active_generation_tasks WHERE id = ?1", [id])
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(())
    }

    pub fn insert_failed_run(&self, record: &FailedRun) -> AppResult<FailedRun> {
        let connection = self.connection()?;
        connection
            .execute(
                "INSERT INTO failed_runs (id, created_at, request_json, error_code, error_message, error_details) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    record.id,
                    record.created_at,
                    record.request_json,
                    record.error_code,
                    record.error_message,
                    record.error_details,
                ],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(record.clone())
    }

    pub fn list_failed_runs(&self, limit: usize) -> AppResult<Vec<FailedRun>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, created_at, request_json, error_code, error_message, error_details FROM failed_runs ORDER BY created_at DESC LIMIT ?1",
            )
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        let limit_i64: i64 = limit
            .try_into()
            .map_err(|_| AppError::internal("limit out of range"))?;
        let rows = statement
            .query_map(params![limit_i64], Self::map_failed_run_row)
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        rows.into_iter()
            .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
            .collect()
    }

    pub fn delete_failed_run(&self, id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        connection
            .execute("DELETE FROM failed_runs WHERE id = ?1", [id])
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(())
    }

    /// Keep only the N most recent failed runs; delete the rest.
    pub fn clear_failed_runs_older_than(&self, keep: usize) -> AppResult<()> {
        let connection = self.connection()?;
        let keep_i64: i64 = keep
            .try_into()
            .map_err(|_| AppError::internal("keep count out of range"))?;
        connection
            .execute(
                "DELETE FROM failed_runs WHERE id NOT IN (SELECT id FROM failed_runs ORDER BY created_at DESC LIMIT ?1)",
                params![keep_i64],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(())
    }

    fn map_generation_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<GenerationRecord> {
        let output_path: String = row.get(17)?;
        let seed: Option<String> = row.get(15)?;

        let is_favorite_int: i32 = row.get(21)?;
        let project_id: Option<String> = row.get(22)?;

        Ok(GenerationRecord {
            id: row.get(0)?,
            created_at: row.get(1)?,
            prompt: row.get(2)?,
            lyrics: row.get(3)?,
            vocal_language: row.get(4)?,
            duration_seconds: row.get(5)?,
            bpm: row.get(6)?,
            key_scale: row.get(7)?,
            time_signature: row.get(8)?,
            model: row.get(9)?,
            lm_model: row.get(10)?,
            thinking: row.get(11)?,
            inference_steps: row.get(12)?,
            guidance_scale: row.get(13)?,
            use_random_seed: row.get(14)?,
            seed: seed.and_then(|value| value.parse::<i64>().ok()),
            audio_format: row.get(16)?,
            output_path: if output_path.is_empty() {
                None
            } else {
                Some(output_path)
            },
            status: row.get(18)?,
            error_message: row.get(19)?,
            generation_info: row.get(20)?,
            is_favorite: is_favorite_int != 0,
            project_id,
        })
    }

    fn map_failed_run_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FailedRun> {
        Ok(FailedRun {
            id: row.get(0)?,
            created_at: row.get(1)?,
            request_json: row.get(2)?,
            error_code: row.get(3)?,
            error_message: row.get(4)?,
            error_details: row.get(5)?,
        })
    }

    fn map_active_generation_task_row(
        row: &rusqlite::Row<'_>,
    ) -> rusqlite::Result<ActiveGenerationTask> {
        let request_json: String = row.get(2)?;
        let request =
            serde_json::from_str::<GenerationRequest>(&request_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    2,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;

        Ok(ActiveGenerationTask {
            id: row.get(0)?,
            task_id: row.get(1)?,
            request,
            variation_index: row.get(3)?,
            variation_total: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
            cancel_requested_at: row.get(7)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::Database;
    use crate::models::{
        generation::{ActiveGenerationTask, GenerationRecord, GenerationRequest},
        settings::RecommendedProfile,
    };
    use serde_json::json;
    use std::fs;

    fn sample_record() -> GenerationRecord {
        GenerationRecord {
            id: "gen_001".to_owned(),
            created_at: "2026-04-23T10:00:00Z".to_owned(),
            prompt: "warm piano loop".to_owned(),
            lyrics: "".to_owned(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
            bpm: Some(92),
            key_scale: Some("C Major".to_owned()),
            time_signature: "4".to_owned(),
            model: Some("acestep-v15-turbo".to_owned()),
            lm_model: None,
            thinking: true,
            inference_steps: 8,
            guidance_scale: 7.0,
            use_random_seed: true,
            seed: None,
            audio_format: "wav".to_owned(),
            output_path: Some("/tmp/mock.wav".to_owned()),
            status: "completed".to_owned(),
            error_message: None,
            generation_info: Some("ok".to_owned()),
            is_favorite: false,
            project_id: None,
        }
    }

    fn sample_request() -> GenerationRequest {
        GenerationRequest {
            prompt: "warm piano loop".to_owned(),
            negative_prompt: None,
            lyrics: "".to_owned(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
            bpm: Some(92),
            key_scale: Some("C Major".to_owned()),
            time_signature: "4".to_owned(),
            audio_format: "wav".to_owned(),
            model: Some("acestep-v15-turbo".to_owned()),
            task_type: "text2music".to_owned(),
            lm_model_path: None,
            lm_backend: Some("mlx".to_owned()),
            thinking: true,
            inference_steps: 8,
            guidance_scale: 7.0,
            use_format: false,
            use_cot_caption: true,
            use_cot_language: true,
            constrained_decoding: true,
            reference_audio_path: None,
            src_audio_path: None,
            instruction: None,
            repainting_start: None,
            repainting_end: None,
            audio_cover_strength: None,
            use_random_seed: true,
            seed: None,
            variation_count: 2,
        }
    }

    #[test]
    fn settings_round_trip_from_sqlite() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");

        let settings = database
            .get_settings()
            .expect("default settings should load");
        assert!(matches!(settings.profile, RecommendedProfile::Standard));

        let updated = database
            .set_setting("backendPort", json!(1818))
            .expect("backendPort should persist");
        assert_eq!(updated.backend_port, 1818);

        let reloaded = database.get_settings().expect("settings should reload");
        assert_eq!(reloaded.backend_port, 1818);
    }

    #[test]
    fn settings_prunes_legacy_backend_command_path_key() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let connection = database.connection().expect("connection should open");
        connection
            .execute(
                "INSERT INTO settings (key, value, updated_at) VALUES ('backendCommandPath', '\"/tmp/uv\"', '2026-04-29T00:00:00Z')",
                [],
            )
            .expect("legacy setting should insert");

        let settings = database
            .get_settings()
            .expect("settings should ignore legacy key");
        assert_eq!(settings.backend_port, 8001);

        let legacy_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM settings WHERE key = 'backendCommandPath'",
                [],
                |row| row.get(0),
            )
            .expect("legacy count should query");
        assert_eq!(legacy_count, 0);
    }

    #[test]
    fn generation_crud_round_trip_works() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let record = sample_record();

        database
            .insert_generation(&record)
            .expect("generation record should insert");

        let listed = database
            .list_generations(Some("piano"), None)
            .expect("generation record should list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, record.id);

        let fetched = database
            .get_generation(&record.id)
            .expect("generation record should fetch")
            .expect("generation record should exist");
        assert_eq!(fetched.prompt, record.prompt);

        database
            .delete_generation(&record.id)
            .expect("generation record should delete");

        let remaining = database
            .list_generations(None, None)
            .expect("generation list should still load");
        assert!(remaining.is_empty());
    }

    #[test]
    fn list_generations_only_returns_generated_output_records() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");

        let completed = sample_record();
        database
            .insert_generation(&completed)
            .expect("completed generation should insert");

        let mut failed = sample_record();
        failed.id = "gen_failed".to_owned();
        failed.status = "failed".to_owned();
        failed.output_path = None;
        database
            .insert_generation(&failed)
            .expect("legacy failed generation should insert");

        let mut cancelled = sample_record();
        cancelled.id = "gen_cancelled".to_owned();
        cancelled.status = "cancelled".to_owned();
        cancelled.output_path = None;
        database
            .insert_generation(&cancelled)
            .expect("legacy cancelled generation should insert");

        let listed = database
            .list_generations(None, None)
            .expect("generation list should load");

        assert_eq!(
            listed
                .iter()
                .map(|record| record.id.as_str())
                .collect::<Vec<_>>(),
            vec!["gen_001"]
        );
    }

    #[test]
    fn clear_generations_removes_records_without_touching_files() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let output = temp_dir.path().join("mock.wav");
        fs::write(&output, b"audio").expect("audio should write");
        let mut record = sample_record();
        record.output_path = Some(output.display().to_string());
        database
            .insert_generation(&record)
            .expect("generation record should insert");

        database
            .clear_generations()
            .expect("generation records should clear");

        assert!(database
            .list_generations(None, None)
            .expect("generation list should load")
            .is_empty());
        assert!(output.exists());
    }

    #[test]
    fn active_generation_task_round_trip_works() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let task = ActiveGenerationTask {
            id: "active_001".to_owned(),
            task_id: "task-123".to_owned(),
            request: sample_request(),
            variation_index: 1,
            variation_total: 2,
            created_at: "2026-04-29T10:00:00Z".to_owned(),
            updated_at: "2026-04-29T10:00:01Z".to_owned(),
            cancel_requested_at: None,
        };

        database
            .upsert_active_generation_task(&task)
            .expect("active task should insert");
        let listed = database
            .list_active_generation_tasks()
            .expect("active tasks should list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].task_id, "task-123");
        assert_eq!(listed[0].request.variation_count, 2);

        database
            .delete_active_generation_task(&task.id)
            .expect("active task should delete");
        assert!(database
            .list_active_generation_tasks()
            .expect("active tasks should list")
            .is_empty());
    }

    #[test]
    fn schema_migrates_from_v1_to_latest() {
        use rusqlite::Connection;

        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let db_path = temp_dir.path().join("openloop.sqlite3");

        let conn = Connection::open(&db_path).expect("connection should open");
        conn.execute_batch(include_str!("../../migrations/001_init.sql"))
            .expect("v1 init should succeed");
        conn.execute(
            "INSERT INTO generations (id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
            rusqlite::params!["gen_v1", "2026-01-01T00:00:00Z", "legacy prompt", "", "en", 30.0, 92, "C Major", "4", "acestep-v15-turbo", rusqlite::types::Null, 1, 8, 7.0, 1, rusqlite::types::Null, "wav", "/tmp/legacy.wav", "completed", rusqlite::types::Null, "ok"],
        )
        .expect("v1 record should insert");
        conn.execute(
            "INSERT INTO active_generation_tasks (id, task_id, request_json, variation_index, variation_total, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params!["task_v1", "ace-123",             r#"{"prompt":"legacy request","lyrics":"","vocalLanguage":"en","durationSeconds":30.0,"timeSignature":"4","audioFormat":"wav","taskType":"text2music","thinking":true,"inferenceSteps":8,"guidanceScale":7.0,"useFormat":false,"useCotCaption":true,"useCotLanguage":true,"constrainedDecoding":true,"useRandomSeed":true,"variationCount":1}"#, 0, 1, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        )
        .expect("v1 task should insert");
        drop(conn);

        // Step 2: run full migration via Database::new
        let database =
            Database::new(temp_dir.path()).expect("database should initialize with migration");

        // Step 3: verify v1 record is still readable
        let all = database
            .list_generations(None, None)
            .expect("list should work");
        assert!(
            all.iter().any(|r| r.id == "gen_v1"),
            "v1 record should survive migration"
        );

        // Step 4: verify new columns work (is_favorite from 003)
        let mut record = sample_record();
        record.is_favorite = true;
        database
            .insert_generation(&record)
            .expect("record with is_favorite should insert");
        let fetched = database
            .get_generation(&record.id)
            .expect("get should work")
            .expect("record should exist");
        assert!(fetched.is_favorite, "is_favorite should persist");

        // Step 5: verify failed_runs table (004)
        let failed = database
            .list_failed_runs(10)
            .expect("failed runs should list");
        assert!(failed.is_empty(), "failed_runs table should exist");

        // Step 6: verify active tasks still work with cancel_requested_at
        let tasks = database
            .list_active_generation_tasks()
            .expect("tasks should list");
        assert!(
            tasks.iter().any(|t| t.id == "task_v1"),
            "v1 task should survive migration"
        );
    }

    #[test]
    fn project_crud_works_end_to_end() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        // Initially no projects
        assert!(database.list_projects().expect("list").is_empty());

        // Create
        let project = database
            .create_project("Album A")
            .expect("create project");
        assert_eq!(project.name, "Album A");

        // List
        let projects = database.list_projects().expect("list");
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, project.id);

        // Rename
        let renamed = database
            .rename_project(&project.id, "Album B")
            .expect("rename");
        assert_eq!(renamed.name, "Album B");

        // Delete
        database.delete_project(&project.id).expect("delete");
        assert!(database.list_projects().expect("list").is_empty());
    }

    #[test]
    fn assign_generation_to_project_and_query_by_project() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        let project = database
            .create_project("Soundtrack")
            .expect("create project");

        let record = sample_record();
        database.insert_generation(&record).expect("insert");

        // Assign
        database
            .set_generation_project(&record.id, Some(&project.id))
            .expect("assign");

        // Verify via get_generation
        let fetched = database
            .get_generation(&record.id)
            .expect("get")
            .expect("record");
        assert_eq!(fetched.project_id, Some(project.id.clone()));

        // Query by project
        let in_project = database
            .list_generations_by_project(&project.id, None)
            .expect("list by project");
        assert_eq!(in_project.len(), 1);
        assert_eq!(in_project[0].id, record.id);

        // Unassign
        database
            .set_generation_project(&record.id, None)
            .expect("unassign");
        let unassigned = database
            .get_generation(&record.id)
            .expect("get")
            .expect("record");
        assert!(unassigned.project_id.is_none());

        // Query by project returns empty
        let empty = database
            .list_generations_by_project(&project.id, None)
            .expect("list by project");
        assert!(empty.is_empty());
    }

    #[test]
    fn delete_project_unassigns_generations_not_deletes_them() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        let project = database
            .create_project("Ephemeral")
            .expect("create project");

        let record = sample_record();
        database.insert_generation(&record).expect("insert");
        database
            .set_generation_project(&record.id, Some(&project.id))
            .expect("assign");

        // Delete project
        database.delete_project(&project.id).expect("delete");

        // Generation still exists but project_id is null (ON DELETE SET NULL)
        let fetched = database
            .get_generation(&record.id)
            .expect("get")
            .expect("record");
        assert!(fetched.project_id.is_none());
    }
}
