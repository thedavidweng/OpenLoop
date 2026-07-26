use tauri::{
    menu::{AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Runtime,
};

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ACTION_EVENT: &str = "openloop://menu-action";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ACTION_NEW_GENERATION: &str = "new-generation";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ACTION_OPEN_SETTINGS: &str = "open-settings";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ACTION_OPEN_SETUP: &str = "open-setup";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ACTION_REVEAL_OUTPUT_FOLDER: &str = "reveal-output-folder";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ACTION_TOGGLE_SIDEBAR: &str = "toggle-sidebar";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ACTION_COPY_DEBUG_INFO: &str = "copy-debug-info";

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const MENU_ITEM_NEW_GENERATION: &str = "file.new-generation";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const MENU_ITEM_OPEN_SETTINGS: &str = "app.settings";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const MENU_ITEM_OPEN_SETUP: &str = "app.open-setup";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const MENU_ITEM_REVEAL_OUTPUT_FOLDER: &str = "file.reveal-output-folder";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const MENU_ITEM_TOGGLE_SIDEBAR: &str = "view.toggle-sidebar";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const MENU_ITEM_COPY_DEBUG_INFO: &str = "help.copy-debug-info";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const ABOUT_AUTHOR_CREDIT: &str = "@David Weng";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const ABOUT_REPOSITORY_URL: &str = "https://github.com/thedavidweng/OpenLoop";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const ABOUT_REPOSITORY_LABEL: &str = "Official Repository";

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn build_about_metadata<R: Runtime>(app_handle: &AppHandle<R>) -> AboutMetadata<'static> {
    let pkg_info = app_handle.package_info();
    let config = app_handle.config();

    AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: Some(vec![ABOUT_AUTHOR_CREDIT.to_owned()]),
        credits: Some(ABOUT_AUTHOR_CREDIT.to_owned()),
        website: Some(ABOUT_REPOSITORY_URL.to_owned()),
        website_label: Some(ABOUT_REPOSITORY_LABEL.to_owned()),
        ..Default::default()
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn build_app_menu<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let pkg_info = app_handle.package_info();
    let about_metadata = build_about_metadata(app_handle);

    let menu = Menu::with_items(
        app_handle,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app_handle,
                pkg_info.name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app_handle, None, Some(about_metadata.clone()))?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &MenuItem::with_id(
                        app_handle,
                        MENU_ITEM_OPEN_SETTINGS,
                        "Settings...",
                        true,
                        Some("CmdOrCtrl+,"),
                    )?,
                    &MenuItem::with_id(
                        app_handle,
                        MENU_ITEM_OPEN_SETUP,
                        "Open Setup...",
                        true,
                        None::<&str>,
                    )?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::services(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::hide(app_handle, None)?,
                    &PredefinedMenuItem::hide_others(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::quit(app_handle, None)?,
                ],
            )?,
            &Submenu::with_items(
                app_handle,
                "File",
                true,
                &[
                    &MenuItem::with_id(
                        app_handle,
                        MENU_ITEM_NEW_GENERATION,
                        "New Generation",
                        true,
                        Some("CmdOrCtrl+N"),
                    )?,
                    &MenuItem::with_id(
                        app_handle,
                        MENU_ITEM_REVEAL_OUTPUT_FOLDER,
                        "Reveal Output Folder",
                        true,
                        None::<&str>,
                    )?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::close_window(app_handle, None)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::quit(app_handle, None)?,
                ],
            )?,
            &Submenu::with_items(
                app_handle,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app_handle, None)?,
                    &PredefinedMenuItem::redo(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::cut(app_handle, None)?,
                    &PredefinedMenuItem::copy(app_handle, None)?,
                    &PredefinedMenuItem::paste(app_handle, None)?,
                    &PredefinedMenuItem::select_all(app_handle, None)?,
                ],
            )?,
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app_handle,
                "View",
                true,
                &[
                    &MenuItem::with_id(
                        app_handle,
                        MENU_ITEM_TOGGLE_SIDEBAR,
                        "Toggle Sidebar",
                        true,
                        Some("CmdOrCtrl+B"),
                    )?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::fullscreen(app_handle, None)?,
                ],
            )?,
            &Submenu::with_items(
                app_handle,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app_handle, None)?,
                    &PredefinedMenuItem::maximize(app_handle, None)?,
                    #[cfg(target_os = "macos")]
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::close_window(app_handle, None)?,
                ],
            )?,
            &Submenu::with_items(
                app_handle,
                "Help",
                true,
                &[
                    &MenuItem::with_id(
                        app_handle,
                        MENU_ITEM_COPY_DEBUG_INFO,
                        "Copy Debug Info",
                        true,
                        None::<&str>,
                    )?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::about(app_handle, None, Some(about_metadata.clone()))?,
                ],
            )?,
        ],
    )?;

    Ok(menu)
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn handle_menu_event<R: Runtime>(app_handle: &AppHandle<R>, event: MenuEvent) {
    let action = match event.id().as_ref() {
        MENU_ITEM_NEW_GENERATION => Some(MENU_ACTION_NEW_GENERATION),
        MENU_ITEM_OPEN_SETTINGS => Some(MENU_ACTION_OPEN_SETTINGS),
        MENU_ITEM_OPEN_SETUP => Some(MENU_ACTION_OPEN_SETUP),
        MENU_ITEM_REVEAL_OUTPUT_FOLDER => Some(MENU_ACTION_REVEAL_OUTPUT_FOLDER),
        MENU_ITEM_TOGGLE_SIDEBAR => Some(MENU_ACTION_TOGGLE_SIDEBAR),
        MENU_ITEM_COPY_DEBUG_INFO => Some(MENU_ACTION_COPY_DEBUG_INFO),
        _ => None,
    };

    if let Some(action) = action {
        if let Err(error) = app_handle.emit_to("main", MENU_ACTION_EVENT, action) {
            tracing::warn!("{}", menu_action_emit_warning(&error));
        }
    }
}

fn menu_action_emit_warning(error: &impl std::fmt::Display) -> String {
    format!("failed to emit menu action event: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_action_emit_warning_includes_error_text() {
        assert!(menu_action_emit_warning(&"channel closed").contains("channel closed"));
    }
}
