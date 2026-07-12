use chrono::Utc;
use rusqlite::params;

use crate::models::{
    errors::{AppError, AppResult},
    profile::{CreateProfileRequest, GenerationProfile},
};

use super::Database;

impl Database {
    pub(crate) fn map_profile_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<GenerationProfile> {
        Ok(GenerationProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
            model_variant: row.get(4)?,
            duration_seconds: row.get(5)?,
            audio_format: row.get(6)?,
            thinking: row.get::<_, Option<i32>>(7)?.map(|v| v != 0),
            inference_steps: row.get(8)?,
            guidance_scale: row.get(9)?,
            bpm: row.get(10)?,
            key_scale: row.get(11)?,
            time_signature: row.get(12)?,
            vocal_language: row.get(13)?,
            lm_backend: row.get(14)?,
        })
    }

    pub fn list_profiles(&self) -> AppResult<Vec<GenerationProfile>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT id, name, created_at, updated_at, model_variant, duration_seconds, audio_format, thinking, inference_steps, guidance_scale, bpm, key_scale, time_signature, vocal_language, lm_backend FROM generation_profiles ORDER BY updated_at DESC")
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        let mapped = statement
            .query_map([], Self::map_profile_row)
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        mapped
            .into_iter()
            .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
            .collect()
    }

    pub fn create_profile(&self, request: &CreateProfileRequest) -> AppResult<GenerationProfile> {
        let connection = self.connection()?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        connection
            .execute(
                "INSERT INTO generation_profiles (id, name, created_at, updated_at, model_variant, duration_seconds, audio_format, thinking, inference_steps, guidance_scale, bpm, key_scale, time_signature, vocal_language, lm_backend) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    id,
                    request.name,
                    now,
                    now,
                    request.model_variant,
                    request.duration_seconds,
                    request.audio_format,
                    request.thinking.map(|b| b as i32),
                    request.inference_steps,
                    request.guidance_scale,
                    request.bpm,
                    request.key_scale,
                    request.time_signature,
                    request.vocal_language,
                    request.lm_backend,
                ],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        Ok(GenerationProfile {
            id,
            name: request.name.clone(),
            created_at: now.clone(),
            updated_at: now,
            model_variant: request.model_variant.clone(),
            duration_seconds: request.duration_seconds,
            audio_format: request.audio_format.clone(),
            thinking: request.thinking,
            inference_steps: request.inference_steps,
            guidance_scale: request.guidance_scale,
            bpm: request.bpm,
            key_scale: request.key_scale.clone(),
            time_signature: request.time_signature.clone(),
            vocal_language: request.vocal_language.clone(),
            lm_backend: request.lm_backend.clone(),
        })
    }

    pub fn rename_profile(&self, id: &str, name: &str) -> AppResult<GenerationProfile> {
        let connection = self.connection()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection
            .execute(
                "UPDATE generation_profiles SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        if updated == 0 {
            return Err(AppError::not_found(
                "Profile",
                format!("No profile exists for id {id}"),
            ));
        }
        connection
            .query_row(
                "SELECT id, name, created_at, updated_at, model_variant, duration_seconds, audio_format, thinking, inference_steps, guidance_scale, bpm, key_scale, time_signature, vocal_language, lm_backend FROM generation_profiles WHERE id = ?1",
                [id],
                Self::map_profile_row,
            )
            .map_err(|error| AppError::db_read_failed(error.to_string()))
    }

    pub fn delete_profile(&self, id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        let deleted = connection
            .execute("DELETE FROM generation_profiles WHERE id = ?1", [id])
            .map_err(|error| AppError::db_write_failed(error.to_string()))?;
        if deleted == 0 {
            return Err(AppError::not_found(
                "Profile",
                format!("No profile exists for id {id}"),
            ));
        }
        Ok(())
    }
}
