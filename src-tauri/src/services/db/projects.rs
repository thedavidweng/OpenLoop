use chrono::Utc;
use rusqlite::params;

use crate::models::{
    errors::{AppError, AppResult},
    generation::GenerationRecord,
    project::Project,
};

use super::Database;

impl Database {
    pub fn list_projects(&self) -> AppResult<Vec<Project>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC",
            )
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
        let created_at: String = connection
            .query_row(
                "SELECT created_at FROM projects WHERE id = ?1",
                [id],
                |row| row.get(0),
            )
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        Ok(Project {
            id: id.to_string(),
            name: name.to_string(),
            created_at,
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

    /// Find generation IDs matching a prefix. Returns up to 2 matches for ambiguity detection.
    pub fn find_generation_ids_by_prefix(&self, prefix: &str) -> AppResult<Vec<String>> {
        let connection = self.connection()?;
        let pattern = format!("{prefix}%");
        let mut statement = connection
            .prepare("SELECT id FROM generations WHERE id LIKE ?1 LIMIT 2")
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        let mapped = statement
            .query_map(params![pattern], |row| row.get::<_, String>(0))
            .map_err(|error| AppError::db_read_failed(error.to_string()))?;
        mapped
            .into_iter()
            .map(|row| row.map_err(|error| AppError::db_read_failed(error.to_string())))
            .collect()
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
}
