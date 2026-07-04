use std::io::IsTerminal;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use chrono::Utc;
use uuid::Uuid;

use crate::{
    cli::{cli_error, human_output},
    models::{
        errors::AppResult,
        generation::{GenerationRecord, GenerationRequest},
        settings::ModelVariant,
    },
    services::{
        ace_client::AceClient, file_store::FileStore, generation_task::GenerationTaskRunner,
        model_bootstrap::descriptor_for,
    },
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());
    if help {
        print_help();
        return Ok(());
    }

    let json = flag(args, "--json");
    let no_thinking = flag(args, "--no-thinking");
    let from_history = value(args, "--from-history");

    // Load generation from history if --from-history is specified
    let history_record =
        match &from_history {
            Some(history_id) => Some(state.db.get_generation(history_id)?.ok_or_else(|| {
                cli_error(format!("generation '{history_id}' not found in history"))
            })?),
            None => None,
        };

    let model = value(args, "--model").or_else(|| value(args, "-m"));
    let duration: Option<f64> = value(args, "--duration")
        .or_else(|| value(args, "-d"))
        .and_then(|s| s.parse().ok());
    let format = value(args, "--format").or_else(|| value(args, "-f"));
    let output = value(args, "--output").or_else(|| value(args, "-o"));
    let lyrics = value(args, "--lyrics").or_else(|| value(args, "-l"));
    let bpm: Option<i64> = value(args, "--bpm").and_then(|s| s.parse().ok());
    let key = value(args, "--key");
    let steps: Option<i64> = value(args, "--steps").and_then(|s| s.parse().ok());
    let guidance: Option<f64> = value(args, "--guidance").and_then(|s| s.parse().ok());
    let seed: Option<i64> = value(args, "--seed").and_then(|s| s.parse().ok());
    let variations: Option<i64> = value(args, "--variations")
        .or_else(|| value(args, "-v"))
        .and_then(|s| s.parse().ok());

    // Find prompt — first positional arg that isn't a flag value
    let mut prompt = {
        let mut skip_next = false;
        let mut prompt = String::new();
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
            if prompt.is_empty() {
                prompt = arg.clone();
            }
        }
        prompt
    };

    // Apply history record values as fallbacks for unset CLI flags
    if prompt.is_empty() {
        if let Some(ref record) = history_record {
            prompt = record.prompt.clone();
        }
    }
    let model = model.or_else(|| {
        history_record
            .as_ref()
            .and_then(|r| map_model_to_variant(r.model.as_deref()))
    });
    let duration = duration.or_else(|| history_record.as_ref().map(|r| r.duration_seconds));
    let format = format.or_else(|| history_record.as_ref().map(|r| r.audio_format.clone()));
    let lyrics = lyrics.or_else(|| {
        history_record.as_ref().and_then(|r| {
            if r.lyrics.is_empty() {
                None
            } else {
                Some(r.lyrics.clone())
            }
        })
    });
    let bpm = bpm.or_else(|| history_record.as_ref().and_then(|r| r.bpm));
    let key = key.or_else(|| history_record.as_ref().and_then(|r| r.key_scale.clone()));
    let steps = steps.or_else(|| history_record.as_ref().map(|r| r.inference_steps));
    let guidance = guidance.or_else(|| history_record.as_ref().map(|r| r.guidance_scale));
    let seed = seed.or_else(|| history_record.as_ref().and_then(|r| r.seed));

    if prompt.is_empty() {
        return Err(cli_error(
            "prompt is required. Usage: openloop run <prompt> [--from-history <id>]",
        ));
    }

    let settings = state.db.get_settings()?;
    let port = {
        let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;

        // Auto-bootstrap backend
        let backend_status = backend.start(&settings)?;
        match &backend_status {
            crate::models::backend::BackendStatus::Healthy { port } => *port,
            _ => return Err(cli_error("backend is not healthy")),
        }
    };

    // Build GenerationRequest
    let model_variant: Option<ModelVariant> = match model.as_deref() {
        Some("lite") => Some(ModelVariant::Lite),
        Some("turbo") => Some(ModelVariant::Turbo),
        Some("pro") => Some(ModelVariant::Pro),
        Some(other) => return Err(cli_error(format!("unknown model variant: {other}"))),
        None => settings.model_variant,
    };

    let audio_format = format
        .clone()
        .or_else(|| Some(settings.default_audio_format.clone()))
        .unwrap_or_else(|| "wav".to_owned());

    let (model_name, lm_model_path) = model_variant
        .map(|v| {
            let d = descriptor_for(v)?;
            Ok((
                Some(d.model_name.to_owned()),
                d.lm_model.map(|s| s.to_owned()),
            ))
        })
        .transpose()?
        .unwrap_or((None, None));

    let request = GenerationRequest {
        prompt: prompt.clone(),
        negative_prompt: None,
        lyrics: lyrics.unwrap_or_default(),
        vocal_language: "en".to_owned(),
        duration_seconds: duration.unwrap_or(settings.default_duration_seconds),
        bpm,
        key_scale: key,
        time_signature: "4".to_owned(),
        audio_format: audio_format.clone(),
        model: model_name,
        task_type: "text2music".to_owned(),
        lm_model_path,
        lm_backend: Some("mlx".to_owned()),
        thinking: !no_thinking && settings.default_thinking,
        inference_steps: steps.unwrap_or(8),
        guidance_scale: guidance.unwrap_or(7.0),
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
        use_random_seed: seed.is_none(),
        seed,
        variation_count: variations.unwrap_or(1),
    };

    request.validate()?;

    if !json {
        human_output("♫ Generating music…");
        human_output(&format!(
            "  Prompt: \"{}\" | Duration: {}s | Format: {}",
            &request.prompt, request.duration_seconds as i64, request.audio_format
        ));
    }

    let client = AceClient::new(port)?;
    let file_store = FileStore::new(state.app_data_dir.clone());
    let cancelled = state.generation_cancelled.clone();
    cancelled.store(false, Ordering::SeqCst);

    let runner = GenerationTaskRunner::new(state.db.clone(), file_store, cancelled.clone());

    let sink = CliGenerationSink {
        json,
        is_tty: std::io::stderr().is_terminal(),
        cancelled: cancelled.clone(),
    };

    // Resolve output directory for --output flag
    let mut gen_settings = settings.clone();
    if let Some(out) = &output {
        if let Some(parent) = std::path::Path::new(out).parent() {
            if parent != std::path::Path::new("") {
                gen_settings.output_directory = Some(parent.display().to_string());
            } else {
                gen_settings.output_directory = Some(".".to_owned());
            }
        }
    }

    let result = runner.generate(&client, &sink, &gen_settings, request)?;

    if result.records.is_empty() {
        if json {
            super::json_output(r#"{"event":"cancelled"}"#);
        }
        return Ok(());
    }

    // Terminate progress line before printing completion
    if !json {
        eprintln!();
    }

    // Handle output path renaming if --output specified
    for (i, record) in result.records.iter().enumerate() {
        let final_path = resolve_output_path(&output, record, i + 1, result.records.len());
        if let (Some(src), Some(dst)) = (&record.output_path, final_path) {
            if *src != dst {
                std::fs::rename(src, &dst)
                    .map_err(|e| cli_error(format!("failed to move output: {e}")))?;

                // Update the record in DB with new path
                let mut updated = record.clone();
                updated.output_path = Some(dst.clone());
                state.db.insert_generation(&updated)?;

                if json {
                    super::json_output(&format!(
                        r#"{{"event":"completed","output_path":"{}","duration":{},"format":"{}"}}"#,
                        dst, record.duration_seconds, record.audio_format
                    ));
                } else {
                    human_output(&format!(
                        "✓ Generated: {} ({}s)",
                        dst, record.duration_seconds as i64
                    ));
                }
            } else if json {
                super::json_output(&format!(
                    r#"{{"event":"completed","output_path":"{}","duration":{},"format":"{}"}}"#,
                    src, record.duration_seconds, record.audio_format
                ));
            } else {
                human_output(&format!(
                    "✓ Generated: {} ({}s)",
                    record.output_path.as_deref().unwrap_or("unknown"),
                    record.duration_seconds as i64,
                ));
            }
        }
    }

    // Detach the backend so it keeps running after this CLI command exits
    if let Ok(mut backend) = state.backend.lock() {
        backend.detach();
    }

    Ok(())
}

