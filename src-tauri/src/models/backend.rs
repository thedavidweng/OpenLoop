use serde::Serialize;

use crate::models::errors::AppError;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum BackendStatus {
    Stopped,
    Starting,
    Healthy { port: u16 },
    Failed { error: AppError },
}
