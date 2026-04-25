use std::{env, fs, path::PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::{
    audio::{decode::decode_bytes, encode::write_ogg_file},
    models::{
        errors::{AppError, AppResult},
        settings::AppSettings,
    },
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
        let directory = self.resolve_output_directory(settings)?;
        let filename = format!(
            "openloop-{}-{}.{}",
            Utc::now().format("%Y%m%d-%H%M%S"),
            Uuid::new_v4(),
            audio_format
        );
        let output_path = directory.join(filename);

        if audio_format == "ogg" {
            let decoded = decode_bytes(bytes, "flac").map_err(|error| {
                AppError::output_write_failed(format!(
                    "failed to decode ACE-Step output before OGG export: {error}"
                ))
            })?;
            write_ogg_file(&output_path, &decoded).map_err(|error| {
                AppError::output_write_failed(format!("failed to write OGG/Vorbis output: {error}"))
            })?;
        } else {
            fs::write(&output_path, bytes)
                .map_err(|error| AppError::output_write_failed(error.to_string()))?;
        }

        Ok(output_path.display().to_string())
    }
}

fn default_output_directory(app_data_dir: &std::path::Path) -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join("Music").join("OpenLoop"))
        .unwrap_or_else(|| app_data_dir.join("generated-audio"))
}
