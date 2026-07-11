use std::{
    fs::{self},
    path::{Path, PathBuf},
};

use crate::models::errors::{AppError, AppResult};

pub fn resolve_path_within_base(canonical_base: &Path, relative: &str) -> AppResult<PathBuf> {
    for component in std::path::Path::new(relative).components() {
        if matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        ) {
            return Err(AppError::backend_provision_failed(format!(
                "zip entry contains unsafe path component: {relative}"
            )));
        }
    }

    let mut resolved = canonical_base.to_path_buf();
    for component in std::path::Path::new(relative).components() {
        match component {
            std::path::Component::Normal(part) => resolved.push(part),
            std::path::Component::CurDir => {}
            _ => {
                return Err(AppError::backend_provision_failed(
                    "zip entry contains invalid path component after validation",
                ));
            }
        }
    }

    if !resolved.starts_with(canonical_base) {
        return Err(AppError::backend_provision_failed(format!(
            "zip entry escapes extraction directory: {relative}"
        )));
    }

    Ok(resolved)
}

pub fn extract_archive(archive_path: &Path, runtime_dir: &Path) -> AppResult<()> {
    let file = fs::File::open(archive_path).map_err(|error| {
        AppError::backend_provision_failed(format!(
            "failed to open archive {}: {error}",
            archive_path.display()
        ))
    })?;

    let mut archive = zip::ZipArchive::new(file).map_err(|error| {
        AppError::backend_provision_failed(format!("failed to read zip archive: {error}"))
    })?;

    // GitHub zips have a single top-level directory like "ACE-Step-1.5-d5d958e/"
    // We need to strip that prefix when extracting.
    let top_level_prefix = find_top_level_prefix(&mut archive)?;

    fs::create_dir_all(runtime_dir).map_err(|error| {
        AppError::backend_provision_failed(format!(
            "failed to create runtime directory {}: {error}",
            runtime_dir.display()
        ))
    })?;
    let canonical_base = fs::canonicalize(runtime_dir).map_err(|error| {
        AppError::backend_provision_failed(format!(
            "failed to canonicalize runtime directory {}: {error}",
            runtime_dir.display()
        ))
    })?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|error| {
            AppError::backend_provision_failed(format!("failed to read zip entry {i}: {error}"))
        })?;

        let entry_name = entry.mangled_name().to_string_lossy().to_string();

        // Strip the top-level prefix
        let relative = match top_level_prefix.strip_prefix() {
            Some(prefix) => {
                if let Some(rest) = entry_name.strip_prefix(prefix) {
                    rest.to_owned()
                } else if entry_name == prefix.trim_end_matches('/') {
                    // The directory entry itself — skip
                    continue;
                } else {
                    continue;
                }
            }
            None => entry_name.clone(),
        };

        if relative.is_empty() {
            continue;
        }

        // Reject entries with path traversal or absolute components to prevent zip-slip
        for component in std::path::Path::new(&relative).components() {
            if matches!(
                component,
                std::path::Component::ParentDir | std::path::Component::RootDir
            ) {
                return Err(AppError::backend_provision_failed(format!(
                    "zip entry contains unsafe path component: {relative}"
                )));
            }
            #[cfg(windows)]
            if matches!(component, std::path::Component::Prefix(_)) {
                return Err(AppError::backend_provision_failed(format!(
                    "zip entry contains unsafe path component: {relative}"
                )));
            }
        }

        let outpath = resolve_path_within_base(&canonical_base, &relative)?;

        if entry.is_dir() {
            fs::create_dir_all(&outpath).map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to create directory {}: {error}",
                    outpath.display()
                ))
            })?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    AppError::backend_provision_failed(format!(
                        "failed to create parent directory {}: {error}",
                        parent.display()
                    ))
                })?;
            }
            let mut outfile = fs::File::create(&outpath).map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to create file {}: {error}",
                    outpath.display()
                ))
            })?;
            std::io::copy(&mut entry, &mut outfile).map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to extract file {}: {error}",
                    outpath.display()
                ))
            })?;
        }

        // Preserve Unix permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = entry.unix_mode() {
                let _ = fs::set_permissions(&outpath, fs::Permissions::from_mode(mode));
            }
        }
    }

    Ok(())
}

struct TopLevelPrefix {
    prefix: String,
}

impl TopLevelPrefix {
    fn strip_prefix(&self) -> Option<&str> {
        if self.prefix.is_empty() {
            None
        } else {
            Some(&self.prefix)
        }
    }
}

fn find_top_level_prefix(archive: &mut zip::ZipArchive<fs::File>) -> AppResult<TopLevelPrefix> {
    let mut prefixes: Vec<String> = Vec::new();

    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|error| {
            AppError::backend_provision_failed(format!("failed to read zip entry {i}: {error}"))
        })?;

        let name = entry.mangled_name().to_string_lossy().to_string();
        if let Some(slash_pos) = name.find('/') {
            let prefix = name[..slash_pos + 1].to_owned();
            if !prefixes.contains(&prefix) {
                prefixes.push(prefix);
            }
        }
    }

    if prefixes.len() == 1 {
        Ok(TopLevelPrefix {
            prefix: prefixes.into_iter().next().unwrap(),
        })
    } else {
        // No clear prefix — extract as-is
        Ok(TopLevelPrefix {
            prefix: String::new(),
        })
    }
}
