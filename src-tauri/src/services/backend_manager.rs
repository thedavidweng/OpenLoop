use std::{
    fs::{self, OpenOptions},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use chrono::Utc;
use reqwest::blocking::Client;

use crate::models::{
    backend::BackendStatus,
    errors::{AppError, AppResult},
    settings::AppSettings,
};
use crate::services::model_manager::{
    checkpoints_dir_for, descriptor_for, ensure_runtime_checkpoints_link, runtime_dir_for,
};

#[derive(Debug)]
pub struct BackendManager {
    app_data_dir: PathBuf,
    sidecar_dir: PathBuf,
    child: Option<Child>,
    status: BackendStatus,
    logs_path: Option<PathBuf>,
}

impl BackendManager {
    pub fn new(app_data_dir: PathBuf, sidecar_dir: PathBuf) -> Self {
        Self {
            app_data_dir,
            sidecar_dir,
            child: None,
            status: BackendStatus::Stopped,
            logs_path: None,
        }
    }

    pub fn status(&mut self) -> BackendStatus {
        if let Some(child) = &mut self.child {
            if let Ok(Some(exit_status)) = child.try_wait() {
                self.child = None;
                self.status = BackendStatus::Failed {
                    error: AppError::backend_start_failed(format!(
                        "backend exited unexpectedly with status {exit_status}"
                    )),
                };
            }
        }

        self.status.clone()
    }

    pub fn logs_path(&self) -> Option<String> {
        self.logs_path
            .as_ref()
            .map(|path| path.display().to_string())
    }

    pub fn start(&mut self, settings: &AppSettings) -> AppResult<BackendStatus> {
        match self.status() {
            BackendStatus::Healthy { .. } | BackendStatus::Starting => {
                return Ok(self.status.clone())
            }
            BackendStatus::Stopped | BackendStatus::Failed { .. } => {}
        }

        let selected_variant = settings.model_variant.ok_or_else(|| {
            AppError::model_not_found("select and download a model before starting the backend")
        })?;
        let descriptor = descriptor_for(selected_variant)?;

        let working_directory = runtime_dir_for(&self.app_data_dir, settings);
        let logs_directory = settings
            .log_directory
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| self.app_data_dir.join("logs/backend"));
        let model_directory = checkpoints_dir_for(&self.app_data_dir, settings);

        fs::create_dir_all(&working_directory)
            .map_err(|error| AppError::backend_start_failed(error.to_string()))?;
        fs::create_dir_all(&logs_directory)
            .map_err(|error| AppError::backend_start_failed(error.to_string()))?;
        fs::create_dir_all(&model_directory)
            .map_err(|error| AppError::backend_start_failed(error.to_string()))?;
        ensure_runtime_checkpoints_link(&working_directory, &model_directory).map_err(|error| {
            AppError::backend_start_failed(
                error
                    .details
                    .unwrap_or_else(|| "failed to prepare ACE-Step checkpoints link".to_owned()),
            )
        })?;

        let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
        let log_path = logs_directory.join(format!("ace-step-{timestamp}.log"));
        let log_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(|error| AppError::backend_start_failed(error.to_string()))?;

        let mut command = Command::new(self.bundled_uv_command()?);
        command
            .arg("run")
            .arg("acestep-api")
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(settings.backend_port.to_string());
        if let Some(lm_model) = descriptor.lm_model {
            command
                .arg("--init-llm")
                .arg("--lm-model-path")
                .arg(lm_model);
        }
        command
            .current_dir(&working_directory)
            .env("ACESTEP_API_HOST", "127.0.0.1")
            .env("ACESTEP_API_PORT", settings.backend_port.to_string())
            .env("ACE_STEP_PORT", settings.backend_port.to_string())
            .env("ACESTEP_CHECKPOINTS_DIR", &model_directory)
            .env("ACESTEP_PROJECT_ROOT", &working_directory)
            .env("ACESTEP_CONFIG_PATH", descriptor.model_name)
            .env("ACESTEP_DEVICE", "mps")
            .env(
                "ACESTEP_INIT_LLM",
                if descriptor.lm_model.is_some() {
                    "true"
                } else {
                    "false"
                },
            )
            .env("ACESTEP_LM_MODEL_PATH", descriptor.lm_model.unwrap_or(""))
            .env("ACESTEP_LM_BACKEND", descriptor.lm_backend)
            .env("ACESTEP_OFFLOAD_TO_CPU", "true")
            .stdout(Stdio::from(log_file.try_clone().map_err(|error| {
                AppError::backend_start_failed(error.to_string())
            })?))
            .stderr(Stdio::from(log_file));

        let child = command.spawn().map_err(|error| {
            AppError::backend_start_failed(format!(
                "OpenLoop could not start the local generation engine automatically: {error}"
            ))
        })?;

        self.logs_path = Some(log_path);
        self.child = Some(child);
        self.status = BackendStatus::Starting;

        let started = Instant::now();
        let client = Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|error| AppError::backend_start_failed(error.to_string()))?;
        let health_url = format!("http://127.0.0.1:{}/health", settings.backend_port);

        while started.elapsed() < Duration::from_secs(60) {
            if let Some(child) = &mut self.child {
                if let Ok(Some(exit_status)) = child.try_wait() {
                    self.child = None;
                    let error = AppError::backend_start_failed(format!(
                        "backend exited before becoming healthy with status {exit_status}"
                    ));
                    self.status = BackendStatus::Failed {
                        error: error.clone(),
                    };
                    return Err(error);
                }
            }

            if let Ok(response) = client.get(&health_url).send() {
                if response.status().is_success() {
                    self.status = BackendStatus::Healthy {
                        port: settings.backend_port,
                    };
                    return Ok(self.status.clone());
                }
            }

            thread::sleep(Duration::from_secs(1));
        }

        self.stop()?;
        let error = AppError::backend_health_timeout(format!(
            "health endpoint {health_url} did not become ready within 60 seconds"
        ));
        self.status = BackendStatus::Failed {
            error: error.clone(),
        };
        Err(error)
    }

    pub fn stop(&mut self) -> AppResult<BackendStatus> {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        self.status = BackendStatus::Stopped;
        Ok(self.status.clone())
    }

    pub fn restart(&mut self, settings: &AppSettings) -> AppResult<BackendStatus> {
        self.stop()?;
        self.start(settings)
    }

    fn bundled_uv_command(&self) -> AppResult<PathBuf> {
        let path = self.sidecar_dir.join(BUNDLED_UV_EXECUTABLE_NAME);
        if is_executable_file(&path) {
            return Ok(path);
        }

        Err(AppError::backend_start_failed(format!(
            "OpenLoop's bundled uv sidecar is missing or not executable at {}. Rebuild the app with pnpm prepare:sidecars before packaging.",
            path.display()
        )))
    }
}

