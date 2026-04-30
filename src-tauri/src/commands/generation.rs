use std::{collections::HashSet, sync::atomic::Ordering, thread, time::Duration};

use chrono::Utc;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

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
        ace_client::{AceClient, AceTaskState},
        file_store::FileStore,
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
    app.emit("generation-event", payload)
        .map_err(|error| AppError::internal(error.to_string()))
}

fn build_generation_record(
    request: &GenerationRequest,
    status: &str,
    output_path: Option<String>,
    error_message: Option<String>,
    generation_info: Option<String>,
) -> GenerationRecord {
    GenerationRecord {
        id: Uuid::new_v4().to_string(),
        created_at: Utc::now().to_rfc3339(),
        prompt: request.prompt.clone(),
        lyrics: request.lyrics.clone(),
        vocal_language: request.vocal_language.clone(),
        duration_seconds: request.duration_seconds,
        bpm: request.bpm,
        key_scale: request.key_scale.clone(),
        time_signature: request.time_signature.clone(),
        model: request.model.clone(),
        lm_model: request.lm_model_path.clone(),
        thinking: request.thinking,
        inference_steps: request.inference_steps,
        guidance_scale: request.guidance_scale,
        use_random_seed: request.use_random_seed,
        seed: request.seed,
        audio_format: request.audio_format.clone(),
        output_path,
        status: status.to_owned(),
        error_message,
        generation_info,
    }
}

