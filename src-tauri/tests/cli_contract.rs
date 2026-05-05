use std::fs;

use openloop_lib::{
    app_state::AppState,
    models::{
        generation::GenerationRecord,
        settings::{AppSettings, ModelVariant},
    },
    services::{db::Database, file_store::FileStore, history::HistoryService},
};

fn sample_record(id: &str, output_path: Option<String>) -> GenerationRecord {
    GenerationRecord {
        id: id.to_owned(),
        created_at: "2026-05-04T12:00:00Z".to_owned(),
        prompt: "warm piano loop".to_owned(),
        lyrics: "".to_owned(),
        vocal_language: "en".to_owned(),
        duration_seconds: 30.0,
        bpm: None,
        key_scale: None,
        time_signature: "4".to_owned(),
        model: Some("acestep-v15-turbo".to_owned()),
        lm_model: Some("acestep-5Hz-lm-0.6B".to_owned()),
        thinking: true,
        inference_steps: 8,
        guidance_scale: 7.0,
        use_random_seed: true,
        seed: None,
        audio_format: "wav".to_owned(),
        output_path,
        status: "completed".to_owned(),
        error_message: None,
        generation_info: None,
    }
}

#[test]
fn app_state_init_creates_shared_database_and_services_without_tauri() {
    let app_dir = tempfile::tempdir().expect("app dir");
    let sidecar_dir = tempfile::tempdir().expect("sidecar dir");

    let state = AppState::init(
        app_dir.path().to_path_buf(),
        sidecar_dir.path().to_path_buf(),
    )
    .expect("app state should initialize outside Tauri");

    assert_eq!(state.app_data_dir, app_dir.path());
    assert!(state.db.get_settings().is_ok());
    assert!(state.backend.lock().is_ok());
    assert!(state.models.lock().is_ok());
}

#[test]
fn file_store_writes_ogg_bytes_directly_without_openloop_conversion() {
    let temp = tempfile::tempdir().expect("temp dir");
    let settings = AppSettings {
        output_directory: Some(temp.path().join("out").display().to_string()),
        ..AppSettings::default()
    };
    let store = FileStore::new(temp.path().to_path_buf());
    let native_ogg_bytes = b"native ogg bytes from ACE-Step".to_vec();

    let output_path = store
        .write_audio(native_ogg_bytes.clone(), "ogg", &settings)
        .expect("native OGG bytes should be written directly");

    assert_eq!(
        fs::read(output_path).expect("output file should read"),
        native_ogg_bytes
    );
}

#[test]
fn setup_key_value_updates_shared_settings() {
    let temp = tempfile::tempdir().expect("temp dir");
    let sidecar_dir = tempfile::tempdir().expect("sidecar dir");
    let state = AppState::init(temp.path().to_path_buf(), sidecar_dir.path().to_path_buf())
        .expect("app state");

    state
        .db
        .set_setting("modelVariant", serde_json::json!("turbo"))
        .expect("model should update");
    state
        .db
        .set_setting("defaultThinking", serde_json::json!(false))
        .expect("thinking should update");
    state
        .db
        .set_setting("defaultDurationSeconds", serde_json::json!(60.0))
        .expect("duration should update");
    state
        .db
        .set_setting("defaultAudioFormat", serde_json::json!("ogg"))
        .expect("format should update");

    let settings = state.db.get_settings().expect("settings should load");
    assert_eq!(settings.model_variant, Some(ModelVariant::Turbo));
    assert!(!settings.default_thinking);
    assert_eq!(settings.default_duration_seconds, 60.0);
    assert_eq!(settings.default_audio_format, "ogg");
}

#[test]
fn delete_by_prefix_removes_generation_record_and_output_file() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = Database::new(temp.path()).expect("database");
    let history = HistoryService::new(db.clone());
    let output_path = temp.path().join("generated.wav");
    fs::write(&output_path, b"audio").expect("audio should write");
    db.insert_generation(&sample_record(
        "a1b2c3d4-0000-0000-0000-000000000000",
        Some(output_path.display().to_string()),
    ))
    .expect("record should insert");

    let records = history.list_generations(None).expect("records should load");
    let record = records
        .iter()
        .find(|r| r.id.starts_with("a1b2c3d4"))
        .expect("record should match prefix");
    history
        .delete_generation_file_and_record(&record.id)
        .expect("record should delete");

    assert!(!output_path.exists());
    assert!(db
        .get_generation("a1b2c3d4-0000-0000-0000-000000000000")
        .expect("get should work")
        .is_none());
}
