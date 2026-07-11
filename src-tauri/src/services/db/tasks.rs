use rusqlite::{params, OptionalExtension};

use crate::models::{
    errors::{AppError, AppResult},
    generation::{ActiveGenerationTask, FailedRun, GenerationRequest},
};

use super::Database;

impl Database {
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

    pub(crate) fn map_active_generation_task_row(
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

    pub(crate) fn map_failed_run_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FailedRun> {
        Ok(FailedRun {
            id: row.get(0)?,
            created_at: row.get(1)?,
            request_json: row.get(2)?,
            error_code: row.get(3)?,
            error_message: row.get(4)?,
            error_details: row.get(5)?,
        })
    }
}
