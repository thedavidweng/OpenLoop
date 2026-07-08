use serde::{Deserialize, Serialize};

/// A named preset of generation form defaults that can be applied with one click.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationProfile {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub model_variant: Option<String>,
    pub duration_seconds: Option<f64>,
    pub audio_format: Option<String>,
    pub thinking: Option<bool>,
    pub inference_steps: Option<i64>,
    pub guidance_scale: Option<f64>,
    pub bpm: Option<i64>,
    pub key_scale: Option<String>,
    pub time_signature: Option<String>,
    pub vocal_language: Option<String>,
    pub lm_backend: Option<String>,
}

/// Payload for creating a profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileRequest {
    pub name: String,
    pub model_variant: Option<String>,
    pub duration_seconds: Option<f64>,
    pub audio_format: Option<String>,
    pub thinking: Option<bool>,
    pub inference_steps: Option<i64>,
    pub guidance_scale: Option<f64>,
    pub bpm: Option<i64>,
    pub key_scale: Option<String>,
    pub time_signature: Option<String>,
    pub vocal_language: Option<String>,
    pub lm_backend: Option<String>,
}

/// Payload for renaming a profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameProfileRequest {
    pub name: String,
}
