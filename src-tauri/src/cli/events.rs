use std::io::IsTerminal;

use chrono::Utc;
use serde_json::Value;

use crate::models::errors::AppError;

/// Unified CLI event schema version.
const EVENT_SCHEMA_VERSION: u8 = 1;

/// Whether the current output is a TTY (controls spinner/emoji mode).
fn is_interactive() -> bool {
    std::io::stdout().is_terminal()
}

/// Build the shared envelope for every event.
fn envelope(kind: &str, extra: Value) -> Value {
    let mut obj = serde_json::json!({
        "v": EVENT_SCHEMA_VERSION,
        "ts": Utc::now().to_rfc3339(),
        "kind": kind,
    });
    if let Value::Object(ref mut map) = obj {
        if let Value::Object(extra_map) = extra {
            map.extend(extra_map);
        }
    }
    obj
}

/// Emit a lifecycle event to stdout as a single JSON line (NDJSON).
pub fn emit_lifecycle(phase: &str, port: Option<u16>, ownership: &str, message: &str) {
    let event = envelope(
        "lifecycle",
        serde_json::json!({
            "phase": phase,
            "port": port,
            "ownership": ownership,
            "message": message,
        }),
    );
    println!("{}", serde_json::to_string(&event).unwrap_or_default());
}

/// Emit a progress event to stdout as NDJSON.
pub fn emit_progress(pct: Option<u8>, label: &str, detail: Option<&str>) {
    let event = envelope(
        "progress",
        serde_json::json!({
            "pct": pct,
            "label": label,
            "detail": detail,
        }),
    );
    println!("{}", serde_json::to_string(&event).unwrap_or_default());
}

/// Emit a result event to stdout as NDJSON.
pub fn emit_result(data: Value) {
    let event = envelope("result", data);
    println!("{}", serde_json::to_string(&event).unwrap_or_default());
}

/// Emit an error event to stderr as NDJSON. Always output even in non-streaming mode.
pub fn emit_error(error: &AppError, recoverable: bool, suggestion: Option<&str>) {
    let event = envelope(
        "error",
        serde_json::json!({
            "code": error.code,
            "message": error.message,
            "recoverable": recoverable,
            "suggestion": suggestion,
        }),
    );
    eprintln!("{}", serde_json::to_string(&event).unwrap_or_default());
}

/// Print a human-readable lifecycle message (to stderr so stdout stays clean for data).
pub fn human_lifecycle(phase: &str, message: &str) {
    if is_interactive() {
        eprintln!("  ♪ {phase}: {message}");
    } else {
        eprintln!("  {phase}: {message}");
    }
}

/// Print a human-readable progress line (to stderr).
pub fn human_progress(label: &str, detail: Option<&str>) {
    let line = match detail {
        Some(d) => format!("  {label}: {d}"),
        None => format!("  {label}"),
    };
    if is_interactive() {
        eprint!("\r{line}");
    } else {
        eprintln!("{line}");
    }
}

/// Print a human-readable success/tick message.
pub fn human_success(message: &str) {
    eprintln!("\x1b[32m✓\x1b[0m {message}");
}

/// Print a human-readable error message.
pub fn human_error(message: &str) {
    eprintln!("\x1b[31m✗\x1b[0m Error: {message}");
}

/// Print a human-readable warning message.
pub fn human_warn(message: &str) {
    eprintln!("\x1b[33m⚠\x1b[0m {message}");
}

/// Print a human-readable info message.
pub fn human_info(message: &str) {
    eprintln!("  {message}");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_event_has_required_fields() {
        let json = serde_json::from_str::<Value>(
            &serde_json::to_string(&envelope(
                "lifecycle",
                serde_json::json!({"phase": "test", "port": null, "ownership": "none", "message": "test"}),
            ))
            .unwrap(),
        )
        .unwrap();
        assert_eq!(json["v"], 1);
        assert_eq!(json["kind"], "lifecycle");
        assert!(json["ts"].as_str().unwrap().len() > 10);
        assert_eq!(json["phase"], "test");
    }

    #[test]
    fn error_event_includes_code_and_suggestion() {
        let error = AppError::internal("test error");
        let json = serde_json::from_str::<Value>(
            &serde_json::to_string(&envelope(
                "error",
                serde_json::json!({
                    "code": error.code,
                    "message": error.message,
                    "recoverable": true,
                    "suggestion": "run openloop doctor",
                }),
            ))
            .unwrap(),
        )
        .unwrap();
        assert_eq!(json["kind"], "error");
        assert_eq!(json["code"], "INTERNAL_ERROR");
        assert_eq!(json["suggestion"], "run openloop doctor");
    }

    #[test]
    fn progress_event_pct_is_optional() {
        let event = envelope(
            "progress",
            serde_json::json!({
                "pct": null,
                "label": "downloading",
                "detail": null,
            }),
        );
        let json: Value = serde_json::from_str(&serde_json::to_string(&event).unwrap()).unwrap();
        assert_eq!(json["kind"], "progress");
        assert!(json["pct"].is_null());
    }
}
