use serde::{ser::SerializeSeq, Deserialize, Deserializer, Serialize, Serializer};
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
    pub check_for_updates: bool,
    pub language: Option<String>,
    pub model_directory: Option<String>,
    pub backend_working_directory: Option<String>,
    pub log_directory: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_mirrors",
        serialize_with = "serialize_mirrors"
    )]
    pub model_mirrors: Vec<String>,
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
            check_for_updates: true,
            language: None,
            model_directory: None,
            backend_working_directory: None,
            log_directory: None,
            model_mirrors: Vec::new(),
        }
    }
}

fn mirrors_from_value(value: Value) -> Vec<String> {
    match value {
        Value::String(s) => {
            if s.is_empty() {
                Vec::new()
            } else {
                vec![s]
            }
        }
        Value::Array(arr) => {
            let mut out = Vec::new();
            for v in arr {
                if let Value::String(s) = v {
                    if !s.is_empty() {
                        out.push(s);
                    }
                }
            }
            out
        }
        Value::Null => Vec::new(),
        _ => Vec::new(),
    }
}

fn deserialize_mirrors<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(mirrors_from_value(value))
}

fn serialize_mirrors<S>(mirrors: &[String], serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let mut seq = serializer.serialize_seq(Some(mirrors.len()))?;
    for m in mirrors {
        seq.serialize_element(m)?;
    }
    seq.end()
}

