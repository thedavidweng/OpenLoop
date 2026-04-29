use serde::Serialize;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
    pub recoverable: bool,
}

impl AppError {
    pub fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        details: Option<String>,
        recoverable: bool,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details,
            recoverable,
        }
    }

    pub fn internal(details: impl Into<String>) -> Self {
        Self::new(
            "INTERNAL_ERROR",
            "OpenLoop hit an internal error.",
            Some(details.into()),
            true,
        )
    }

    pub fn validation_failed(details: impl Into<String>) -> Self {
        Self::new(
            "VALIDATION_FAILED",
            "The generation request is invalid.",
            Some(details.into()),
            true,
        )
    }

    pub fn not_found(entity: &str, details: impl Into<String>) -> Self {
        Self::new(
            "NOT_FOUND",
            format!("{entity} was not found."),
            Some(details.into()),
            true,
        )
    }

    pub fn backend_start_failed(details: impl Into<String>) -> Self {
        Self::new(
            "BACKEND_START_FAILED",
            "OpenLoop could not start the ACE-Step backend.",
            Some(details.into()),
            true,
        )
    }

    pub fn backend_health_timeout(details: impl Into<String>) -> Self {
        Self::new(
            "BACKEND_HEALTH_TIMEOUT",
            "The ACE-Step backend did not become healthy in time.",
            Some(details.into()),
            true,
        )
    }

    pub fn model_not_found(details: impl Into<String>) -> Self {
        Self::new(
            "MODEL_NOT_FOUND",
            "OpenLoop could not find the configured model.",
            Some(details.into()),
            true,
        )
    }

    pub fn model_download_failed(details: impl Into<String>) -> Self {
        Self::new(
            "MODEL_DOWNLOAD_FAILED",
            "OpenLoop could not download the selected model.",
            Some(details.into()),
            true,
        )
    }

    pub fn task_submit_failed(details: impl Into<String>) -> Self {
        Self::new(
            "TASK_SUBMIT_FAILED",
            "OpenLoop could not submit the generation task.",
            Some(details.into()),
            true,
        )
    }

    pub fn task_failed(details: impl Into<String>) -> Self {
        Self::new(
            "TASK_FAILED",
            "The generation task failed.",
            Some(details.into()),
            true,
        )
    }

    pub fn audio_download_failed(details: impl Into<String>) -> Self {
        Self::new(
            "AUDIO_DOWNLOAD_FAILED",
            "OpenLoop could not download the generated audio.",
            Some(details.into()),
            true,
        )
    }

    pub fn output_write_failed(details: impl Into<String>) -> Self {
        Self::new(
            "OUTPUT_WRITE_FAILED",
            "OpenLoop could not write the output audio file.",
            Some(details.into()),
            true,
        )
    }

    pub fn output_read_failed(details: impl Into<String>) -> Self {
        Self::new(
            "OUTPUT_READ_FAILED",
            "OpenLoop could not read the output audio file.",
            Some(details.into()),
            true,
        )
    }

    pub fn db_write_failed(details: impl Into<String>) -> Self {
        Self::new(
            "DB_WRITE_FAILED",
            "OpenLoop could not write to the local database.",
            Some(details.into()),
            true,
        )
    }

    pub fn db_read_failed(details: impl Into<String>) -> Self {
        Self::new(
            "DB_READ_FAILED",
            "OpenLoop could not read from the local database.",
            Some(details.into()),
            true,
        )
    }
}
