use std::process::Command;

use crate::models::{
    errors::{AppError, AppResult},
    settings::{DeviceInfo, RecommendedProfile},
};

fn command_output(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8(output.stdout)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

pub fn detect_device_info() -> AppResult<DeviceInfo> {
    let os =
        command_output("sw_vers", &["-productVersion"]).unwrap_or_else(|| "unknown".to_owned());
    let arch =
        command_output("uname", &["-m"]).unwrap_or_else(|| std::env::consts::ARCH.to_owned());

    let total_memory_bytes = command_output("sysctl", &["-n", "hw.memsize"])
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(|| AppError::internal("failed to read total memory with sysctl"))?;
    let total_memory_gb = ((total_memory_bytes as f64) / 1024_f64.powi(3)).round() as u64;

    let cpu_brand = command_output("sysctl", &["-n", "machdep.cpu.brand_string"]);
    let is_apple_silicon = arch == "arm64" || arch == "aarch64";

    let recommended_profile = if !is_apple_silicon {
        RecommendedProfile::Unsupported
    } else if total_memory_gb >= 24 {
        RecommendedProfile::Quality
    } else if total_memory_gb >= 16 {
        RecommendedProfile::Standard
    } else if total_memory_gb >= 8 {
        RecommendedProfile::LowMemory
    } else {
        RecommendedProfile::Unsupported
    };

    Ok(DeviceInfo {
        os,
        arch,
        is_apple_silicon,
        total_memory_gb,
        recommended_profile,
        cpu_brand,
    })
}
