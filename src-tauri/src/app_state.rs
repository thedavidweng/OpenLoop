use std::{
    fs,
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, Arc, Mutex},
};

use crate::{
    models::errors::{AppError, AppResult},
    services::{
        backend_manager::BackendManager, backend_provisioner::BackendProvisioner, db::Database,
        file_store::FileStore, generation_task::GenerationTaskRunner, model_manager::ModelManager,
        network_log::NetworkActivityLog,
    },
};

#[derive(Debug, Clone)]
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub db: Database,
    pub backend: Arc<Mutex<BackendManager>>,
    pub models: Arc<Mutex<ModelManager>>,
    pub provisioner: Arc<Mutex<BackendProvisioner>>,
    pub generation_cancelled: Arc<AtomicBool>,
    pub network_log: Arc<NetworkActivityLog>,
}

impl AppState {
    pub fn init(app_data_dir: PathBuf, sidecar_dir: PathBuf) -> AppResult<Self> {
        fs::create_dir_all(&app_data_dir).map_err(|error| AppError::internal(error.to_string()))?;
        let db = Database::new(&app_data_dir)?;
        let network_log = Arc::new(NetworkActivityLog::new());
        let backend = Arc::new(Mutex::new(BackendManager::new(
            app_data_dir.clone(),
            sidecar_dir,
            Arc::clone(&network_log),
        )));
        let models = Arc::new(Mutex::new(ModelManager::new(
            app_data_dir.clone(),
            Arc::clone(&network_log),
        )));
        let provisioner = Arc::new(Mutex::new(BackendProvisioner::new(
            app_data_dir.clone(),
            Arc::clone(&network_log),
        )));
        let generation_cancelled = Arc::new(AtomicBool::new(false));

        Ok(Self {
            app_data_dir,
            db,
            backend,
            models,
            provisioner,
            generation_cancelled,
            network_log,
        })
    }

    pub fn init_for_cli() -> AppResult<Self> {
        Self::init(default_app_data_dir()?, current_executable_dir()?)
    }

    pub fn lock_backend(&self) -> AppResult<std::sync::MutexGuard<'_, BackendManager>> {
        self.backend
            .lock()
            .map_err(|_| AppError::internal("backend manager lock poisoned"))
    }

    pub fn generation_runner(&self) -> GenerationTaskRunner {
        GenerationTaskRunner::new(
            self.db.clone(),
            FileStore::new(self.app_data_dir.clone()),
            self.generation_cancelled.clone(),
        )
    }
}

pub fn current_executable_dir() -> AppResult<PathBuf> {
    std::env::current_exe()
        .map_err(|error| AppError::internal(error.to_string()))
        .and_then(|path| {
            path.parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| AppError::internal("current executable has no parent directory"))
        })
}

#[allow(clippy::needless_return)]
pub fn default_app_data_dir() -> AppResult<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| AppError::internal("HOME is not set"))?;
        return Ok(home
            .join("Library")
            .join("Application Support")
            .join("com.openmusic.openloop"));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(data_home) = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from) {
            return Ok(data_home.join("com.openmusic.openloop"));
        }
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| AppError::internal("HOME is not set"))?;
        return Ok(home
            .join(".local")
            .join("share")
            .join("com.openmusic.openloop"));
    }

    #[cfg(windows)]
    {
        let app_data = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| AppError::internal("APPDATA is not set"))?;
        return Ok(app_data.join("com.openmusic.openloop"));
    }
}
