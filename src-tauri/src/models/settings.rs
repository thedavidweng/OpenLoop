use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::errors::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RecommendedProfile {
    LowMemory,
    Standard,
    Quality,
    Unsupported,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ModelVariant {
    Lite,
    Turbo,
    Pro,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub profile: RecommendedProfile,
    pub model_variant: Option<ModelVariant>,
    pub downloaded_models: Vec<ModelVariant>,
    pub output_directory: Option<String>,
    pub backend_port: u16,
    pub default_duration_seconds: f64,
    pub default_audio_format: String,
    pub default_thinking: bool,
    pub first_run_completed: bool,
    pub language: Option<String>,
    pub model_directory: Option<String>,
    pub backend_command_path: Option<String>,
    pub backend_working_directory: Option<String>,
    pub log_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub os: String,
    pub arch: String,
    pub is_apple_silicon: bool,
    pub total_memory_gb: u64,
    pub recommended_profile: RecommendedProfile,
    pub cpu_brand: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            profile: RecommendedProfile::Standard,
            model_variant: None,
            downloaded_models: Vec::new(),
            output_directory: None,
            backend_port: 8001,
            default_duration_seconds: 30.0,
            default_audio_format: "wav".to_owned(),
            default_thinking: true,
            first_run_completed: false,
            language: None,
            model_directory: None,
            backend_command_path: None,
            backend_working_directory: None,
            log_directory: None,
        }
    }
}

impl AppSettings {
    pub fn apply_setting(&mut self, key: &str, value: Value) -> AppResult<()> {
        match key {
            "profile" => {
                self.profile = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid profile value: {error}"))
                })?;
            }
            "modelVariant" => {
                self.model_variant = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid modelVariant value: {error}"))
                })?;
            }
            "downloadedModels" => {
                self.downloaded_models = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid downloadedModels value: {error}"))
                })?;
            }
            "outputDirectory" => {
                self.output_directory = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid outputDirectory value: {error}"))
                })?;
            }
            "backendPort" => {
                self.backend_port = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid backendPort value: {error}"))
                })?;
            }
            "defaultDurationSeconds" => {
                self.default_duration_seconds = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!(
                        "invalid defaultDurationSeconds value: {error}"
                    ))
                })?;
            }
            "defaultAudioFormat" => {
                self.default_audio_format = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!(
                        "invalid defaultAudioFormat value: {error}"
                    ))
                })?;
            }
            "defaultThinking" => {
                self.default_thinking = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid defaultThinking value: {error}"))
                })?;
            }
            "firstRunCompleted" => {
                self.first_run_completed = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid firstRunCompleted value: {error}"))
                })?;
            }
            "language" => {
                self.language = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid language value: {error}"))
                })?;
            }
            "modelDirectory" => {
                self.model_directory = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid modelDirectory value: {error}"))
                })?;
            }
            "backendCommandPath" => {
                self.backend_command_path = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!(
                        "invalid backendCommandPath value: {error}"
                    ))
                })?;
            }
            "backendWorkingDirectory" => {
                self.backend_working_directory =
                    serde_json::from_value(value).map_err(|error| {
                        AppError::validation_failed(format!(
                            "invalid backendWorkingDirectory value: {error}"
                        ))
                    })?;
            }
            "logDirectory" => {
                self.log_directory = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid logDirectory value: {error}"))
                })?;
            }
            _ => {
                return Err(AppError::validation_failed(format!(
                    "unknown setting key: {key}"
                )));
            }
        }

        Ok(())
    }

    pub fn entries(&self) -> AppResult<Vec<(&'static str, String)>> {
        let serialized = vec![
            ("profile", serde_json::to_string(&self.profile)),
            ("modelVariant", serde_json::to_string(&self.model_variant)),
            (
                "downloadedModels",
                serde_json::to_string(&self.downloaded_models),
            ),
            (
                "outputDirectory",
                serde_json::to_string(&self.output_directory),
            ),
            ("backendPort", serde_json::to_string(&self.backend_port)),
            (
                "defaultDurationSeconds",
                serde_json::to_string(&self.default_duration_seconds),
            ),
            (
                "defaultAudioFormat",
                serde_json::to_string(&self.default_audio_format),
            ),
            (
                "defaultThinking",
                serde_json::to_string(&self.default_thinking),
            ),
            (
                "firstRunCompleted",
                serde_json::to_string(&self.first_run_completed),
            ),
            ("language", serde_json::to_string(&self.language)),
            (
                "modelDirectory",
                serde_json::to_string(&self.model_directory),
            ),
            (
                "backendCommandPath",
                serde_json::to_string(&self.backend_command_path),
            ),
            (
                "backendWorkingDirectory",
                serde_json::to_string(&self.backend_working_directory),
            ),
            ("logDirectory", serde_json::to_string(&self.log_directory)),
        ];

        serialized
            .into_iter()
            .map(|(key, result)| {
                result
                    .map(|value| (key, value))
                    .map_err(|error| AppError::db_write_failed(error.to_string()))
            })
            .collect()
    }
}
