use serde::{Deserialize, Serialize};

use crate::models::errors::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub lyrics: String,
    pub vocal_language: String,
    pub duration_seconds: f64,
    pub bpm: Option<i64>,
    pub key_scale: Option<String>,
    pub time_signature: String,
    pub audio_format: String,
    pub model: Option<String>,
    pub task_type: String,
    pub lm_model_path: Option<String>,
    pub lm_backend: Option<String>,
    pub thinking: bool,
    pub inference_steps: i64,
    pub guidance_scale: f64,
    pub use_format: bool,
    pub use_cot_caption: bool,
    pub use_cot_language: bool,
    pub constrained_decoding: bool,
    pub reference_audio_path: Option<String>,
    pub src_audio_path: Option<String>,
    pub instruction: Option<String>,
    pub repainting_start: Option<f64>,
    pub repainting_end: Option<f64>,
    pub audio_cover_strength: Option<f64>,
    pub use_random_seed: bool,
    pub seed: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationRecord {
    pub id: String,
    pub created_at: String,
    pub prompt: String,
    pub lyrics: String,
    pub vocal_language: String,
    pub duration_seconds: f64,
    pub bpm: Option<i64>,
    pub key_scale: Option<String>,
    pub time_signature: String,
    pub model: Option<String>,
    pub lm_model: Option<String>,
    pub thinking: bool,
    pub inference_steps: i64,
    pub guidance_scale: f64,
    pub use_random_seed: bool,
    pub seed: Option<i64>,
    pub audio_format: String,
    pub output_path: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub generation_info: Option<String>,
}

impl GenerationRequest {
    pub fn validate(&self) -> AppResult<()> {
        if self.prompt.trim().is_empty() && self.lyrics.trim().is_empty() {
            return Err(AppError::validation_failed(
                "prompt and lyrics cannot both be empty",
            ));
        }

        if !(10.0..=600.0).contains(&self.duration_seconds) {
            return Err(AppError::validation_failed(
                "durationSeconds must be between 10 and 600",
            ));
        }

        if let Some(bpm) = self.bpm {
            if !(30..=300).contains(&bpm) {
                return Err(AppError::validation_failed(
                    "bpm must be empty or between 30 and 300",
                ));
            }
        }

        if let Some(seed) = self.seed {
            if !(-2147483648..=2147483647).contains(&seed) {
                return Err(AppError::validation_failed(
                    "seed must be a valid 32-bit integer",
                ));
            }
        }

        Ok(())
    }
}
