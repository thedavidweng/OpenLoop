//! Guards the launch-flash fix in the Tauri window configuration.
//!
//! The main window must start hidden with a dark background so users never
//! see the WebView's default white surface while the frontend loads; the
//! frontend reveals the window via the `window_ready` command once the first
//! real app screen commits. These assertions fail if a window object stops
//! carrying the keys that make that protection work.

use serde_json::Value;
use std::fs;
use std::path::Path;

fn windows_array() -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
    let raw = fs::read_to_string(&path).unwrap_or_else(|error| {
        panic!("failed to read {}: {error}", path.display());
    });
    let config: Value = serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("failed to parse {}: {error}", path.display()));

    config
        .get("app")
        .and_then(|app| app.get("windows"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| panic!("{} declares no app.windows array", path.display()))
}

#[test]
fn every_window_starts_hidden_so_the_webview_load_is_never_shown() {
    for window in windows_array() {
        assert_eq!(
            window.get("visible"),
            Some(&Value::Bool(false)),
            "window must set visible:false so the webview load happens off-screen \
             and the frontend reveals it via window_ready"
        );
    }
}

#[test]
fn every_window_pins_the_dark_shell_background() {
    for window in windows_array() {
        assert_eq!(
            window.get("backgroundColor").and_then(Value::as_str),
            Some("#121212"),
            "window must pin backgroundColor to the app shell's dark surface so \
             nothing brighter than the UI can be exposed before first paint"
        );
    }
}

#[test]
fn every_window_centers_on_first_launch() {
    for window in windows_array() {
        assert_eq!(
            window.get("center"),
            Some(&Value::Bool(true)),
            "window must set center:true; a hidden window that reveals off-center \
             looks broken on first launch"
        );
    }
}
