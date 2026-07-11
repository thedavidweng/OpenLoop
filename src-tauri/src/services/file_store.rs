use std::{env, fs, path::PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::models::{
    errors::{AppError, AppResult},
    settings::AppSettings,
};

pub struct FileStore {
    app_data_dir: PathBuf,
}

impl FileStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn resolve_output_directory(&self, settings: &AppSettings) -> AppResult<PathBuf> {
        let directory = settings
            .output_directory
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| default_output_directory(&self.app_data_dir));

        fs::create_dir_all(&directory)
            .map_err(|error| AppError::output_write_failed(error.to_string()))?;
        Ok(directory)
    }

    pub fn write_audio(
        &self,
        bytes: Vec<u8>,
        audio_format: &str,
        settings: &AppSettings,
    ) -> AppResult<String> {
        const ALLOWED_FORMATS: &[&str] = &["wav", "mp3", "flac", "ogg"];
        if !ALLOWED_FORMATS.contains(&audio_format) {
            return Err(AppError::validation_failed(
                "audioFormat must be one of: wav, mp3, flac, ogg",
            ));
        }

        let directory = self.resolve_output_directory(settings)?;
        let filename = format!(
            "openloop-{}-{}.{}",
            Utc::now().format("%Y%m%d-%H%M%S"),
            Uuid::new_v4(),
            audio_format
        );
        let output_path = directory.join(filename);

        fs::write(&output_path, bytes)
            .map_err(|error| AppError::output_write_failed(error.to_string()))?;

        Ok(output_path.display().to_string())
    }
}

fn default_output_directory(app_data_dir: &std::path::Path) -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join("Music").join("OpenLoop"))
        .unwrap_or_else(|| app_data_dir.join("generated-audio"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_audio_rejects_invalid_format() {
        let temp = tempfile::tempdir().expect("temp dir");
        let store = FileStore::new(temp.path().to_path_buf());
        let settings = AppSettings::default();
        let error = store
            .write_audio(vec![0u8; 4], "exe", &settings)
            .expect_err("invalid format should be rejected");
        assert!(error
            .details
            .as_deref()
            .unwrap_or("")
            .contains("audioFormat"));
    }

    #[test]
    fn write_audio_creates_file_in_default_directory() {
        let temp = tempfile::tempdir().expect("temp dir");
        let store = FileStore::new(temp.path().to_path_buf());
        let settings = AppSettings {
            output_directory: Some(temp.path().join("output").display().to_string()),
            ..AppSettings::default()
        };
        let path = store
            .write_audio(vec![0xAB; 16], "wav", &settings)
            .expect("write should succeed");
        assert!(path.ends_with(".wav"));
        assert!(std::path::Path::new(&path).exists());
    }

    #[test]
    fn resolve_output_directory_creates_missing_dirs() {
        let temp = tempfile::tempdir().expect("temp dir");
        let store = FileStore::new(temp.path().to_path_buf());
        let settings = AppSettings {
            output_directory: Some(temp.path().join("nested/deep/output").display().to_string()),
            ..AppSettings::default()
        };
        let dir = store.resolve_output_directory(&settings).expect("resolve");
        assert!(dir.exists());
        assert!(dir.ends_with("output"));
    }
}
