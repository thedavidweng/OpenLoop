mod app_menu;
pub mod audio;
pub mod commands;
pub mod models;
pub mod services;
pub mod window_shell;

use std::{
    fs,
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, Arc, Mutex},
};

use services::{backend_manager::BackendManager, db::Database, model_manager::ModelManager};
use tauri::Manager;

#[derive(Debug, Clone)]
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub db: Database,
    pub backend: Arc<Mutex<BackendManager>>,
    pub models: Arc<Mutex<ModelManager>>,
    pub generation_cancelled: Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let sidecar_dir = current_executable_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db = Database::new(&app_data_dir)
                .map_err(|error| std::io::Error::other(error.message.clone()))?;
            let backend = Arc::new(Mutex::new(BackendManager::new(
                app_data_dir.clone(),
                sidecar_dir,
            )));
            let models = Arc::new(Mutex::new(ModelManager::new(app_data_dir.clone())));
            let generation_cancelled = Arc::new(AtomicBool::new(false));
            let window_shell_state = window_shell::initialize_main_window(app);

            app.manage(window_shell_state);
            app.manage(AppState {
                app_data_dir,
                db,
                backend,
                models,
                generation_cancelled,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::backend::backend_status,
            commands::backend::start_backend,
            commands::backend::stop_backend,
            commands::backend::restart_backend,
            commands::backend::get_backend_logs_path,
            commands::backend::clear_backend_cache,
            commands::device::get_device_info,
            commands::files::reveal_in_finder,
            commands::files::copy_audio_to,
            commands::files::file_exists,
            commands::files::read_generation_audio,
            commands::files::read_generation_waveform,
            commands::files::delete_generation_file,
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::settings::reset_runtime_settings,
            commands::settings::get_default_app_paths,
            commands::models::list_model_catalog,
            commands::models::get_model_status,
            commands::models::download_model,
            commands::models::delete_model,
            commands::history::list_generations,
            commands::history::get_generation,
            commands::history::delete_generation,
            commands::generation::insert_generation,
            commands::generation::generate_music,
            commands::generation::cancel_generation,
            commands::generation::enhance_prompt,
            commands::generation::list_active_generation_tasks,
            commands::generation::resume_generation_task,
            commands::generation::discard_active_generation_task,
            commands::window_shell::get_window_shell_state,
        ]);

    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(|app| app_menu::build_app_menu(app))
        .on_menu_event(app_menu::handle_menu_event);

    builder
        .run(tauri::generate_context!())
        .expect("error while running OpenLoop");
}

fn current_executable_dir() -> std::io::Result<PathBuf> {
    std::env::current_exe().and_then(|path| {
        path.parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| std::io::Error::other("current executable has no parent directory"))
    })
}
