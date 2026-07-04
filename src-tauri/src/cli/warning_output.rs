use crate::models::errors::AppError;

pub fn cancel_via_db_warning(error: &AppError) -> String {
    format!(
        "warning: failed to write cancellation to database: {}",
        error.message
    )
}

pub fn persist_downloaded_models_warning(error: &AppError) -> String {
    format!(
        "warning: failed to persist downloaded models: {}",
        error.message
    )
}

pub fn backend_start_warning(error: &AppError) -> String {
    format!("warning: failed to start backend: {}", error.message)
}

pub fn flush_archive_warning(error: &impl std::fmt::Display) -> String {
    format!("failed to flush archive file: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::errors::AppError;

    #[test]
    fn warning_messages_include_error_text() {
        let error = AppError::new("TEST", "database is locked", None, true);
        assert!(persist_downloaded_models_warning(&error).contains("database is locked"));
        assert!(backend_start_warning(&error).contains("database is locked"));
        assert!(cancel_via_db_warning(&error).contains("database is locked"));
        assert!(flush_archive_warning(&"disk full").contains("disk full"));
    }
}
