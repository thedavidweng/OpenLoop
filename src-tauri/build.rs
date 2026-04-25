fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-changed=src/macos/window_shell.m");

        cc::Build::new()
            .file("src/macos/window_shell.m")
            .flag("-mmacosx-version-min=11.0")
            .flag("-fobjc-arc")
            .compile("openloop-window-shell");

        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }

    tauri_build::build()
}
