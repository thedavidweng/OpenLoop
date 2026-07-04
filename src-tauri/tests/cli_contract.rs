use std::sync::{atomic::AtomicBool, Arc};
use std::{fs, process::Command};

use openloop_lib::{
    app_state::AppState,
    models::{
        errors::{AppError, AppResult},
        generation::{ActiveGenerationTask, GenerationRecord, GenerationRequest},
        settings::{AppSettings, ModelVariant},
    },
    services::{
        ace_client::{AceReleasedTask, AceTaskResult, AceTaskState},
        db::Database,
        file_store::FileStore,
        generation_task::{GenerationEventSink, GenerationTaskAdapter, GenerationTaskRunner},
        history::HistoryService,
    },
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
        is_favorite: false,
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

    let records = db
        .list_generations(None, None)
        .expect("records should load");
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

// ---------------------------------------------------------------------------
// M0: Event schema contract tests
// ---------------------------------------------------------------------------

#[test]
fn event_schema_v1_has_required_fields() {
    let json = serde_json::from_str::<serde_json::Value>(
        &serde_json::to_string(&serde_json::json!({
            "v": 1,
            "ts": "2026-05-13T12:00:00Z",
            "kind": "lifecycle",
            "phase": "backend_check",
            "port": null,
            "ownership": "none",
            "message": "checking backend",
        }))
        .unwrap(),
    )
    .unwrap();

    assert_eq!(json["v"], 1);
    assert!(json["ts"].as_str().unwrap().len() > 10);
    assert_eq!(json["kind"], "lifecycle");
    assert_eq!(json["phase"], "backend_check");
}

#[test]
fn ndjson_progress_event_has_label() {
    let line = serde_json::json!({
        "v": 1,
        "ts": "2026-05-13T12:00:00Z",
        "kind": "progress",
        "pct": 50,
        "label": "downloading",
        "detail": "model.safetensors",
    });

    let parsed: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&line).unwrap()).unwrap();
    assert_eq!(parsed["kind"], "progress");
    assert_eq!(parsed["pct"], 50);
    assert_eq!(parsed["label"], "downloading");
}

#[test]
fn ndjson_error_event_includes_recoverable_flag() {
    let error = AppError::internal("test error");
    let line = serde_json::json!({
        "v": 1,
        "ts": "2026-05-13T12:00:00Z",
        "kind": "error",
        "code": error.code,
        "message": error.message,
        "recoverable": true,
        "suggestion": "run openloop doctor",
    });

    let parsed: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&line).unwrap()).unwrap();
    assert_eq!(parsed["kind"], "error");
    assert_eq!(parsed["code"], "INTERNAL_ERROR");
    assert_eq!(parsed["recoverable"], true);
    assert_eq!(parsed["suggestion"], "run openloop doctor");
}

// ---------------------------------------------------------------------------
// M0: AppError exit code mapping
// ---------------------------------------------------------------------------

#[test]
fn validation_error_has_exit_code_2() {
    let error = AppError::validation_failed("invalid prompt");
    assert_eq!(error.exit_code(), 2);
}

#[test]
fn backend_unavailable_error_has_exit_code_3() {
    let error = AppError::backend_start_failed("port busy");
    assert_eq!(error.exit_code(), 3);

    let timeout = AppError::backend_health_timeout("timed out");
    assert_eq!(timeout.exit_code(), 3);
}

#[test]
fn generic_error_has_exit_code_1() {
    let error = AppError::internal("something broke");
    assert_eq!(error.exit_code(), 1);

    let not_found = AppError::not_found("record", "id missing");
    assert_eq!(not_found.exit_code(), 1);
}

// ---------------------------------------------------------------------------
// M1: BackendManager ownership tracking
// ---------------------------------------------------------------------------

#[test]
fn backend_manager_starts_unowned() {
    let temp = tempfile::tempdir().expect("temp dir");
    let manager = openloop_lib::services::backend_manager::BackendManager::new(
        temp.path().to_path_buf(),
        temp.path().join("sidecars"),
        std::sync::Arc::new(openloop_lib::services::network_log::NetworkActivityLog::new()),
    );
    assert!(!manager.is_owned());
}