fn resolve_output_path(
    output_flag: &Option<String>,
    record: &GenerationRecord,
    variation_index: usize,
    variation_total: usize,
) -> Option<String> {
    let base = match output_flag {
        Some(path) => {
            let p = std::path::Path::new(path);
            if path.ends_with('/') {
                // Directory: auto-generate filename
                let ext = &record.audio_format;
                let filename = format!(
                    "openloop-{}-{}.{}",
                    Utc::now().format("%Y%m%d-%H%M%S"),
                    Uuid::new_v4(),
                    ext
                );
                p.join(filename).display().to_string()
            } else if p.extension().is_some() {
                // File with extension
                if variation_total > 1 {
                    let stem = p.file_stem().unwrap_or_default().to_string_lossy();
                    let ext = p.extension().unwrap_or_default().to_string_lossy();
                    let parent = p
                        .parent()
                        .map(|pp| pp.display().to_string())
                        .unwrap_or_else(|| ".".to_owned());
                    std::path::Path::new(&parent)
                        .join(format!("{}-{}.{}", stem, variation_index, ext))
                        .display()
                        .to_string()
                } else {
                    path.clone()
                }
            } else {
                // No extension — just append format
                format!("{}.{}", path, record.audio_format)
            }
        }
        None => record.output_path.clone().unwrap_or_default(),
    };
    Some(base)
}

