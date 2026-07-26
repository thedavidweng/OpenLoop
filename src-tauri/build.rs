fn main() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by Cargo"),
    );

    // Embed the git short SHA as a build identifier for diagnostics.
    // Falls back to "unknown" when git is unavailable or this is not a checkout.
    let git_hash = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|s| s.trim().to_owned())
        .unwrap_or_else(|| "unknown".to_owned());
    println!("cargo:rustc-env=GIT_BUILD_HASH={git_hash}");

    // Once any rerun-if-changed is emitted (window_shell.m below), Cargo stops
    // rerunning this script on package changes — so HEAD movement must be
    // tracked explicitly or the embedded SHA goes stale on commits that never
    // touch src-tauri. HEAD itself only changes on branch switches; the
    // resolved branch ref file changes on every commit.
    let git_dir = manifest_dir.parent().map(|root| root.join(".git"));
    if let Some(git_dir) = git_dir.filter(|dir| dir.exists()) {
        println!("cargo:rerun-if-changed={}", git_dir.join("HEAD").display());
        if let Ok(head) = std::fs::read_to_string(git_dir.join("HEAD")) {
            if let Some(reference) = head.trim().strip_prefix("ref: ") {
                println!(
                    "cargo:rerun-if-changed={}",
                    git_dir.join(reference).display()
                );
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let window_shell_source = manifest_dir.join("src/macos/window_shell.m");
        println!("cargo:rerun-if-changed={}", window_shell_source.display());

        cc::Build::new()
            .file(window_shell_source)
            .flag("-mmacosx-version-min=11.0")
            .flag("-fobjc-arc")
            .compile("openloop-window-shell");

        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }

    tauri_build::build()
}
