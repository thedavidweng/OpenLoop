use std::{sync::atomic::Ordering, thread, time::Duration};

use chrono::Utc;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::{
    models::{
        backend::BackendStatus,
        errors::{AppError, AppResult},
        generation::{GenerationRecord, GenerationRequest},
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
pub async fn generate_music(
    app: AppHandle,
    state: State<'_, AppState>,
    request: GenerationRequest,
) -> AppResult<GenerationRecord> {
    request.validate()?;
    state.generation_cancelled.store(false, Ordering::SeqCst);

    let settings = state.db.get_settings()?;

    {
        let mut backend = state
            .backend
            .lock()
            .map_err(|_| AppError::internal("backend manager lock poisoned"))?;
        if !matches!(backend.status(), BackendStatus::Healthy { .. }) {
            emit_generation_event(&app, serde_json::json!({ "type": "backend_starting" }))?;
            backend.start(&settings)?;
        }
    }

    let client = AceClient::new(settings.backend_port)?;
    client.health()?;

    let released = client.release_task(&request)?;
    emit_generation_event(
        &app,
        serde_json::json!({ "type": "submitted", "taskId": released.task_id }),
    )?;

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
            emit_generation_event(
                &app,
                serde_json::json!({ "type": "cancelled", "generationId": persisted.id }),
            )?;
            state.generation_cancelled.store(false, Ordering::SeqCst);
            return Ok(persisted);
        }

        let results = client.query_result(vec![released.task_id.clone()])?;
        let result = results
            .into_iter()
            .next()
            .ok_or_else(|| AppError::task_failed("query_result returned no tasks"))?;

        match result.state {
            AceTaskState::Running => {
                emit_generation_event(
                    &app,
                    serde_json::json!({
                        "type": if first_running_state { "queued" } else { "running" }
                    }),
                )?;
                first_running_state = false;
                thread::sleep(Duration::from_secs(2));
            }
            AceTaskState::Succeeded { file_path } => {
                emit_generation_event(&app, serde_json::json!({ "type": "downloading" }))?;
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
                emit_generation_event(
                    &app,
                    serde_json::json!({
                        "type": "completed",
                        "generationId": persisted.id,
                        "outputPath": output_path,
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
                emit_generation_event(
                    &app,
                    serde_json::json!({ "type": "failed", "error": error.clone() }),
                )?;
                return Err(error);
            }
        }
    }
}
