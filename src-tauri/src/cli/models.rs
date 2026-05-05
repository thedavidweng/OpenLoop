use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, settings::ModelVariant},
    services::model_manager::ACE_MODEL_DESCRIPTORS,
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    let settings = state.db.get_settings()?;

    if json {
        let mut items = Vec::new();
        for descriptor in ACE_MODEL_DESCRIPTORS {
            let is_downloaded = settings.downloaded_models.contains(&descriptor.variant);
            let is_active = settings.model_variant == Some(descriptor.variant);

            items.push(serde_json::json!({
                "variant": variant_str(descriptor.variant),
                "size_gb": descriptor.recommended_memory_gb,
                "status": if is_downloaded { "downloaded" } else { "not_downloaded" },
                "active": is_active,
            }));
        }
        let output = serde_json::to_string_pretty(&items).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
    } else {
        println!(
            "{:<10} {:<8} {:<12} {}",
            "Variant", "Size", "Status", "Description"
        );
        let separator = "-".repeat(70);
        println!("{separator}");

        for descriptor in ACE_MODEL_DESCRIPTORS {
            let is_downloaded = settings.downloaded_models.contains(&descriptor.variant);
            let is_active = settings.model_variant == Some(descriptor.variant);

            let status = if is_active {
                "● active"
            } else if is_downloaded {
                "downloaded"
            } else {
                "—"
            };

            let size = format!("{}GB", descriptor.recommended_memory_gb);

            println!(
                "{:<10} {:<8} {:<12} {}",
                variant_label(descriptor.variant),
                size,
                status,
                descriptor.description
            );
        }
    }

    Ok(())
}

fn variant_str(variant: ModelVariant) -> &'static str {
    match variant {
        ModelVariant::Lite => "lite",
        ModelVariant::Turbo => "turbo",
        ModelVariant::Pro => "pro",
    }
}

fn variant_label(variant: ModelVariant) -> &'static str {
    match variant {
        ModelVariant::Lite => "Lite",
        ModelVariant::Turbo => "Turbo",
        ModelVariant::Pro => "Pro",
    }
}

fn print_help() {
    human_output(
        "\
openloop models — List available and downloaded models

Usage:
  openloop models [flags]

Flags:
  --json    JSON array output
  --help    Show help",
    );
}
