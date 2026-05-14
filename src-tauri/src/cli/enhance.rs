use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, generation::GenerationRequest},
    services::ace_client::AceClient,
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let help = flag(args, "--help") || flag(args, "-h");
    if help {
        print_help();
        return Ok(());
    }

    let json = flag(args, "--json");

    let lyrics = value(args, "--lyrics").or_else(|| value(args, "-l"));
    let duration: Option<f64> = value(args, "--duration")
        .or_else(|| value(args, "-d"))
        .and_then(|s| s.parse().ok());

    // Parse prompt — join remaining positional args that aren't flag values
    let prompt = {
        let mut skip_next = false;
        let mut parts: Vec<String> = Vec::new();
        for arg in args.iter().skip(1) {
            if skip_next {
                skip_next = false;
                continue;
            }
            if flag_like(arg) {
                if needs_value(arg) {
                    skip_next = true;
                }
                continue;
            }
            parts.push(arg.clone());
        }
        parts.join(" ")
    };

    if prompt.is_empty() {
        return Err(cli_error(
            "prompt is required. Usage: openloop enhance <prompt>",
        ));
    }

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
        prompt: prompt.clone(),
        negative_prompt: None,
        lyrics: lyrics.unwrap_or_default(),
        vocal_language: "en".to_owned(),
        duration_seconds: duration.unwrap_or(30.0),
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
    if let Ok(mut backend) = state.backend.lock() {
        backend.detach();
    }

    Ok(())
}

fn flag(args: &[String], name: &str) -> bool {
    args.iter().any(|a| a == name)
}

fn value(args: &[String], name: &str) -> Option<String> {
    for i in 0..args.len() {
        if args[i] == name {
            return args.get(i + 1).filter(|v| !v.starts_with('-')).cloned();
        }
    }
    None
}

fn flag_like(arg: &str) -> bool {
    arg.starts_with('-')
}

fn needs_value(arg: &str) -> bool {
    matches!(arg, "--lyrics" | "-l" | "--duration" | "-d")
}

fn print_help() {
    human_output(
        "\
openloop enhance — Enhance a prompt via ACE-Step format_input

Sends a prompt to the ACE-Step backend for enhancement. Returns the
enhanced caption together with any extracted structured fields such
as BPM, key, time signature, duration, language, and lyrics.

Usage:
  openloop enhance [flags] <prompt>

Flags:
  -d, --duration    Duration in seconds (10-600)
  -l, --lyrics      Include lyrics in the request
  --json            JSON output of enhancement result
  -h, --help        Show help

Examples:
  openloop enhance \"warm piano\"
  openloop enhance \"upbeat pop\" --duration 120 --json
  openloop enhance \"ballad\" --lyrics \"[Verse]\\nHello\"",
    );
}
