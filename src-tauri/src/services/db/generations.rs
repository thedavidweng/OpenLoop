use rusqlite::{params, OptionalExtension};

use crate::models::{
    errors::{AppError, AppResult},
    generation::GenerationRecord,
};

use super::Database;

impl Database {
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

    pub(crate) fn map_generation_row(
        row: &rusqlite::Row<'_>,
    ) -> rusqlite::Result<GenerationRecord> {
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
}