#[tauri::command]
pub fn cancel_generation(state: State<'_, AppState>) -> AppResult<()> {
    state.generation_cancelled.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn list_active_generation_tasks(
    state: State<'_, AppState>,
) -> AppResult<Vec<ActiveGenerationTask>> {
    state.db.list_active_generation_tasks()
}

#[tauri::command]
pub fn discard_active_generation_task(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.db.delete_active_generation_task(&id)
}

#[tauri::command]
pub async fn enhance_prompt(
    state: State<'_, AppState>,
    request: GenerationRequest,
) -> AppResult<PromptEnhancementResult> {
    request.validate()?;
    let settings = state.db.get_settings()?;
    {
        let mut backend = state
            .backend
            .lock()
            .map_err(|_| AppError::internal("backend manager lock poisoned"))?;
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
        let mut backend = state
            .backend
            .lock()
            .map_err(|_| AppError::internal("backend manager lock poisoned"))?;
        if !matches!(backend.status(), BackendStatus::Healthy { .. }) {
            return Err(AppError::task_failed(
                "active task can only be resumed while the ACE-Step backend is still healthy",
            ));
        }
    }
    let client = AceClient::new(settings.backend_port)?;
    client.health()?;
    run_released_task(
        &app,
        &state,
        &client,
        &settings,
        active.request.clone(),
        active.task_id.clone(),
        active.variation_index,
        active.variation_total,
        Some(active.id.clone()),
    )
}

#[tauri::command]
pub async fn generate_music(
    app: AppHandle,
    state: State<'_, AppState>,
    request: GenerationRequest,
) -> AppResult<GenerationRunResult> {
    request.validate()?;
    state.generation_cancelled.store(false, Ordering::SeqCst);

    let settings = state.db.get_settings()?;
    let variation_total = request.variation_count;

    {
        let mut backend = state
            .backend
            .lock()
            .map_err(|_| AppError::internal("backend manager lock poisoned"))?;
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
    let mut records = Vec::new();
    let mut used_seeds = HashSet::new();

    for variation_index in 1..=variation_total {
        if state.generation_cancelled.load(Ordering::SeqCst) {
            break;
        }

        let variant_request = request_for_variation(&request, variation_index, &mut used_seeds);
        let released = client.release_task(&variant_request)?;
        let active_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let active = ActiveGenerationTask {
            id: active_id.clone(),
            task_id: released.task_id.clone(),
            request: variant_request.clone(),
            variation_index,
            variation_total,
            created_at: now.clone(),
            updated_at: now,
        };
        state.db.upsert_active_generation_task(&active)?;
        emit_generation_event(
            &app,
            serde_json::json!({
                "type": "submitted",
                "taskId": released.task_id,
                "variationCurrent": variation_index,
                "variationTotal": variation_total,
            }),
        )?;

        let record = run_released_task(
            &app,
            &state,
            &client,
            &settings,
            variant_request,
            active.task_id,
            variation_index,
            variation_total,
            Some(active_id),
        )?;
        let cancelled = record.status == "cancelled";
        records.push(record);
        if cancelled {
            break;
        }
    }

    state.generation_cancelled.store(false, Ordering::SeqCst);
    Ok(GenerationRunResult { records })
}

fn run_released_task(
    app: &AppHandle,
    state: &AppState,
    client: &AceClient,
    settings: &crate::models::settings::AppSettings,
    request: GenerationRequest,
    task_id: String,
    variation_index: i64,
    variation_total: i64,
    active_id: Option<String>,
) -> AppResult<GenerationRecord> {
    let mut first_running_state = true;

    loop {
        if state.generation_cancelled.load(Ordering::SeqCst) {
            let record = build_generation_record(
                &request,
                "cancelled",
                None,
                Some("Cancelled by user".to_owned()),
                None,
            );
            let persisted = state.db.insert_generation(&record)?;
            if let Some(active_id) = &active_id {
                state.db.delete_active_generation_task(active_id)?;
            }
            emit_generation_event(
                app,
                serde_json::json!({
                    "type": "cancelled",
                    "generationId": persisted.id,
                    "variationCurrent": variation_index,
                    "variationTotal": variation_total,
                }),
            )?;
            return Ok(persisted);
        }

        let results = client.query_result(vec![task_id.clone()])?;
        let result = results
            .into_iter()
            .next()
            .ok_or_else(|| AppError::task_failed("query_result returned no tasks"))?;

        match result.state {
            AceTaskState::Running => {
                emit_generation_event(
                    app,
                    serde_json::json!({
                        "type": if first_running_state { "queued" } else { "running" },
                        "variationCurrent": variation_index,
                        "variationTotal": variation_total,
                    }),
                )?;
                first_running_state = false;
                thread::sleep(Duration::from_secs(2));
            }
            AceTaskState::Succeeded { file_path } => {
                emit_generation_event(
                    app,
                    serde_json::json!({
                        "type": "downloading",
                        "variationCurrent": variation_index,
                        "variationTotal": variation_total,
                    }),
                )?;
                let bytes = client.download_audio(&file_path)?;
                let file_store = FileStore::new(state.app_data_dir.clone());
                let output_path =
                    file_store.write_audio(bytes, &request.audio_format, &settings)?;

                let record = build_generation_record(
                    &request,
                    "completed",
                    Some(output_path.clone()),
                    None,
                    result.raw_result.map(|value| value.to_string()),
                );
                let persisted = state.db.insert_generation(&record)?;
                if let Some(active_id) = &active_id {
                    state.db.delete_active_generation_task(active_id)?;
                }
                emit_generation_event(
                    app,
                    serde_json::json!({
                        "type": "completed",
                        "generationId": persisted.id,
                        "outputPath": output_path,
                        "variationCurrent": variation_index,
                        "variationTotal": variation_total,
                    }),
                )?;
                return Ok(persisted);
            }
            AceTaskState::Failed { error } => {
                let record = build_generation_record(
                    &request,
                    "failed",
                    None,
                    Some(error.message.clone()),
                    result.raw_result.map(|value| value.to_string()),
                );
                let _persisted = state.db.insert_generation(&record)?;
                if let Some(active_id) = &active_id {
                    state.db.delete_active_generation_task(active_id)?;
                }
                emit_generation_event(
                    app,
                    serde_json::json!({ "type": "failed", "error": error.clone() }),
                )?;
                return Err(error);
            }
        }
    }
}

pub fn request_for_variation(
    request: &GenerationRequest,
    variation_index: i64,
    used_seeds: &mut HashSet<i64>,
) -> GenerationRequest {
    if request.variation_count <= 1 {
        return request.clone();
    }

    let mut variant = request.clone();
    let seed = variant_seed(request.seed, variation_index, used_seeds);
    variant.use_random_seed = false;
    variant.seed = Some(seed);
    variant
}

fn variant_seed(
    base_seed: Option<i64>,
    variation_index: i64,
    used_seeds: &mut HashSet<i64>,
) -> i64 {
    const MIN: i64 = -2_147_483_648;
    const MAX: i64 = 2_147_483_647;
    let mut candidate = match base_seed {
        Some(seed) => seed.saturating_add(variation_index - 1),
        None => (Uuid::new_v4().as_u128() & 0x7fff_ffff) as i64,
    };
    if candidate > MAX {
        candidate = MIN + (candidate - MAX - 1);
    }
    if candidate < MIN {
        candidate = MAX - (MIN - candidate - 1);
    }
    while used_seeds.contains(&candidate) {
        candidate += 1;
        if candidate > MAX {
            candidate = MIN;
        }
    }
    used_seeds.insert(candidate);
    candidate
}

#[cfg(test)]
mod tests {
    use super::request_for_variation;
    use crate::models::generation::GenerationRequest;
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
