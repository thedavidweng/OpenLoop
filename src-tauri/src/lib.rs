mod app_menu;
pub mod app_state;
pub mod audio;
pub mod cli;
pub mod commands;
pub mod models;
pub mod services;
pub mod window_shell;

pub use app_state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(error) => {
                    crate::services::observability::init_stderr_only();
                    return Err(error.into());
                }
            };
            crate::services::observability::init(&app_data_dir);
            let sidecar_dir = app_state::current_executable_dir()
                .map_err(|error| std::io::Error::other(error.message.clone()))?;
            let state = AppState::init(app_data_dir, sidecar_dir)
                .map_err(|error| std::io::Error::other(error.message.clone()))?;
            let window_shell_state = window_shell::initialize_main_window(app);

            app.manage(window_shell_state);
            app.manage(state);
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
            commands::files::delete_generation_file_and_record,
            commands::files::export_generations_to_folder,
            commands::files::prepare_drag_payload,
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::settings::reset_runtime_settings,
            commands::settings::get_default_app_paths,
            commands::settings::add_cli_to_path,
            commands::settings::remove_cli_from_path,
            commands::settings::is_cli_in_path,
            commands::models::list_model_catalog,
            commands::models::get_model_status,
            commands::models::download_model,
            commands::models::delete_model,
            commands::models::clear_partial_downloads,
            commands::models::cancel_download,
            commands::models::delete_all_models,
            commands::provisioner::get_backend_provision_status,
            commands::provisioner::provision_backend,
            commands::provisioner::check_backend_updates,
            commands::provisioner::update_backend,
            commands::history::list_generations,
            commands::history::get_generation,
            commands::history::delete_generation,
            commands::history::clear_generation_history,
            commands::history::toggle_generation_favorite,
            commands::history::list_failed_runs,
            commands::history::clear_failed_runs,
            commands::history::delete_failed_run,
            commands::generation::insert_generation,
            commands::generation::generate_music,
            commands::generation::cancel_generation,
            commands::generation::enhance_prompt,
            commands::generation::list_active_generation_tasks,
            commands::generation::resume_generation_task,
            commands::generation::discard_active_generation_task,
            commands::network::get_network_log,
            commands::support::collect_diagnostics,
            commands::window_shell::get_window_shell_state,
        ]);

    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(app_menu::build_app_menu)
        .on_menu_event(app_menu::handle_menu_event);

    if let Err(error) = builder.run(tauri::generate_context!()) {
        crate::services::observability::init_stderr_only();
        tracing::error!("openloop: {error}");
    }
}
