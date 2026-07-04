use tauri::{AppHandle, Emitter, State};

use crate::{
    models::{
        backend::BackendStatus,
        errors::{AppError, AppResult},
        generation::{
            ActiveGenerationTask, GenerationRecord, GenerationRequest, GenerationRunResult,
            PromptEnhancementResult,
        },
    },
    services::{
        ace_client::AceClient,
        generation_task::{GenerationEventSink, GENERATION_EVENT},
    },
    AppState,
};

#[tauri::command]
pub fn insert_generation(
    state: State<'_, AppState>,
    record: GenerationRecord,
) -> AppResult<GenerationRecord> {
    state.db.insert_generation(&record)
}

fn emit_generation_event(app: &AppHandle, payload: serde_json::Value) -> AppResult<()> {
    app.emit(GENERATION_EVENT, payload)
        .map_err(|error| AppError::internal(error.to_string()))
}

struct TauriGenerationEventSink<'a> {
    app: &'a AppHandle,
}

impl GenerationEventSink for TauriGenerationEventSink<'_> {
    fn emit_generation_event(&self, payload: serde_json::Value) -> AppResult<()> {
        emit_generation_event(self.app, payload)
    }
}

#[tauri::command]
pub fn cancel_generation(state: State<'_, AppState>) -> AppResult<()> {
    state.generation_runner().cancel();
    Ok(())
}

#[tauri::command]
pub fn list_active_generation_tasks(
    state: State<'_, AppState>,
) -> AppResult<Vec<ActiveGenerationTask>> {
    state.generation_runner().list_active_generation_tasks()
}

#[tauri::command]
pub fn discard_active_generation_task(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.generation_runner().discard_active_generation_task(&id)
}

#[tauri::command]
pub async fn enhance_prompt(
    state: State<'_, AppState>,
    request: GenerationRequest,
) -> AppResult<PromptEnhancementResult> {
    request.validate()?;
    let settings = state.db.get_settings()?;
    {
        let mut backend = state.lock_backend()?;
        if !matches!(backend.status(), BackendStatus::Healthy { .. }) {
            backend.start(&settings)?;
        }
    }
    let client = AceClient::new(settings.backend_port)?;
    client.health()?;
    client.format_input(&request)
}

#[tauri::command]
pub async fn resume_generation_task(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<GenerationRecord> {
    let active = state
        .db
        .get_active_generation_task(&id)?
        .ok_or_else(|| AppError::not_found("Active generation task", id.clone()))?;
    let settings = state.db.get_settings()?;
    {
        let mut backend = state.lock_backend()?;
        if !matches!(backend.status(), BackendStatus::Healthy { .. }) {
            return Err(AppError::task_failed(
                "active task can only be resumed while the ACE-Step backend is still healthy",
            ));
        }
    }
    let client = AceClient::new(settings.backend_port)?;
    client.health()?;
    let sink = TauriGenerationEventSink { app: &app };
    state.generation_runner().resume(&client, &sink, &settings, active)
}

#[tauri::command]
pub async fn generate_music(
    app: AppHandle,
    state: State<'_, AppState>,
    request: GenerationRequest,
) -> AppResult<GenerationRunResult> {
    request.validate()?;

    let settings = state.db.get_settings()?;
    let variation_total = request.variation_count;

    {
        let mut backend = state.lock_backend()?;
        if !matches!(backend.status(), BackendStatus::Healthy { .. }) {
            emit_generation_event(
                &app,
                serde_json::json!({
                    "type": "backend_starting",
                    "variationCurrent": 1,
                    "variationTotal": variation_total,
                }),
            )?;
            backend.start(&settings)?;
        }
    }

    let client = AceClient::new(settings.backend_port)?;
    client.health()?;
    let sink = TauriGenerationEventSink { app: &app };
    state.generation_runner().generate(&client, &sink, &settings, request)
}

#[cfg(test)]
mod tests {
    use crate::models::generation::GenerationRequest;
    use crate::services::generation_task::request_for_variation;
    use std::collections::HashSet;

    fn sample_request() -> GenerationRequest {
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
            model: Some("acestep-v15-turbo".to_owned()),
            task_type: "text2music".to_owned(),
            lm_model_path: Some("acestep-5Hz-lm-0.6B".to_owned()),
            lm_backend: Some("mlx".to_owned()),
            thinking: true,
            inference_steps: 8,
            guidance_scale: 7.0,
            use_format: false,
            use_cot_caption: true,
            use_cot_language: true,
            constrained_decoding: true,
            reference_audio_path: None,
            src_audio_path: None,
            instruction: None,
            repainting_start: None,
            repainting_end: None,
            audio_cover_strength: None,
            use_random_seed: false,
            seed: Some(41),
            variation_count: 3,
        }
    }

    #[test]
    fn variation_requests_get_distinct_manual_seeds() {
        let request = sample_request();
        let mut used = HashSet::new();

        let first = request_for_variation(&request, 1, &mut used);
        let second = request_for_variation(&request, 2, &mut used);
        let third = request_for_variation(&request, 3, &mut used);

        assert_eq!(first.seed, Some(41));
        assert_eq!(second.seed, Some(42));
        assert_eq!(third.seed, Some(43));
        assert!(!first.use_random_seed);
    }
}
