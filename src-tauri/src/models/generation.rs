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
    #[serde(default = "default_variation_count")]
    pub variation_count: i64,
}

fn default_variation_count() -> i64 {
    1
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
    #[serde(default)]
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationRunResult {
    pub records: Vec<GenerationRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveGenerationTask {
    pub id: String,
    pub task_id: String,
    pub request: GenerationRequest,
    pub variation_index: i64,
    pub variation_total: i64,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancel_requested_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptEnhancementResult {
    pub prompt: String,
    pub lyrics: Option<String>,
    pub bpm: Option<i64>,
    pub key_scale: Option<String>,
    pub time_signature: Option<String>,
    pub duration_seconds: Option<f64>,
    pub vocal_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedRun {
    pub id: String,
    pub created_at: String,
    pub request_json: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub error_details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationWaveform {
    pub peaks: Vec<f32>,
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

        if !(1..=4).contains(&self.variation_count) {
            return Err(AppError::validation_failed(
                "variationCount must be between 1 and 4",
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::GenerationRequest;

    fn valid_request() -> GenerationRequest {
        GenerationRequest {
            prompt: "warm piano".to_owned(),
            negative_prompt: None,
            lyrics: "".to_owned(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
            bpm: None,
            key_scale: None,
            time_signature: "4".to_owned(),
            audio_format: "wav".to_owned(),
            model: None,
            task_type: "text2music".to_owned(),
            lm_model_path: None,
            lm_backend: None,
            thinking: false,
            inference_steps: 8,
            guidance_scale: 7.0,
            use_format: false,
            use_cot_caption: false,
            use_cot_language: false,
            constrained_decoding: false,
            reference_audio_path: None,
            src_audio_path: None,
            instruction: None,
            repainting_start: None,
            repainting_end: None,
            audio_cover_strength: None,
            use_random_seed: true,
            seed: None,
            variation_count: 1,
        }
    }

    #[test]
    fn validate_accepts_valid_request() {
        assert!(valid_request().validate().is_ok());
    }

    #[test]
    fn validate_accepts_lyrics_only_without_prompt() {
        let mut request = valid_request();
        request.prompt = "".to_owned();
        request.lyrics = "[Verse]\nHello world".to_owned();
        assert!(request.validate().is_ok());
    }

    #[test]
    fn validate_rejects_empty_prompt_and_lyrics() {
        let mut request = valid_request();
        request.prompt = "".to_owned();
        request.lyrics = "".to_owned();
        let error = request.validate().expect_err("should reject empty");
        assert_eq!(error.code, "VALIDATION_FAILED");
    }

    #[test]
    fn validate_rejects_whitespace_only_prompt_and_lyrics() {
        let mut request = valid_request();
        request.prompt = "   ".to_owned();
        request.lyrics = "  ".to_owned();
        let error = request.validate().expect_err("should reject whitespace");
        assert_eq!(error.code, "VALIDATION_FAILED");
    }

    #[test]
    fn validate_accepts_duration_boundaries() {
        let mut request = valid_request();

        request.duration_seconds = 10.0;
        assert!(request.validate().is_ok(), "10s should be valid");

        request.duration_seconds = 600.0;
        assert!(request.validate().is_ok(), "600s should be valid");
    }

    #[test]
    fn validate_rejects_duration_below_minimum() {
        let mut request = valid_request();
        request.duration_seconds = 9.9;
        let error = request.validate().expect_err("should reject");
        assert_eq!(error.code, "VALIDATION_FAILED");
        assert!(error.details.unwrap().contains("durationSeconds"));
    }

    #[test]
    fn validate_rejects_duration_above_maximum() {
        let mut request = valid_request();
        request.duration_seconds = 600.1;
        let error = request.validate().expect_err("should reject");
        assert_eq!(error.code, "VALIDATION_FAILED");
    }

    #[test]
    fn validate_accepts_bpm_boundaries() {
        let mut request = valid_request();

        request.bpm = Some(30);
        assert!(request.validate().is_ok(), "30 bpm should be valid");

        request.bpm = Some(300);
        assert!(request.validate().is_ok(), "300 bpm should be valid");

        request.bpm = None;
        assert!(request.validate().is_ok(), "no bpm should be valid");
    }

    #[test]
    fn validate_rejects_bpm_out_of_range() {
        let mut request = valid_request();

        request.bpm = Some(29);
        assert!(request.validate().is_err(), "29 bpm should be invalid");

        request.bpm = Some(301);
        assert!(request.validate().is_err(), "301 bpm should be invalid");
    }

    #[test]
    fn validate_accepts_seed_i32_boundaries() {
        let mut request = valid_request();

        request.seed = Some(2147483647);
        assert!(request.validate().is_ok(), "i32::MAX seed should be valid");

        request.seed = Some(-2147483648);
        assert!(request.validate().is_ok(), "i32::MIN seed should be valid");
    }

    #[test]
    fn validate_rejects_seed_outside_i32_range() {
        let mut request = valid_request();

        request.seed = Some(2147483648);
        assert!(
            request.validate().is_err(),
            "seed above i32::MAX should be invalid"
        );

        request.seed = Some(-2147483649);
        assert!(
            request.validate().is_err(),
            "seed below i32::MIN should be invalid"
        );
    }

    #[test]
    fn validate_accepts_variation_count_boundaries() {
        let mut request = valid_request();

        request.variation_count = 1;
        assert!(request.validate().is_ok(), "1 variation should be valid");

        request.variation_count = 4;
        assert!(request.validate().is_ok(), "4 variations should be valid");
    }

    #[test]
    fn validate_rejects_variation_count_out_of_range() {
        let mut request = valid_request();

        request.variation_count = 0;
        assert!(
            request.validate().is_err(),
            "0 variations should be invalid"
        );

        request.variation_count = 5;
        assert!(
            request.validate().is_err(),
            "5 variations should be invalid"
        );
    }
}
