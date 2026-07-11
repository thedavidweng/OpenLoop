#[cfg(test)]
mod tests {
    use crate::services::db::Database;
    use crate::models::{
        generation::{ActiveGenerationTask, GenerationRecord, GenerationRequest},
        profile::CreateProfileRequest,
        settings::RecommendedProfile,
    };
    use serde_json::json;
    use std::fs;

    fn sample_record() -> GenerationRecord {
        GenerationRecord {
            id: "gen_001".to_owned(),
            created_at: "2026-04-23T10:00:00Z".to_owned(),
            prompt: "warm piano loop".to_owned(),
            lyrics: "".to_owned(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
            bpm: Some(92),
            key_scale: Some("C Major".to_owned()),
            time_signature: "4".to_owned(),
            model: Some("acestep-v15-turbo".to_owned()),
            lm_model: None,
            thinking: true,
            inference_steps: 8,
            guidance_scale: 7.0,
            use_random_seed: true,
            seed: None,
            audio_format: "wav".to_owned(),
            output_path: Some("/tmp/mock.wav".to_owned()),
            status: "completed".to_owned(),
            error_message: None,
            generation_info: Some("ok".to_owned()),
            is_favorite: false,
            project_id: None,
        }
    }

    fn sample_request() -> GenerationRequest {
        GenerationRequest {
            prompt: "warm piano loop".to_owned(),
            negative_prompt: None,
            lyrics: "".to_owned(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
            bpm: Some(92),
            key_scale: Some("C Major".to_owned()),
            time_signature: "4".to_owned(),
            audio_format: "wav".to_owned(),
            model: Some("acestep-v15-turbo".to_owned()),
            task_type: "text2music".to_owned(),
            lm_model_path: None,
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
            use_random_seed: true,
            seed: None,
            variation_count: 2,
        }
    }

    #[test]
    fn settings_round_trip_from_sqlite() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");

        let settings = database
            .get_settings()
            .expect("default settings should load");
        assert!(matches!(settings.profile, RecommendedProfile::Standard));

        let updated = database
            .set_setting("backendPort", json!(1818))
            .expect("backendPort should persist");
        assert_eq!(updated.backend_port, 1818);

        let reloaded = database.get_settings().expect("settings should reload");
        assert_eq!(reloaded.backend_port, 1818);
    }

    #[test]
    fn settings_prunes_legacy_backend_command_path_key() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let connection = database.connection().expect("connection should open");
        connection
            .execute(
                "INSERT INTO settings (key, value, updated_at) VALUES ('backendCommandPath', '\"/tmp/uv\"', '2026-04-29T00:00:00Z')",
                [],
            )
            .expect("legacy setting should insert");

        let settings = database
            .get_settings()
            .expect("settings should ignore legacy key");
        assert_eq!(settings.backend_port, 8001);

        let legacy_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM settings WHERE key = 'backendCommandPath'",
                [],
                |row| row.get(0),
            )
            .expect("legacy count should query");
        assert_eq!(legacy_count, 0);
    }

    #[test]
    fn generation_crud_round_trip_works() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let record = sample_record();

        database
            .insert_generation(&record)
            .expect("generation record should insert");

        let listed = database
            .list_generations(Some("piano"), None)
            .expect("generation record should list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, record.id);

        let fetched = database
            .get_generation(&record.id)
            .expect("generation record should fetch")
            .expect("generation record should exist");
        assert_eq!(fetched.prompt, record.prompt);

        database
            .delete_generation(&record.id)
            .expect("generation record should delete");

        let remaining = database
            .list_generations(None, None)
            .expect("generation list should still load");
        assert!(remaining.is_empty());
    }

    #[test]
    fn list_generations_only_returns_generated_output_records() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");

        let completed = sample_record();
        database
            .insert_generation(&completed)
            .expect("completed generation should insert");

        let mut failed = sample_record();
        failed.id = "gen_failed".to_owned();
        failed.status = "failed".to_owned();
        failed.output_path = None;
        database
            .insert_generation(&failed)
            .expect("legacy failed generation should insert");

        let mut cancelled = sample_record();
        cancelled.id = "gen_cancelled".to_owned();
        cancelled.status = "cancelled".to_owned();
        cancelled.output_path = None;
        database
            .insert_generation(&cancelled)
            .expect("legacy cancelled generation should insert");

        let listed = database
            .list_generations(None, None)
            .expect("generation list should load");

        assert_eq!(
            listed
                .iter()
                .map(|record| record.id.as_str())
                .collect::<Vec<_>>(),
            vec!["gen_001"]
        );
    }

    #[test]
    fn clear_generations_removes_records_without_touching_files() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let output = temp_dir.path().join("mock.wav");
        fs::write(&output, b"audio").expect("audio should write");
        let mut record = sample_record();
        record.output_path = Some(output.display().to_string());
        database
            .insert_generation(&record)
            .expect("generation record should insert");

        database
            .clear_generations()
            .expect("generation records should clear");

        assert!(database
            .list_generations(None, None)
            .expect("generation list should load")
            .is_empty());
        assert!(output.exists());
    }

    #[test]
    fn active_generation_task_round_trip_works() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let database = Database::new(temp_dir.path()).expect("database should initialize");
        let task = ActiveGenerationTask {
            id: "active_001".to_owned(),
            task_id: "task-123".to_owned(),
            request: sample_request(),
            variation_index: 1,
            variation_total: 2,
            created_at: "2026-04-29T10:00:00Z".to_owned(),
            updated_at: "2026-04-29T10:01:00Z".to_owned(),
            cancel_requested_at: None,
        };

        database
            .upsert_active_generation_task(&task)
            .expect("active task should insert");
        let listed = database
            .list_active_generation_tasks()
            .expect("active tasks should list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].task_id, "task-123");
        assert_eq!(listed[0].request.variation_count, 2);

        database
            .delete_active_generation_task(&task.id)
            .expect("active task should delete");
        assert!(database
            .list_active_generation_tasks()
            .expect("active tasks should list")
            .is_empty());
    }

    #[test]
    fn schema_migrates_from_v1_to_latest() {
        use rusqlite::Connection;

        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let db_path = temp_dir.path().join("openloop.sqlite3");

        let conn = Connection::open(&db_path).expect("connection should open");
        conn.execute_batch(include_str!("../../../migrations/001_init.sql"))
            .expect("v1 init should succeed");
        conn.execute(
            "INSERT INTO generations (id, created_at, prompt, lyrics, vocal_language, duration_seconds, bpm, key_scale, time_signature, model, lm_model, thinking, inference_steps, guidance_scale, use_random_seed, seed, audio_format, output_path, status, error_message, generation_info) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
            rusqlite::params!["gen_v1", "2026-01-01T00:00:00Z", "legacy prompt", "", "en", 30.0, 92, "C Major", "4", "acestep-v15-turbo", rusqlite::types::Null, 1, 8, 7.0, 1, rusqlite::types::Null, "wav", "/tmp/legacy.wav", "completed", rusqlite::types::Null, "ok"],
        )
        .expect("v1 record should insert");
        conn.execute(
            "INSERT INTO active_generation_tasks (id, task_id, request_json, variation_index, variation_total, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params!["task_v1", "ace-123",             r#"{"prompt":"legacy request","lyrics":"","vocalLanguage":"en","durationSeconds":30.0,"timeSignature":"4","audioFormat":"wav","taskType":"text2music","thinking":true,"inferenceSteps":8,"guidanceScale":7.0,"useFormat":false,"useCotCaption":true,"useCotLanguage":true,"constrainedDecoding":true,"useRandomSeed":true,"variationCount":1}"#, 0, 1, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        )
        .expect("v1 task should insert");
        drop(conn);

        // Step 2: run full migration via Database::new
        let database =
            Database::new(temp_dir.path()).expect("database should initialize with migration");

        // Step 3: verify v1 record is still readable
        let all = database
            .list_generations(None, None)
            .expect("list should work");
        assert!(
            all.iter().any(|r| r.id == "gen_v1"),
            "v1 record should survive migration"
        );

        // Step 4: verify new columns work (is_favorite from 003)
        let mut record = sample_record();
        record.is_favorite = true;
        database
            .insert_generation(&record)
            .expect("record with is_favorite should insert");
        let fetched = database
            .get_generation(&record.id)
            .expect("get should work")
            .expect("record should exist");
        assert!(fetched.is_favorite, "is_favorite should persist");

        // Step 5: verify failed_runs table (004)
        let failed = database
            .list_failed_runs(10)
            .expect("failed runs should list");
        assert!(failed.is_empty(), "failed_runs table should exist");

        // Step 6: verify active tasks still work with cancel_requested_at
        let tasks = database
            .list_active_generation_tasks()
            .expect("tasks should list");
        assert!(
            tasks.iter().any(|t| t.id == "task_v1"),
            "v1 task should survive migration"
        );
    }

    #[test]
    fn project_crud_works_end_to_end() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        // Initially no projects
        assert!(database.list_projects().expect("list").is_empty());

        // Create
        let project = database.create_project("Album A").expect("create project");
        assert_eq!(project.name, "Album A");

        // List
        let projects = database.list_projects().expect("list");
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, project.id);

        // Rename
        let renamed = database
            .rename_project(&project.id, "Album B")
            .expect("rename");
        assert_eq!(renamed.name, "Album B");

        // Delete
        database.delete_project(&project.id).expect("delete");
        assert!(database.list_projects().expect("list").is_empty());
    }

    #[test]
    fn assign_generation_to_project_and_query_by_project() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        let project = database
            .create_project("Soundtrack")
            .expect("create project");

        let record = sample_record();
        database.insert_generation(&record).expect("insert");

        // Assign
        database
            .set_generation_project(&record.id, Some(&project.id))
            .expect("assign");

        // Verify via get_generation
        let fetched = database
            .get_generation(&record.id)
            .expect("get")
            .expect("record");
        assert_eq!(fetched.project_id, Some(project.id.clone()));

        // Query by project
        let in_project = database
            .list_generations_by_project(&project.id, None)
            .expect("list by project");
        assert_eq!(in_project.len(), 1);
        assert_eq!(in_project[0].id, record.id);

        // Unassign
        database
            .set_generation_project(&record.id, None)
            .expect("unassign");
        let unassigned = database
            .get_generation(&record.id)
            .expect("get")
            .expect("record");
        assert!(unassigned.project_id.is_none());

        // Query by project returns empty
        let empty = database
            .list_generations_by_project(&project.id, None)
            .expect("list by project");
        assert!(empty.is_empty());
    }

    #[test]
    fn delete_project_unassigns_generations_not_deletes_them() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        let project = database
            .create_project("Ephemeral")
            .expect("create project");

        let record = sample_record();
        database.insert_generation(&record).expect("insert");
        database
            .set_generation_project(&record.id, Some(&project.id))
            .expect("assign");

        // Delete project
        database.delete_project(&project.id).expect("delete");

        // Generation still exists but project_id is null (ON DELETE SET NULL)
        let fetched = database
            .get_generation(&record.id)
            .expect("get")
            .expect("record");
        assert!(fetched.project_id.is_none());
    }

    #[test]
    fn find_generation_ids_by_prefix_returns_targeted_matches() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        let mut record = sample_record();
        record.id = "gen_abc123".to_owned();
        database.insert_generation(&record).expect("insert");

        let mut other = sample_record();
        other.id = "gen_xyz789".to_owned();
        database.insert_generation(&other).expect("insert");

        // Prefix match
        let matches = database
            .find_generation_ids_by_prefix("gen_abc")
            .expect("prefix search");
        assert_eq!(matches, vec!["gen_abc123".to_owned()]);

        // No match
        let none = database
            .find_generation_ids_by_prefix("zzz")
            .expect("prefix search");
        assert!(none.is_empty());

        // Ambiguous prefix (both start with "gen_")
        let ambiguous = database
            .find_generation_ids_by_prefix("gen_")
            .expect("prefix search");
        assert_eq!(ambiguous.len(), 2);
    }

    #[test]
    fn profile_crud_works_end_to_end() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = Database::new(temp_dir.path()).expect("database should init");

        assert!(database.list_profiles().expect("list").is_empty());

        let request = CreateProfileRequest {
            name: "Fast Draft".to_owned(),
            model_variant: Some("lite".to_owned()),
            duration_seconds: Some(15.0),
            audio_format: Some("wav".to_owned()),
            thinking: Some(false),
            inference_steps: Some(6),
            guidance_scale: Some(6.0),
            bpm: None,
            key_scale: None,
            time_signature: None,
            vocal_language: Some("en".to_owned()),
            lm_backend: Some("mlx".to_owned()),
        };

        let profile = database.create_profile(&request).expect("create");
        assert_eq!(profile.name, "Fast Draft");
        assert_eq!(profile.model_variant.as_deref(), Some("lite"));
        assert_eq!(profile.thinking, Some(false));

        let profiles = database.list_profiles().expect("list");
        assert_eq!(profiles.len(), 1);

        let renamed = database
            .rename_profile(&profile.id, "Quick Draft")
            .expect("rename");
        assert_eq!(renamed.name, "Quick Draft");
        assert_eq!(renamed.created_at, profile.created_at);

        database.delete_profile(&profile.id).expect("delete");
        assert!(database.list_profiles().expect("list").is_empty());
    }
}
