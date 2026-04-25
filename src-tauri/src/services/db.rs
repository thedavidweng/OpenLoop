use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use crate::models::{
    errors::{AppError, AppResult},
    generation::GenerationRecord,
    settings::AppSettings,
};

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
            .map_err(|error| AppError::db_write_failed(error.to_string()))
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

    pub fn get_settings(&self) -> AppResult<AppSettings> {
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
            settings.apply_setting(&key, parsed)?;
        }

        Ok(settings)
    }

    pub fn set_setting(&self, key: &str, value: Value) -> AppResult<AppSettings> {
        let mut settings = self.get_settings()?;
        settings.apply_setting(key, value.clone())?;

        let serialized = serde_json::to_string(&value)
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        let connection = self.connection()?;
        connection
            .execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![key, serialized, Utc::now().to_rfc3339()],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        Ok(settings)
    }

    pub fn list_generations(&self, query: Option<&str>) -> AppResult<Vec<GenerationRecord>> {
        let connection = self.connection()?;
        let query = query.map(str::trim).filter(|value| !value.is_empty());

        let mut statement = if query.is_some() {
            connection
                .prepare(
                    "SELECT id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info FROM generations WHERE COALESCE(prompt, '') LIKE ?1 OR COALESCE(lyrics, '') LIKE ?1 ORDER BY created_at DESC",
                )
                .map_err(|error| AppError::db_read_failed(error.to_string()))?
        } else {
            connection
                .prepare(
                    "SELECT id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info FROM generations ORDER BY created_at DESC",
                )
                .map_err(|error| AppError::db_read_failed(error.to_string()))?
        };

        let mapped = if let Some(value) = query {
            let like_query = format!("%{value}%");
            statement.query_map([like_query], Self::map_generation_row)
        } else {
            statement.query_map([], Self::map_generation_row)
        }
        .map_err(|error| AppError::db_read_failed(error.to_string()))?;

        mapped
            .into_iter()
            .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
            .collect()
    }

    pub fn get_generation(&self, id: &str) -> AppResult<Option<GenerationRecord>> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info FROM generations WHERE id = ?1",
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
                "INSERT INTO generations (id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21) ON CONFLICT(id) DO UPDATE SET created_at = excluded.created_at, prompt = excluded.prompt, lyrics = excluded.lyrics, vocal_language = excluded.vocal_language, duration_seconds = excluded.duration_seconds, bpm = excluded.bpm, key_scale = excluded.key_scale, time_signature = excluded.time_signature, model = excluded.model, lm_model = excluded.lm_model, thinking = excluded.thinking, inference_steps = excluded.inference_steps, guidance_scale = excluded.guidance_scale, use_random_seed = excluded.use_random_seed, seed = excluded.seed, audio_format = excluded.audio_format, output_path = excluded.output_path, status = excluded.status, error_message = excluded.error_message, generation_info = excluded.generation_info",
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
                ],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;

        Ok(record.clone())
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

    fn map_generation_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<GenerationRecord> {
        let output_path: String = row.get(17)?;
        let seed: Option<String> = row.get(15)?;

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
        })
    }
}

#[cfg(test)]
mod tests {
    use super::Database;
    use crate::models::{generation::GenerationRecord, settings::RecommendedProfile};
    use serde_json::json;

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
    fn generation_crud_round_trip_works() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let record = sample_record();

        database
            .insert_generation(&record)
            .expect("generation record should insert");

        let listed = database
            .list_generations(Some("piano"))
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
            .list_generations(None)
            .expect("generation list should still load");
        assert!(remaining.is_empty());
    }
}