struct CliGenerationSink {
    json: bool,
    is_tty: bool,
    cancelled: Arc<AtomicBool>,
}

impl crate::services::generation_task::GenerationEventSink for CliGenerationSink {
    fn emit_generation_event(&self, payload: serde_json::Value) -> AppResult<()> {
        if self.cancelled.load(Ordering::SeqCst) {
            return Ok(());
        }

        if self.json {
            let event_type = payload
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let variation = payload
                .get("variationCurrent")
                .and_then(|v| v.as_i64())
                .unwrap_or(1);
            let total = payload
                .get("variationTotal")
                .and_then(|v| v.as_i64())
                .unwrap_or(1);

            match event_type {
                "submitted" => {
                    let task_id = payload.get("taskId").and_then(|v| v.as_str()).unwrap_or("");
                    super::json_output(&format!(
                        r#"{{"event":"submitted","task_id":"{task_id}"}}"#
                    ));
                }
                "queued" => {
                    super::json_output(&format!(
                        r#"{{"event":"queued","variation":{variation},"total":{total}}}"#
                    ));
                }
                "running" => {
                    super::json_output(&format!(
                        r#"{{"event":"running","variation":{variation},"total":{total}}}"#
                    ));
                }
                "downloading" => {
                    super::json_output(&format!(
                        r#"{{"event":"downloading","variation":{variation},"total":{total}}}"#
                    ));
                }
                "completed" => {
                    // Suppressed: the post-generation loop emits the final
                    // "completed" event with the correct (possibly renamed) path.
                }
                "cancelled" => {
                    super::json_output(r#"{"event":"cancelled"}"#);
                }
                _ => {}
            }
        } else {
            let event_type = payload
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            match event_type {
                "submitted" => {
                    // silent for human mode
                }
                "queued" | "running" => {
                    let variation = payload
                        .get("variationCurrent")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(1);
                    let total = payload
                        .get("variationTotal")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(1);
                    if self.is_tty {
                        eprint!("\r  Generating variation {variation}/{total}…");
                    } else {
                        eprintln!("  Generating variation {variation}/{total}…");
                    }
                }
                "downloading" => {
                    if self.is_tty {
                        eprint!("\r  Downloading audio…");
                    } else {
                        eprintln!("  Downloading audio…");
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }
}

/// Map a model name (e.g. "ACE-Step-1.5-turbo") to the variant string.
fn map_model_to_variant(model_name: Option<&str>) -> Option<String> {
    match model_name? {
        "ACE-Step-1.5-lite" | "mlx-community/ACE-Step-1.5-lite" => Some("lite".to_owned()),
        "ACE-Step-1.5-turbo" | "mlx-community/ACE-Step-1.5-turbo" => Some("turbo".to_owned()),
        "ACE-Step-1.5-pro" | "mlx-community/ACE-Step-1.5-pro" => Some("pro".to_owned()),
        _ => None,
    }
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
    matches!(
        arg,
        "--model"
            | "-m"
            | "--duration"
            | "-d"
            | "--format"
            | "-f"
            | "--output"
            | "-o"
            | "--lyrics"
            | "-l"
            | "--bpm"
            | "--key"
            | "--steps"
            | "--guidance"
            | "--seed"
            | "--variations"
            | "-v"
            | "--limit"
            | "--from-history"
    )
}

fn print_help() {
    human_output(
        "\
openloop run — Generate music

Usage:
  openloop run [flags] <prompt>

Flags:
  -m, --model       Model variant (lite/turbo/pro)
  -d, --duration    Duration in seconds (10-600)
  -f, --format      Audio format (wav/mp3/flac/ogg)
  -o, --output      Output file path
  -l, --lyrics      Lyrics text
  --bpm             BPM (30-300)
  --key             Key and scale (e.g., \"C major\")
  --steps           Inference steps
  --guidance        Guidance scale
  --seed            Random seed
  -v, --variations  Number of variations (1-4)
  --no-thinking     Disable thinking mode
  --from-history    Replay a previous generation by ID
  --json            NDJSON streaming output
  -h, --help        Show help

Examples:
  openloop run \"upbeat electronic track\"
  openloop run \"sad piano\" --duration 60 --format mp3 --output ./sad.mp3
  openloop run \"pop song\" --lyrics \"[verse]\\nHello\\n[chorus]\\nWorld\"
  openloop run \"epic cinematic\" --json
  openloop run --from-history <id>",
    );
}
