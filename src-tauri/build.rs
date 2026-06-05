fn main() {
    #[cfg(target_os = "macos")]
    {
        let manifest_dir = std::path::PathBuf::from(
            std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by Cargo"),
        );
        let window_shell_source = manifest_dir.join("src/macos/window_shell.m");
        println!("cargo:rerun-if-changed={}", window_shell_source.display());

        cc::Build::new()
            .file(window_shell_source)
            .flag("-mmacosx-version-min=11.0")
            .flag("-fobjc-arc")
            .compile("openloop-window-shell");

        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=QuartzCore");
    }

    tauri_build::build()
}
