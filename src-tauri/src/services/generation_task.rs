use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use crate::{
    models::{
        errors::{AppError, AppResult},
        generation::{
            ActiveGenerationTask, GenerationRecord, GenerationRequest, GenerationRunResult,
        },
        settings::AppSettings,
    },
    services::{
        ace_client::{AceClient, AceReleasedTask, AceTaskResult, AceTaskState},
        db::Database,
        file_store::FileStore,
    },
};

pub const GENERATION_EVENT: &str = "generation-event";

pub trait GenerationTaskAdapter {
    fn release_task(&self, request: &GenerationRequest) -> AppResult<AceReleasedTask>;
    fn query_result(&self, task_ids: Vec<String>) -> AppResult<Vec<AceTaskResult>>;
    fn download_audio(&self, path: &str) -> AppResult<Vec<u8>>;
}

impl GenerationTaskAdapter for AceClient {
    fn release_task(&self, request: &GenerationRequest) -> AppResult<AceReleasedTask> {
        AceClient::release_task(self, request)
    }

    fn query_result(&self, task_ids: Vec<String>) -> AppResult<Vec<AceTaskResult>> {
        AceClient::query_result(self, task_ids)
    }

    fn download_audio(&self, path: &str) -> AppResult<Vec<u8>> {
        AceClient::download_audio(self, path)
    }
}

pub trait GenerationEventSink {
    fn emit_generation_event(&self, payload: Value) -> AppResult<()>;
}

#[derive(Debug, Clone, Copy)]
pub struct GenerationTaskTiming {
    pub poll_delay: Duration,
}

impl Default for GenerationTaskTiming {
    fn default() -> Self {
        Self {
            poll_delay: Duration::from_secs(2),
        }
    }
}

pub struct GenerationTaskRunner {
    db: Database,
    file_store: FileStore,
    cancelled: Arc<AtomicBool>,
    timing: GenerationTaskTiming,
}

impl GenerationTaskRunner {
    pub fn new(db: Database, file_store: FileStore, cancelled: Arc<AtomicBool>) -> Self {
        Self {
            db,
            file_store,
            cancelled,
            timing: GenerationTaskTiming::default(),
        }
    }

