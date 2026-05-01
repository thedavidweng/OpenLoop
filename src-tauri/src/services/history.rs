use std::{fs, path::PathBuf};

use tauri::ipc::Response;

use crate::{
    audio::{decode::decode_bytes, waveform::waveform_peaks},
    models::{
        errors::{AppError, AppResult},
        generation::{GenerationRecord, GenerationWaveform},
    },
    services::db::Database,
};

#[derive(Debug, Clone)]
pub struct HistoryService {
    db: Database,
}

impl HistoryService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn list_generations(&self, query: Option<&str>) -> AppResult<Vec<GenerationRecord>> {
        self.db.list_generations(query)
    }

    pub fn get_generation(&self, id: &str) -> AppResult<Option<GenerationRecord>> {
        self.db.get_generation(id)
    }

    pub fn delete_generation(&self, id: &str) -> AppResult<()> {
        self.db.delete_generation(id)
    }

    pub fn clear_generation_history(&self) -> AppResult<()> {
        self.db.clear_generations()
    }

    pub fn read_generation_audio_response(&self, id: &str) -> AppResult<Response> {
        self.read_generation_audio_bytes(id).map(Response::new)
    }

    pub fn read_generation_audio_bytes(&self, id: &str) -> AppResult<Vec<u8>> {
        let path = self.generation_output_file(id)?;
        fs::read(&path).map_err(|error| AppError::output_read_failed(error.to_string()))
    }

    pub fn read_generation_waveform(&self, id: &str) -> AppResult<GenerationWaveform> {
        let record = self
            .db
            .get_generation(id)?
            .ok_or_else(|| AppError::not_found("Generation record", id.to_owned()))?;
        let path = generation_output_path(&record, id)?;
        if !path.is_file() {
            return Err(AppError::not_found(
                "Generation audio",
                path.display().to_string(),
            ));
        }
        let bytes =
            fs::read(&path).map_err(|error| AppError::output_read_failed(error.to_string()))?;
        let decoded = decode_bytes(bytes, &record.audio_format)
            .map_err(|error| AppError::output_read_failed(error.to_string()))?;
        Ok(GenerationWaveform {
            peaks: waveform_peaks(&decoded),
        })
    }

    pub fn delete_generation_file_and_record(&self, id: &str) -> AppResult<()> {
        let path = self.generation_output_file(id)?;
        fs::remove_file(&path).map_err(|error| AppError::output_write_failed(error.to_string()))?;
        self.db.delete_generation(id)
    }

    fn generation_output_file(&self, id: &str) -> AppResult<PathBuf> {
        let record = self
            .db
            .get_generation(id)?
            .ok_or_else(|| AppError::not_found("Generation record", id.to_owned()))?;
        let path = generation_output_path(&record, id)?;
        if !path.is_file() {
            return Err(AppError::not_found(
                "Generation audio",
                path.display().to_string(),
            ));
        }
        Ok(path)
    }
}

fn generation_output_path(record: &GenerationRecord, id: &str) -> AppResult<PathBuf> {
    let output_path = record.output_path.clone().ok_or_else(|| {
        AppError::not_found(
            "Generation audio",
            format!("record {id} has no output path"),
        )
    })?;
    Ok(PathBuf::from(output_path))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use crate::{
        models::generation::GenerationRecord,
        services::{db::Database, history::HistoryService},
    };

    fn sample_record(output_path: Option<String>) -> GenerationRecord {
        GenerationRecord {
            id: "gen_001".to_owned(),
            created_at: "2026-04-29T00:00:00Z".to_owned(),
            prompt: "warm piano".to_owned(),
            lyrics: "".to_owned(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
            bpm: None,
            key_scale: None,
            time_signature: "4".to_owned(),
            model: Some("acestep-v15-turbo".to_owned()),
            lm_model: None,
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
    fn delete_generation_file_and_record_removes_both_by_record_id() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = Database::new(temp.path()).expect("database");
        let output_path = temp.path().join("generated.wav");
        fs::write(&output_path, b"audio").expect("audio file");
        db.insert_generation(&sample_record(Some(output_path.display().to_string())))
            .expect("insert");
        let history = HistoryService::new(db.clone());

        history
            .delete_generation_file_and_record("gen_001")
            .expect("delete file and record");

        assert!(!output_path.exists());
        assert!(db.get_generation("gen_001").expect("get").is_none());
    }

    #[test]
    fn missing_generation_file_returns_not_found() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = Database::new(temp.path()).expect("database");
        db.insert_generation(&sample_record(Some(
            temp.path().join("missing.wav").display().to_string(),
        )))
        .expect("insert");
        let history = HistoryService::new(db);

        let error = history
            .read_generation_audio_bytes("gen_001")
            .expect_err("missing file should fail");

        assert_eq!(error.code, "NOT_FOUND");
    }
}
