use super::types::ModelFileSpec;
use super::types::HF_RESOLVE_BASE;

/// Resolve the download URL for a model file under the configured mirror.
///
/// Hugging Face uses `resolve/main`, while ModelScope mirrors use `resolve/master`.
pub fn resolve_download_url(spec: &ModelFileSpec, mirror: &str) -> String {
    let base = if mirror.is_empty() {
        HF_RESOLVE_BASE
    } else {
        mirror
    };
    if base.contains("modelscope") {
        format!("{base}/{}/resolve/master/{}", spec.repo, spec.remote_path)
    } else {
        format!("{base}/{}/resolve/main/{}", spec.repo, spec.remote_path)
    }
}
