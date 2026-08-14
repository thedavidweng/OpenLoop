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
        // single-instance must be the first plugin so a second launch is
        // forwarded to the running process before anything else initializes;
        // two instances would contend on the SQLite store and sidecar port.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // The window starts hidden and is revealed via window_ready, so
        // visibility must never be restored from saved state; geometry only.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
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

            // The asset protocol serves generation audio to the <audio>
            // element with HTTP range support. The static scope in
            // tauri.conf.json covers the default output locations; a custom
            // output directory chosen in settings is granted here (and again
            // in set_setting when it changes).
            if let Ok(settings) = state.db.get_settings() {
                if let Some(dir) = settings.output_directory.as_deref() {
                    if let Err(error) = app.asset_protocol_scope().allow_directory(dir, true) {
                        tracing::warn!(
                            "failed to extend asset scope to output directory {dir}: {error}"
                        );
                    }
                }
            }

            app.manage(window_shell_state);
            app.manage(state);

            // Native reveal watchdog. The window starts hidden and the frontend
            // shows it via `window_ready` once it can paint — but if the webview
            // never gets that far (bundle load failure, crash before React
            // mounts), nothing else would ever call show() and the app would run
            // invisibly. The page-load reveal fires well before this in any
            // launch where the webview works at all.
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    if !window.is_visible().unwrap_or(true) {
                        tracing::warn!(
                            "window_ready never arrived; revealing the window as a last resort"
                        );
                        let _ = window.show();
                    }
                });
            }

            Ok(())
        })
        // Reveal fallback for throttled webviews: macOS can suspend JS timers
        // in a window that has never been shown, so the frontend's
        // window_ready request may never fire while hidden. The page-load
        // Finished event still arrives from the native navigation delegate —
        // reveal there; window_ready stays the preferred (flash-free) path
        // and showing an already-visible window is a no-op.
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished
                && webview.label() == "main"
            {
                let window = webview.window();
                if !window.is_visible().unwrap_or(true) {
                    let _ = window.show();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::backend::backend_status,
            commands::backend::start_backend,
            commands::backend::stop_backend,
            commands::backend::restart_backend,
            commands::backend::get_backend_logs_path,
            commands::backend::clear_backend_cache,
            commands::device::get_device_info,
            commands::files::allow_generation_asset,
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
            commands::models::list_model_registry,
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
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::rename_project,
            commands::projects::delete_project,
            commands::projects::assign_generation_to_project,
            commands::profiles::list_profiles,
            commands::profiles::create_profile,
            commands::profiles::rename_profile,
            commands::profiles::delete_profile,
            commands::generation::insert_generation,
            commands::generation::generate_music,
            commands::generation::cancel_generation,
            commands::generation::enhance_prompt,
            commands::generation::list_active_generation_tasks,
            commands::generation::resume_generation_task,
            commands::generation::discard_active_generation_task,
            commands::network::get_network_log,
            commands::logs::get_app_logs,
            commands::support::collect_diagnostics,
            commands::window_shell::get_window_shell_state,
            commands::window_shell::window_ready,
        ]);

    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(app_menu::build_app_menu)
        .on_menu_event(app_menu::handle_menu_event);

    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(error) => {
            crate::services::observability::init_stderr_only();
            tracing::error!("openloop: {error}");
            return;
        }
    };

    app.run(|app_handle, event| {
        // Stop the Python backend deterministically on shutdown. The `impl Drop
        // for BackendManager` remains as a backstop, but the runtime may leak the
        // managed state on exit, so terminate the child here first.
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            if let Some(state) = app_handle.try_state::<AppState>() {
                if let Ok(mut backend) = state.lock_backend() {
                    let _ = backend.stop();
                }
            }
        }
    });
}