#[test]
fn backend_start_json_failure_emits_structured_lifecycle_error() {
    let home = tempfile::tempdir().expect("home dir");
    let app_data_dir = isolated_app_data_dir(home.path());
    let db = Database::new(&app_data_dir).expect("database should initialize");
    db.set_setting("modelVariant", serde_json::json!("turbo"))
        .expect("model variant should persist");

    let output = Command::new(env!("CARGO_BIN_EXE_openloop"))
        .env("HOME", home.path())
        .env_remove("XDG_DATA_HOME")
        .env("APPDATA", home.path().join("AppData").join("Roaming"))
        .args(["backend", "start", "--json"])
        .output()
        .expect("backend start command should run");

    assert_eq!(output.status.code(), Some(3));

    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let line = stdout
        .lines()
        .next()
        .expect("json failure should emit one lifecycle event");
    assert_eq!(stdout.lines().count(), 1);

    let event: serde_json::Value = serde_json::from_str(line).expect("stdout should be json");
    assert_eq!(event["kind"], "lifecycle");
    assert_eq!(event["phase"], "failed");
    assert_eq!(event["ownership"], "stopped");
    assert_eq!(event["port"], serde_json::Value::Null);
    assert_eq!(
        event["error"],
        "ACE-Step backend code is not installed. Run 'openloop backend provision' or download from app settings."
    );
    assert_eq!(
        event["message"],
        "Backend failed to start: ACE-Step backend code is not installed. Run 'openloop backend provision' or download from app settings."
    );
}

#[test]
fn backend_restart_json_failure_emits_structured_lifecycle_error() {
    let home = tempfile::tempdir().expect("home dir");
    let app_data_dir = isolated_app_data_dir(home.path());
    let db = Database::new(&app_data_dir).expect("database should initialize");
    db.set_setting("modelVariant", serde_json::json!("turbo"))
        .expect("model variant should persist");

    let output = Command::new(env!("CARGO_BIN_EXE_openloop"))
        .env("HOME", home.path())
        .env_remove("XDG_DATA_HOME")
        .env("APPDATA", home.path().join("AppData").join("Roaming"))
        .args(["backend", "restart", "--json"])
        .output()
        .expect("backend restart command should run");

    assert_eq!(output.status.code(), Some(3));

    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let line = stdout
        .lines()
        .next()
        .expect("json failure should emit one lifecycle event");
    assert_eq!(stdout.lines().count(), 1);

    let event: serde_json::Value = serde_json::from_str(line).expect("stdout should be json");
    assert_eq!(event["kind"], "lifecycle");
    assert_eq!(event["phase"], "failed");
    assert_eq!(event["ownership"], "stopped");
    assert_eq!(event["port"], serde_json::Value::Null);
    assert_eq!(
        event["error"],
        "ACE-Step backend code is not installed. Run 'openloop backend provision' or download from app settings."
    );
    assert_eq!(
        event["message"],
        "Backend failed to restart: ACE-Step backend code is not installed. Run 'openloop backend provision' or download from app settings."
    );
}

fn isolated_app_data_dir(home: &std::path::Path) -> std::path::PathBuf {
    #[cfg(target_os = "macos")]
    {
        home.join("Library")
            .join("Application Support")
            .join("com.openmusic.openloop")
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        home.join(".local")
            .join("share")
            .join("com.openmusic.openloop")
    }

    #[cfg(windows)]
    {
        home.join("AppData")
            .join("Roaming")
            .join("com.openmusic.openloop")
    }
}

// ---------------------------------------------------------------------------
// M2: Active generation task cancel_requested_at round-trip
// ---------------------------------------------------------------------------