    pub fn with_timing(mut self, timing: GenerationTaskTiming) -> Self {
        self.timing = timing;
        self
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn list_active_generation_tasks(&self) -> AppResult<Vec<ActiveGenerationTask>> {
        self.db.list_active_generation_tasks()
    }

    pub fn discard_active_generation_task(&self, id: &str) -> AppResult<()> {
        self.db.delete_active_generation_task(id)
    }

    pub fn generate(
        &self,
        adapter: &impl GenerationTaskAdapter,
        sink: &impl GenerationEventSink,
        settings: &AppSettings,
        request: GenerationRequest,
    ) -> AppResult<GenerationRunResult> {
        self.cancelled.store(false, Ordering::SeqCst);
        let variation_total = request.variation_count;
        let mut records = Vec::new();
        let mut used_seeds = HashSet::new();

        for variation_index in 1..=variation_total {
            if self.cancelled.load(Ordering::SeqCst) {
                break;
            }

            let variant_request = request_for_variation(&request, variation_index, &mut used_seeds);
            let released = adapter.release_task(&variant_request)?;
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
            self.db.upsert_active_generation_task(&active)?;
            sink.emit_generation_event(serde_json::json!({
                "type": "submitted",
                "taskId": released.task_id,
                "variationCurrent": variation_index,
                "variationTotal": variation_total,
            }))?;

            let record = self.run_released_task(
                adapter,
                sink,
                settings,
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

        self.cancelled.store(false, Ordering::SeqCst);
        Ok(GenerationRunResult { records })
    }

    pub fn resume(
        &self,
        adapter: &impl GenerationTaskAdapter,
        sink: &impl GenerationEventSink,
        settings: &AppSettings,
        active: ActiveGenerationTask,
    ) -> AppResult<GenerationRecord> {
        self.run_released_task(
            adapter,
            sink,
            settings,
            active.request.clone(),
            active.task_id.clone(),
            active.variation_index,
            active.variation_total,
            Some(active.id.clone()),
        )
    }

    fn run_released_task(
        &self,
        adapter: &impl GenerationTaskAdapter,
        sink: &impl GenerationEventSink,
        settings: &AppSettings,
        request: GenerationRequest,
        task_id: String,
        variation_index: i64,
        variation_total: i64,
        active_id: Option<String>,
    ) -> AppResult<GenerationRecord> {
        let mut first_running_state = true;

        loop {
            if self.cancelled.load(Ordering::SeqCst) {
                let record = build_generation_record(
                    &request,
                    "cancelled",
                    None,
                    Some("Cancelled by user".to_owned()),
                    None,
                );
                let persisted = self.db.insert_generation(&record)?;
                if let Some(active_id) = &active_id {
                    self.db.delete_active_generation_task(active_id)?;
                }
                sink.emit_generation_event(serde_json::json!({
                    "type": "cancelled",
                    "generationId": persisted.id,
                    "variationCurrent": variation_index,
                    "variationTotal": variation_total,
                }))?;
                return Ok(persisted);
            }

            let results = adapter.query_result(vec![task_id.clone()])?;
            let result = results
                .into_iter()
                .next()
                .ok_or_else(|| AppError::task_failed("query_result returned no tasks"))?;

            match result.state {
                AceTaskState::Running => {
                    sink.emit_generation_event(serde_json::json!({
                        "type": if first_running_state { "queued" } else { "running" },
                        "variationCurrent": variation_index,
                        "variationTotal": variation_total,
                    }))?;
                    first_running_state = false;
                    thread::sleep(self.timing.poll_delay);
                }
                AceTaskState::Succeeded { file_path } => {
                    sink.emit_generation_event(serde_json::json!({
                        "type": "downloading",
                        "variationCurrent": variation_index,
                        "variationTotal": variation_total,
                    }))?;
                    let bytes = adapter.download_audio(&file_path)?;
                    let output_path =
                        self.file_store
                            .write_audio(bytes, &request.audio_format, settings)?;

                    let record = build_generation_record(
                        &request,
                        "completed",
                        Some(output_path.clone()),
                        None,
                        result.raw_result.map(|value| value.to_string()),
                    );
                    let persisted = self.db.insert_generation(&record)?;
                    if let Some(active_id) = &active_id {
                        self.db.delete_active_generation_task(active_id)?;
                    }
                    sink.emit_generation_event(serde_json::json!({
                        "type": "completed",
                        "generationId": persisted.id,
                        "outputPath": output_path,
                        "variationCurrent": variation_index,
                        "variationTotal": variation_total,
                    }))?;
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
                    let _persisted = self.db.insert_generation(&record)?;
                    if let Some(active_id) = &active_id {
                        self.db.delete_active_generation_task(active_id)?;
                    }
                    sink.emit_generation_event(
                        serde_json::json!({ "type": "failed", "error": error.clone() }),
                    )?;
                    return Err(error);
                }
            }
        }
    }
}

pub fn build_generation_record(
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
    use std::sync::Mutex;

    use serde_json::Value;

    use super::*;

    struct MemoryAdapter {
        states: Mutex<Vec<AceTaskState>>,
    }

    impl MemoryAdapter {
        fn new(states: Vec<AceTaskState>) -> Self {
            Self {
                states: Mutex::new(states),
            }
        }
    }

    impl GenerationTaskAdapter for MemoryAdapter {
        fn release_task(&self, _request: &GenerationRequest) -> AppResult<AceReleasedTask> {
            Ok(AceReleasedTask {
                task_id: "task-001".to_owned(),
            })
        }

        fn query_result(&self, _task_ids: Vec<String>) -> AppResult<Vec<AceTaskResult>> {
            let state = self.states.lock().expect("states").remove(0);
            Ok(vec![AceTaskResult {
                task_id: "task-001".to_owned(),
                state,
                raw_result: None,
            }])
        }

        fn download_audio(&self, _path: &str) -> AppResult<Vec<u8>> {
            Ok(b"audio".to_vec())
        }
    }

    #[derive(Default)]
    struct MemorySink {
        events: Mutex<Vec<Value>>,
    }

    impl GenerationEventSink for MemorySink {
        fn emit_generation_event(&self, payload: Value) -> AppResult<()> {
            self.events.lock().expect("events").push(payload);
            Ok(())
        }
    }

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
            variation_count: 1,
        }
    }

    #[test]
    fn generation_task_success_persists_record_and_emits_ordered_events() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = Database::new(temp.path()).expect("database");
        let settings = AppSettings {
            output_directory: Some(temp.path().join("out").display().to_string()),
            ..AppSettings::default()
        };
        let runner = GenerationTaskRunner::new(
            db.clone(),
            FileStore::new(temp.path().to_path_buf()),
            Arc::new(AtomicBool::new(false)),
        )
        .with_timing(GenerationTaskTiming {
            poll_delay: Duration::ZERO,
        });
        let adapter = MemoryAdapter::new(vec![
            AceTaskState::Running,
            AceTaskState::Succeeded {
                file_path: "/tmp/generated.wav".to_owned(),
            },
        ]);
        let sink = MemorySink::default();

        let result = runner
            .generate(&adapter, &sink, &settings, sample_request())
            .expect("generation should complete");

        assert_eq!(result.records.len(), 1);
        assert_eq!(result.records[0].status, "completed");
        assert!(result.records[0]
            .output_path
            .as_ref()
            .is_some_and(|path| std::path::Path::new(path).is_file()));
        assert!(db
            .list_active_generation_tasks()
            .expect("active tasks")
            .is_empty());
        let event_types: Vec<String> = sink
            .events
            .lock()
            .expect("events")
            .iter()
            .map(|event| event["type"].as_str().unwrap().to_owned())
            .collect();
        assert_eq!(
            event_types,
            vec!["submitted", "queued", "downloading", "completed"]
        );
    }

    #[test]
    fn variation_requests_get_distinct_manual_seeds() {
        let mut request = sample_request();
        request.variation_count = 3;
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
