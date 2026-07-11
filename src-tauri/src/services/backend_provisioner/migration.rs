use std::{fs, path::Path};

/// Read the commit SHA from a git-cloned runtime directory's `.git/HEAD`.
pub fn read_git_head(runtime_dir: &Path) -> Option<String> {
    let head_path = runtime_dir.join(".git").join("HEAD");
    let content = fs::read_to_string(&head_path).ok()?;
    let content = content.trim();

    // If HEAD is a ref like "ref: refs/heads/main", resolve it
    if let Some(ref_line) = content.strip_prefix("ref: ") {
        let ref_path = runtime_dir.join(".git").join(ref_line);
        let ref_content = fs::read_to_string(&ref_path).ok()?;
        return Some(ref_content.trim().to_owned());
    }

    // Direct commit SHA
    if content.len() >= 7 && content.chars().all(|c| c.is_ascii_hexdigit()) {
        return Some(content.to_owned());
    }

    None
}