fn sample_active_task() -> ActiveGenerationTask {
    ActiveGenerationTask {
        id: "test-cancel-001".to_owned(),
        task_id: "task-cancel-001".to_owned(),
        request: GenerationRequest {
            prompt: "test".to_owned(),
            negative_prompt: None,
            lyrics: String::new(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
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
            use_cot_caption: false,
            use_cot_language: false,
            constrained_decoding: false,
            reference_audio_path: None,
            src_audio_path: None,
            instruction: None,
            repainting_start: None,
            repainting_end: None,
            audio_cover_strength: None,
            use_random_seed: true,
            seed: None,
            variation_count: 1,
        },
        variation_index: 1,
        variation_total: 1,
        created_at: "2026-05-13T12:00:00Z".to_owned(),
        updated_at: "2026-05-13T12:00:00Z".to_owned(),
        cancel_requested_at: None,
    }
}

#[test]
fn cross_process_cancel_request_sets_timestamp_in_db() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = Database::new(temp.path()).expect("database");
    let task = sample_active_task();
    db.upsert_active_generation_task(&task)
        .expect("active task should insert");

    let cancelled = Arc::new(AtomicBool::new(false));
    let runner = GenerationTaskRunner::new(
        db.clone(),
        FileStore::new(temp.path().to_path_buf()),
        cancelled.clone(),
    );

    runner
        .request_cancel_via_db(None)
        .expect("cancel request should write to DB");

    let tasks = db
        .list_active_generation_tasks()
        .expect("tasks should list");
    assert_eq!(tasks.len(), 1);
    assert!(tasks[0].cancel_requested_at.is_some());
    assert!(!tasks[0].cancel_requested_at.as_ref().unwrap().is_empty());
}

#[test]
fn cross_process_cancel_is_detected_by_runner() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = Database::new(temp.path()).expect("database");
    let task = sample_active_task();
    let mut cancel_task = task.clone();
    cancel_task.cancel_requested_at = Some("2026-05-13T12:01:00Z".to_owned());
    db.upsert_active_generation_task(&cancel_task)
        .expect("active task with cancel_requested_at should insert");

    let cancelled = Arc::new(AtomicBool::new(false));
    let runner = GenerationTaskRunner::new(
        db.clone(),
        FileStore::new(temp.path().to_path_buf()),
        cancelled.clone(),
    );

    let detected = runner
        .cancel_requested_in_db(Some("test-cancel-001"))
        .expect("should check DB for cancellation");
    assert!(detected);
}

#[test]
fn active_task_without_cancel_request_returns_false() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = Database::new(temp.path()).expect("database");
    let task = sample_active_task();
    db.upsert_active_generation_task(&task)
        .expect("active task should insert");

    let cancelled = Arc::new(AtomicBool::new(false));
    let runner = GenerationTaskRunner::new(
        db.clone(),
        FileStore::new(temp.path().to_path_buf()),
        cancelled.clone(),
    );

    let detected = runner
        .cancel_requested_in_db(Some("test-cancel-001"))
        .expect("should check DB for cancellation");
    assert!(!detected);
}

// ---------------------------------------------------------------------------
// M2: Task-specific (not global) cross-process cancellation
// ---------------------------------------------------------------------------

#[test]
fn request_cancel_via_db_for_specific_task_leaves_others_untouched() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = Database::new(temp.path()).expect("database");

    let mut task_a = sample_active_task();
    task_a.id = "task-a-001".to_owned();
    task_a.task_id = "ace-task-a".to_owned();
    db.upsert_active_generation_task(&task_a)
        .expect("task a should insert");

    let mut task_b = sample_active_task();
    task_b.id = "task-b-002".to_owned();
    task_b.task_id = "ace-task-b".to_owned();
    db.upsert_active_generation_task(&task_b)
        .expect("task b should insert");

    let cancelled = Arc::new(AtomicBool::new(false));
    let runner = GenerationTaskRunner::new(
        db.clone(),
        FileStore::new(temp.path().to_path_buf()),
        cancelled.clone(),
    );

    // Cancel only task A by its active-task id
    runner
        .request_cancel_via_db(Some("task-a-001"))
        .expect("targeted cancel for task A should write to DB");

    let tasks = db
        .list_active_generation_tasks()
        .expect("tasks should list");
    assert_eq!(tasks.len(), 2);

    let task_a_after = tasks
        .iter()
        .find(|t| t.id == "task-a-001")
        .expect("task a should exist");
    let task_b_after = tasks
        .iter()
        .find(|t| t.id == "task-b-002")
        .expect("task b should exist");

    assert!(
        task_a_after.cancel_requested_at.is_some(),
        "task A should have cancel_requested_at"
    );
    assert!(
        task_b_after.cancel_requested_at.is_none(),
        "task B should NOT have cancel_requested_at"
    );
}

