/// Canonical definitions for all outbound URLs used by OpenLoop.
///
/// This module is the single source of truth for external endpoints.
/// Adding a new outbound URL requires an ADR update (see ADR-0004).
pub const HF_RESOLVE_BASE: &str = "https://huggingface.co";

/// GitHub repository for ACE-Step backend.
pub const ACE_STEP_REPO: &str = "ACE-Step/ACE-Step-1.5";

/// GitHub API base for fetching release information.
pub fn github_releases_latest_url(repo: &str) -> String {
    format!("https://api.github.com/repos/{repo}/releases/latest")
}

/// GitHub API base for resolving a tag to a commit SHA.
pub fn github_tag_ref_url(repo: &str, tag: &str) -> String {
    format!("https://api.github.com/repos/{repo}/git/ref/tags/{tag}")
}

/// GitHub codeload archive download URL.
pub fn github_archive_url(repo: &str, git_ref: &str) -> String {
    format!("https://codeload.github.com/{repo}/zip/{git_ref}")
}

/// Local ACE-Step backend base URL.
pub fn local_backend_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

/// Local ACE-Step backend health endpoint.
pub fn local_backend_health_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/health")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_outbound_urls_are_defined() {
        // Verify all expected URL functions exist and return valid URLs
        let hf = HF_RESOLVE_BASE;
        assert!(hf.starts_with("https://"), "HF base should be HTTPS");

        let releases = github_releases_latest_url(ACE_STEP_REPO);
        assert!(releases.starts_with("https://api.github.com/"));
        assert!(releases.contains(ACE_STEP_REPO));

        let tag_ref = github_tag_ref_url(ACE_STEP_REPO, "v1.5.0");
        assert!(tag_ref.starts_with("https://api.github.com/"));
        assert!(tag_ref.contains("v1.5.0"));

        let archive = github_archive_url(ACE_STEP_REPO, "abc123");
        assert!(archive.starts_with("https://codeload.github.com/"));
        assert!(archive.contains("abc123"));

        let local = local_backend_url(8001);
        assert_eq!(local, "http://127.0.0.1:8001");

        let health = local_backend_health_url(8001);
        assert_eq!(health, "http://127.0.0.1:8001/health");
    }

    #[test]
    fn ace_step_repo_constant_is_correct() {
        assert_eq!(ACE_STEP_REPO, "ACE-Step/ACE-Step-1.5");
    }

    #[test]
    fn hf_resolve_base_is_correct() {
        assert_eq!(HF_RESOLVE_BASE, "https://huggingface.co");
    }
}