#[cfg(windows)]
const BUNDLED_UV_EXECUTABLE_NAME: &str = "uv.exe";

#[cfg(not(windows))]
const BUNDLED_UV_EXECUTABLE_NAME: &str = "uv";

#[cfg(unix)]
fn is_executable_file(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;

    fs::metadata(path)
        .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable_file(path: &Path) -> bool {
    fs::metadata(path)
        .map(|metadata| metadata.is_file())
        .unwrap_or(false)
}

impl Drop for BackendManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::{BackendManager, BUNDLED_UV_EXECUTABLE_NAME};
    use crate::models::{
        backend::BackendStatus,
        settings::{AppSettings, ModelVariant},
    };
    use std::{fs, os::unix::fs::PermissionsExt};

    #[test]
    fn mock_backend_becomes_healthy_and_stops_cleanly() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let sidecar_dir = temp_dir.path().join("sidecars");
        fs::create_dir_all(&sidecar_dir).expect("sidecar dir should exist");
        let script_path = temp_dir.path().join("mock-backend.sh");
        fs::write(
            &script_path,
            r#"#!/bin/sh
python3 - <<'PY'
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

port = int(os.environ.get('ACE_STEP_PORT', '18080'))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

HTTPServer(('127.0.0.1', port), Handler).serve_forever()
PY
"#,
        )
        .expect("script should write");
        let mut permissions = fs::metadata(&script_path)
            .expect("metadata should load")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script_path, permissions).expect("permissions should set");
        fs::copy(&script_path, sidecar_dir.join(BUNDLED_UV_EXECUTABLE_NAME))
            .expect("mock sidecar should copy");

        let mut settings = AppSettings::default();
        settings.backend_working_directory = Some(temp_dir.path().display().to_string());
        settings.log_directory = Some(temp_dir.path().join("logs").display().to_string());
        settings.model_variant = Some(ModelVariant::Turbo);
        settings.backend_port = 18081;

        let mut manager = BackendManager::new(temp_dir.path().to_path_buf(), sidecar_dir);
        let status = manager.start(&settings).expect("backend should start");
        assert!(matches!(status, BackendStatus::Healthy { port: 18081 }));
        assert!(manager.logs_path().is_some());

        let stopped = manager.stop().expect("backend should stop");
        assert!(matches!(stopped, BackendStatus::Stopped));
    }

    #[test]
    fn uses_bundled_uv_sidecar_from_resource_dir() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let sidecar_dir = temp_dir.path().join("sidecars");
        fs::create_dir_all(&sidecar_dir).expect("sidecar dir should exist");
        let uv_path = sidecar_dir.join(BUNDLED_UV_EXECUTABLE_NAME);
        fs::write(&uv_path, "#!/bin/sh\n").expect("uv fixture should write");
        let mut permissions = fs::metadata(&uv_path)
            .expect("metadata should load")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&uv_path, permissions).expect("permissions should set");

        let manager = BackendManager::new(temp_dir.path().to_path_buf(), sidecar_dir);
        let resolved = manager
            .bundled_uv_command()
            .expect("bundled uv should resolve");

        assert_eq!(resolved, uv_path);
    }

    #[test]
    fn fails_when_bundled_uv_sidecar_is_missing() {
        let temp_dir = tempfile::tempdir().expect("temp dir should exist");
        let sidecar_dir = temp_dir.path().join("sidecars");
        fs::create_dir_all(&sidecar_dir).expect("sidecar dir should exist");
        let manager = BackendManager::new(temp_dir.path().to_path_buf(), sidecar_dir);

        let error = manager
            .bundled_uv_command()
            .expect_err("bundled uv should be missing");

        assert_eq!(error.code, "BACKEND_START_FAILED");
        assert!(error
            .details
            .as_deref()
            .unwrap_or_default()
            .contains("bundled uv sidecar is missing"));
    }
}