/// Legacy settings storage uses a plain string for a single mirror and a JSON
/// array only when multiple mirrors are configured.
fn mirrors_to_setting_string(mirrors: &[String]) -> Result<String, serde_json::Error> {
    match mirrors.len() {
        0 => serde_json::to_string(""),
        1 => serde_json::to_string(&mirrors[0]),
        _ => serde_json::to_string(mirrors),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingKey {
    Profile,
    ModelVariant,
    DownloadedModels,
    OutputDirectory,
    BackendPort,
    DefaultDurationSeconds,
    DefaultAudioFormat,
    DefaultThinking,
    FirstRunCompleted,
    CheckForUpdates,
    Language,
    ModelDirectory,
    BackendWorkingDirectory,
    LogDirectory,
    ModelMirror,
}

impl SettingKey {
    pub fn parse(key: &str) -> AppResult<Self> {
        match key {
            "profile" => Ok(Self::Profile),
            "modelVariant" => Ok(Self::ModelVariant),
            "downloadedModels" => Ok(Self::DownloadedModels),
            "outputDirectory" => Ok(Self::OutputDirectory),
            "backendPort" => Ok(Self::BackendPort),
            "defaultDurationSeconds" => Ok(Self::DefaultDurationSeconds),
            "defaultAudioFormat" => Ok(Self::DefaultAudioFormat),
            "defaultThinking" => Ok(Self::DefaultThinking),
            "firstRunCompleted" => Ok(Self::FirstRunCompleted),
            "checkForUpdates" => Ok(Self::CheckForUpdates),
            "language" => Ok(Self::Language),
            "modelDirectory" => Ok(Self::ModelDirectory),
            "backendWorkingDirectory" => Ok(Self::BackendWorkingDirectory),
            "logDirectory" => Ok(Self::LogDirectory),
            "modelMirror" => Ok(Self::ModelMirror),
            _ => Err(AppError::validation_failed(format!(
                "unknown setting key: {key}"
            ))),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Profile => "profile",
            Self::ModelVariant => "modelVariant",
            Self::DownloadedModels => "downloadedModels",
            Self::OutputDirectory => "outputDirectory",
            Self::BackendPort => "backendPort",
            Self::DefaultDurationSeconds => "defaultDurationSeconds",
            Self::DefaultAudioFormat => "defaultAudioFormat",
            Self::DefaultThinking => "defaultThinking",
            Self::FirstRunCompleted => "firstRunCompleted",
            Self::CheckForUpdates => "checkForUpdates",
            Self::Language => "language",
            Self::ModelDirectory => "modelDirectory",
            Self::BackendWorkingDirectory => "backendWorkingDirectory",
            Self::LogDirectory => "logDirectory",
            Self::ModelMirror => "modelMirror",
        }
    }

    pub fn impacts_backend_startup(self) -> bool {
        matches!(
            self,
            Self::BackendPort
                | Self::ModelDirectory
                | Self::BackendWorkingDirectory
                | Self::LogDirectory
                | Self::ModelVariant
                | Self::ModelMirror
        )
    }
}

impl AppSettings {
    pub fn apply_setting(&mut self, key: SettingKey, value: Value) -> AppResult<()> {
        match key {
            SettingKey::Profile => {
                self.profile = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid profile value: {error}"))
                })?;
            }
            SettingKey::ModelVariant => {
                self.model_variant = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid modelVariant value: {error}"))
                })?;
            }
            SettingKey::DownloadedModels => {
                self.downloaded_models = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid downloadedModels value: {error}"))
                })?;
            }
            SettingKey::OutputDirectory => {
                self.output_directory = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid outputDirectory value: {error}"))
                })?;
            }
            SettingKey::BackendPort => {
                self.backend_port = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid backendPort value: {error}"))
                })?;
            }
            SettingKey::DefaultDurationSeconds => {
                self.default_duration_seconds = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!(
                        "invalid defaultDurationSeconds value: {error}"
                    ))
                })?;
            }
            SettingKey::DefaultAudioFormat => {
                self.default_audio_format = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!(
                        "invalid defaultAudioFormat value: {error}"
                    ))
                })?;
            }
            SettingKey::DefaultThinking => {
                self.default_thinking = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid defaultThinking value: {error}"))
                })?;
            }
            SettingKey::FirstRunCompleted => {
                self.first_run_completed = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid firstRunCompleted value: {error}"))
                })?;
            }
            SettingKey::CheckForUpdates => {
                self.check_for_updates = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid checkForUpdates value: {error}"))
                })?;
            }
            SettingKey::Language => {
                self.language = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid language value: {error}"))
                })?;
            }
            SettingKey::ModelDirectory => {
                self.model_directory = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid modelDirectory value: {error}"))
                })?;
            }
            SettingKey::BackendWorkingDirectory => {
                self.backend_working_directory =
                    serde_json::from_value(value).map_err(|error| {
                        AppError::validation_failed(format!(
                            "invalid backendWorkingDirectory value: {error}"
                        ))
                    })?;
            }
            SettingKey::LogDirectory => {
                self.log_directory = serde_json::from_value(value).map_err(|error| {
                    AppError::validation_failed(format!("invalid logDirectory value: {error}"))
                })?;
            }
            SettingKey::ModelMirror => {
                self.model_mirrors = mirrors_from_value(value);
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
            (
                "checkForUpdates",
                serde_json::to_string(&self.check_for_updates),
            ),
            ("language", serde_json::to_string(&self.language)),
            (
                "modelDirectory",
                serde_json::to_string(&self.model_directory),
            ),
            (
                "backendWorkingDirectory",
                serde_json::to_string(&self.backend_working_directory),
            ),
            ("logDirectory", serde_json::to_string(&self.log_directory)),
            (
                "modelMirror",
                mirrors_to_setting_string(&self.model_mirrors),
            ),
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

#[cfg(test)]
mod tests {
    use super::{AppSettings, SettingKey};

    #[test]
    fn setting_key_parse_rejects_unknown_key() {
        let error = SettingKey::parse("nonexistentKey").expect_err("unknown key should error");
        assert_eq!(error.code, "VALIDATION_FAILED");
        assert!(error.details.unwrap().contains("nonexistentKey"));
    }

    #[test]
    fn setting_key_parse_accepts_all_known_keys() {
        let keys = [
            "profile",
            "modelVariant",
            "downloadedModels",
            "outputDirectory",
            "backendPort",
            "defaultDurationSeconds",
            "defaultAudioFormat",
            "defaultThinking",
            "firstRunCompleted",
            "checkForUpdates",
            "language",
            "modelDirectory",
            "backendWorkingDirectory",
            "logDirectory",
            "modelMirror",
        ];
        for key in keys {
            SettingKey::parse(key).expect("known key should parse: {key}");
        }
    }

    #[test]
    fn setting_key_as_str_round_trips_from_parse() {
        let keys = [
            "profile",
            "modelVariant",
            "backendPort",
            "defaultDurationSeconds",
            "modelMirror",
        ];
        for key in keys {
            let parsed = SettingKey::parse(key).expect("should parse");
            assert_eq!(parsed.as_str(), key, "as_str should round-trip for {key}");
        }
    }

    #[test]
    fn impacts_backend_startup_flags_directory_and_port_keys() {
        assert!(SettingKey::BackendPort.impacts_backend_startup());
        assert!(SettingKey::ModelDirectory.impacts_backend_startup());
        assert!(SettingKey::BackendWorkingDirectory.impacts_backend_startup());
        assert!(SettingKey::LogDirectory.impacts_backend_startup());
        assert!(SettingKey::ModelVariant.impacts_backend_startup());
        assert!(SettingKey::ModelMirror.impacts_backend_startup());
    }

    #[test]
    fn impacts_backend_startup_does_not_flag_user_preference_keys() {
        assert!(!SettingKey::DefaultDurationSeconds.impacts_backend_startup());
        assert!(!SettingKey::DefaultAudioFormat.impacts_backend_startup());
        assert!(!SettingKey::DefaultThinking.impacts_backend_startup());
        assert!(!SettingKey::Language.impacts_backend_startup());
        assert!(!SettingKey::OutputDirectory.impacts_backend_startup());
        assert!(!SettingKey::CheckForUpdates.impacts_backend_startup());
    }

    #[test]
    fn entries_serializes_single_mirror_as_legacy_string() {
        let mut settings = AppSettings::default();
        settings.model_mirrors = vec!["https://hf-mirror.com".to_owned()];
        let entries = settings.entries().expect("entries should succeed");
        let mirror = entries
            .into_iter()
            .find(|(key, _)| *key == "modelMirror")
            .map(|(_, value)| value)
            .expect("modelMirror entry");
        assert_eq!(mirror, "\"https://hf-mirror.com\"");
    }

    #[test]
    fn entries_serializes_multiple_mirrors_as_json_array() {
        let mut settings = AppSettings::default();
        settings.model_mirrors = vec![
            "https://mirror-a.example".to_owned(),
            "https://mirror-b.example".to_owned(),
        ];
        let entries = settings.entries().expect("entries should succeed");
        let mirror = entries
            .into_iter()
            .find(|(key, _)| *key == "modelMirror")
            .map(|(_, value)| value)
            .expect("modelMirror entry");
        assert_eq!(
            mirror,
            "[\"https://mirror-a.example\",\"https://mirror-b.example\"]"
        );
    }

    #[test]
    fn apply_setting_rejects_invalid_value_type() {
        let mut settings = AppSettings::default();
        let error = settings
            .apply_setting(SettingKey::BackendPort, serde_json::json!("not-a-number"))
            .expect_err("invalid type should error");
        assert_eq!(error.code, "VALIDATION_FAILED");
    }
}
