#!/usr/bin/env python3
"""One-time import of the retiring Rust model download manifest."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = (root / "src-tauri/src/services/model_manager/specs.rs").read_text()
lists = {}
for name, body in re.findall(r"const (\w+): &\[ModelFileSpec\] = &\[(.*?)\n\];", source, re.S):
    lists[name] = [
        dict(repo=repo, remotePath=remote, localPath=local, size=int(size.replace("_", "")))
        for repo, remote, local, size in re.findall(
            r'repo: "([^"]+)",\s*remote_path: "([^"]+)",\s*local_path: "([^"]+)",\s*size: ([\d_]+)', body
        )
    ]
shared = lists["SHARED_VAE_FILES"] + lists["SHARED_TEXT_EMBED_FILES"]
manifest = {
    "ace-step/standard": lists["ACESTEP_V15_TURBO_FILES"] + lists["ACESTEP_LM_06B_FILES"] + shared,
    "ace-step/xl": lists["ACESTEP_V15_XL_TURBO_FILES"] + lists["ACESTEP_LM_17B_FILES"] + shared,
}
output = root / "native/Sources/OpenLoopEngines/Resources/model-files.json"
output.write_text(json.dumps(manifest, indent=2) + "\n")
print(output)
