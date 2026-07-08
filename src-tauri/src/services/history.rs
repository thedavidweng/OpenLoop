use std::{fs, path::PathBuf};

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

    pub fn clear_generation_history(&self) -> AppResult<()> {
        let records = self.db.list_generations(None, None)?;
        for record in records {
            if let Ok(path) = generation_output_path(&record, &record.id) {
                if path.is_file() {
                    fs::remove_file(&path)
                        .map_err(|error| AppError::output_write_failed(error.to_string()))?;
                }
            }
        }
        self.db.clear_generations()
    }

    pub fn read_generation_waveform(&self, id: &str) -> AppResult<GenerationWaveform> {
        let record = resolve_by_prefix(&self.db, id)?;
        let path = generation_output_path(&record, &record.id)?;
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
        let record = self
            .db
            .get_generation(id)?
            .ok_or_else(|| AppError::not_found("Generation record", id.to_owned()))?;
        let path = generation_output_path(&record, id)?;
        if path.is_file() {
            fs::remove_file(&path)
                .map_err(|error| AppError::output_write_failed(error.to_string()))?;
        }
        self.db.delete_generation(id)
    }
}

/// Resolve a generation by exact ID or prefix match.
pub fn resolve_by_prefix(db: &Database, id: &str) -> AppResult<GenerationRecord> {
    if let Some(record) = db.get_generation(id)? {
        return Ok(record);
    }
    let records = db.list_generations(None, None)?;
    let matches: Vec<_> = records.iter().filter(|r| r.id.starts_with(id)).collect();
    match matches.len() {
        0 => Err(AppError::not_found("Generation record", id.to_owned())),
        1 => Ok(matches.into_iter().next().unwrap().clone()),
        n => Err(AppError::validation_failed(format!(
            "ambiguous prefix '{id}' matches {n} records. Use a longer prefix.",
        ))),
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
            is_favorite: false,
            project_id: None,
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
    fn clear_generation_history_deletes_output_files_and_records() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = Database::new(temp.path()).expect("database");
        let first_path = temp.path().join("first.wav");
        let missing_path = temp.path().join("missing.wav");
        fs::write(&first_path, b"audio").expect("audio file");
        db.insert_generation(&sample_record(Some(first_path.display().to_string())))
            .expect("insert first");
        let mut missing_record = sample_record(Some(missing_path.display().to_string()));
        missing_record.id = "gen_002".to_owned();
        db.insert_generation(&missing_record)
            .expect("insert missing");
        let history = HistoryService::new(db.clone());

        history
            .clear_generation_history()
            .expect("clear generated output history");

        assert!(!first_path.exists());
        assert!(db.list_generations(None, None).expect("history").is_empty());
    }

    #[test]
    fn resolve_by_prefix_finds_unique_prefix_match() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = Database::new(temp.path()).expect("database");
        db.insert_generation(&sample_record(Some("/tmp/out.wav".to_owned())))
            .expect("insert");
        let mut other = sample_record(Some("/tmp/out2.wav".to_owned()));
        other.id = "gen_999_other".to_owned();
        db.insert_generation(&other).expect("insert");

        let record = super::resolve_by_prefix(&db, "gen_001").expect("should resolve");
        assert_eq!(record.id, "gen_001");
    }

    #[test]
    fn resolve_by_prefix_errors_on_ambiguous_match() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = Database::new(temp.path()).expect("database");
        db.insert_generation(&sample_record(Some("/tmp/out.wav".to_owned())))
            .expect("insert");
        let mut other = sample_record(Some("/tmp/out2.wav".to_owned()));
        other.id = "gen_002".to_owned();
        db.insert_generation(&other).expect("insert");

        let error =
            super::resolve_by_prefix(&db, "gen_00").expect_err("ambiguous prefix should error");
        assert_eq!(error.code, "VALIDATION_FAILED");
        assert!(error.details.unwrap().contains("ambiguous"));
    }

    #[test]
    fn resolve_by_prefix_errors_on_no_match() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = Database::new(temp.path()).expect("database");
        db.insert_generation(&sample_record(None)).expect("insert");

        let error =
            super::resolve_by_prefix(&db, "nonexistent").expect_err("no match should error");
        assert_eq!(error.code, "NOT_FOUND");
    }
}
