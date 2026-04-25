use crate::{
    models::{errors::AppResult, settings::DeviceInfo},
    services::device,
};

#[tauri::command]
pub fn get_device_info() -> AppResult<DeviceInfo> {
    device::detect_device_info()
}