#[test]
fn cancel_requested_in_db_detects_only_specific_task_cancel() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = Database::new(temp.path()).expect("database");

    // Task A has cancel_requested_at set
    let mut task_a = sample_active_task();
    task_a.id = "task-a-001".to_owned();
    task_a.cancel_requested_at = Some("2026-05-13T12:01:00Z".to_owned());
    db.upsert_active_generation_task(&task_a)
        .expect("task a should insert");

    // Task B does NOT have cancel_requested_at
    let mut task_b = sample_active_task();
    task_b.id = "task-b-002".to_owned();
    task_b.cancel_requested_at = None;
    db.upsert_active_generation_task(&task_b)
        .expect("task b should insert");

    let cancelled = Arc::new(AtomicBool::new(false));
    let runner = GenerationTaskRunner::new(
        db.clone(),
        FileStore::new(temp.path().to_path_buf()),
        cancelled.clone(),
    );

    // Checking the specific task that has the cancel flag should return true
    let detected_a = runner
        .cancel_requested_in_db(Some("task-a-001"))
        .expect("should check DB for task A");
    assert!(
        detected_a,
        "cancel_requested_in_db for task A should be true"
    );

    // Checking the specific task that does NOT have the cancel flag should return false
    let detected_b = runner
        .cancel_requested_in_db(Some("task-b-002"))
        .expect("should check DB for task B");
    assert!(
        !detected_b,
        "cancel_requested_in_db for task B should be false"
    );
}

// ---------------------------------------------------------------------------
// M2: BackendManager detach prevents kill on Drop
// ---------------------------------------------------------------------------

#[test]
fn detach_clears_child_handle() {
    let temp = tempfile::tempdir().expect("temp dir");
    let manager = openloop_lib::services::backend_manager::BackendManager::new(
        temp.path().to_path_buf(),
        temp.path().join("sidecars"),
        std::sync::Arc::new(openloop_lib::services::network_log::NetworkActivityLog::new()),
    );
    assert!(!manager.is_owned());
    // After detach on an unowned manager, should still not be owned
    // (detach takes &mut self, so we need a mutable binding)
    let mut detachable = manager;
    detachable.detach();
    assert!(!detachable.is_owned());
}

// ---------------------------------------------------------------------------
// M2: Stale cancel flag on unrelated task does not brick new generation
// ---------------------------------------------------------------------------

/// Stub adapter that succeeds on the first query.
struct StubSuccessfulAdapter;

impl GenerationTaskAdapter for StubSuccessfulAdapter {
    fn release_task(&self, _request: &GenerationRequest) -> AppResult<AceReleasedTask> {
        Ok(AceReleasedTask {
            task_id: "stub-task".to_owned(),
        })
    }

    fn query_result(&self, _task_ids: Vec<String>) -> AppResult<Vec<AceTaskResult>> {
        Ok(vec![AceTaskResult {
            task_id: "stub-task".to_owned(),
            state: AceTaskState::Succeeded {
                file_path: "stub.wav".to_owned(),
            },
            raw_result: None,
        }])
    }

    fn download_audio(&self, _path: &str) -> AppResult<Vec<u8>> {
        Ok(vec![])
    }
}

struct StubSink;

impl GenerationEventSink for StubSink {
    fn emit_generation_event(&self, _payload: serde_json::Value) -> AppResult<()> {
        Ok(())
    }
}

#[test]
fn stale_cancel_flag_on_unrelated_task_does_not_block_new_generation() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = Database::new(temp.path()).expect("database");

    // Simulate a crashed cancelled task: an active row whose cancel_requested_at is set.
    let mut stale = sample_active_task();
    stale.id = "stale-crashed-task".to_owned();
    stale.cancel_requested_at = Some("2026-05-13T12:00:00Z".to_owned());
    db.upsert_active_generation_task(&stale)
        .expect("stale task should insert");

    let cancelled = Arc::new(AtomicBool::new(false));
    let runner = GenerationTaskRunner::new(
        db.clone(),
        FileStore::new(temp.path().to_path_buf()),
        cancelled.clone(),
    );

    let settings = AppSettings {
        output_directory: Some(temp.path().join("output").display().to_string()),
        ..AppSettings::default()
    };

    let request = GenerationRequest {
        prompt: "test".to_owned(),
        variation_count: 1,
        ..sample_active_task().request
    };

    let result = runner
        .generate(&StubSuccessfulAdapter, &StubSink, &settings, request)
        .expect("generate should succeed even when a stale cancelled task exists");

    assert!(
        !result.records.is_empty(),
        "generation must produce records; the stale cancel flag on an unrelated active task \
         must not pre-emptively cancel the new run"
    );
}
