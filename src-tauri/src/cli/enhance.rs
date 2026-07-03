use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, generation::GenerationRequest},
    services::ace_client::AceClient,
};

use super::AppState;
use crate::cli::spec::EnhanceArgs;

pub fn execute(state: &AppState, json: bool, args: EnhanceArgs) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;

    // Auto-start backend if not already healthy
    let backend_status = backend.start(&settings)?;
    let port = match &backend_status {
        crate::models::backend::BackendStatus::Healthy { port } => *port,
        _ => return Err(cli_error("backend is not healthy")),
    };
    drop(backend);

    let client = AceClient::new(port)?;
    client.health()?;

    let request = GenerationRequest {
        prompt: args.prompt.clone(),
        negative_prompt: None,
        lyrics: args.lyrics.unwrap_or_default(),
        vocal_language: "en".to_owned(),
        duration_seconds: args.duration.unwrap_or(30.0),
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
        use_cot_caption: true,
        use_cot_language: true,
        constrained_decoding: true,
        reference_audio_path: None,
        src_audio_path: None,
        instruction: None,
        repainting_start: None,
        repainting_end: None,
        audio_cover_strength: None,
        use_random_seed: true,
        seed: None,
        variation_count: 1,
    };

    request.validate()?;

    let result = client.format_input(&request)?;

    if json {
        let output = serde_json::to_string_pretty(&result).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
    } else {
        human_output(&format!("Enhanced prompt: {}", result.prompt));

        if let Some(ref lyrics) = result.lyrics {
            if !lyrics.is_empty() {
                human_output("");
                human_output("Lyrics:");
                for line in lyrics.lines() {
                    human_output(&format!("  {}", line));
                }
            }
        }

        if let Some(bpm) = result.bpm {
            human_output(&format!("BPM: {}", bpm));
        }
        if let Some(ref key) = result.key_scale {
            human_output(&format!("Key: {}", key));
        }
        if let Some(ref time) = result.time_signature {
            human_output(&format!("Time signature: {}", time));
        }
        if let Some(duration) = result.duration_seconds {
            human_output(&format!("Duration: {}s", duration as i64));
        }
        if let Some(ref lang) = result.vocal_language {
            human_output(&format!("Language: {}", lang));
        }
    }

    // Detach the backend so it keeps running after this CLI command exits
    let was_owned = if let Ok(mut backend) = state.backend.lock() {
        let owned = backend.is_owned();
        backend.detach();
        owned
    } else {
        false
    };

    if !json && was_owned {
        human_output("Backend left running for subsequent commands.");
    }

    Ok(())
}
