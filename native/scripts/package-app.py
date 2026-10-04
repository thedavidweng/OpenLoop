#!/usr/bin/env python3
"""Build an unsigned Apple Silicon app bundle; signing is a release step."""
import argparse
import json
import plistlib
import shutil
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--uv", required=True, type=Path, help="Verified bundled uv executable")
parser.add_argument("--output", type=Path, default=Path("native/dist/OpenLoop.app"))
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
if not args.uv.is_file():
    parser.error("--uv must point to the prepared sidecar executable")
subprocess.run(["swift", "build", "--package-path", str(root / "native"), "-c", "release", "--arch", "arm64"], check=True)
bin_path = Path(subprocess.check_output(["swift", "build", "--package-path", str(root / "native"), "-c", "release", "--arch", "arm64", "--show-bin-path"], text=True).strip())
output = args.output.resolve()
# Refuse to overwrite a bundle; caller explicitly removes a previous build.
output.mkdir(parents=True)
macos = output / "Contents/MacOS"; macos.mkdir(parents=True)
resources = output / "Contents/Resources"; resources.mkdir()
# macOS volumes are usually case-insensitive: a CLI named "openloop" would replace the GUI.
executables = {"OpenLoop": bin_path / "OpenLoop", "openloop-cli": bin_path / "openloop-cli", "uv": args.uv}
assert len({name.lower() for name in executables}) == len(executables)
for name, source in executables.items(): shutil.copy2(source, macos / name)
for executable in macos.iterdir(): executable.chmod(0o755)
for bundle in bin_path.glob("*.bundle"):
    if bundle.stem.endswith("Tests"): continue
    shutil.copytree(bundle, resources / bundle.name)
    (macos / bundle.name).symlink_to(Path("../Resources") / bundle.name)
shutil.copy2(root / "src-tauri/icons/OpenLoop.icns", resources / "OpenLoop.icns")
version = json.loads((root / "package.json").read_text())["version"]
info = {
    "CFBundleIdentifier": "com.openmusic.openloop",
    "CFBundleName": "OpenLoop", "CFBundleDisplayName": "OpenLoop",
    "CFBundleExecutable": "OpenLoop", "CFBundlePackageType": "APPL",
    "CFBundleShortVersionString": version, "CFBundleVersion": version,
    "CFBundleIconFile": "OpenLoop.icns", "LSMinimumSystemVersion": "15.0",
    "NSHighResolutionCapable": True,
}
with (output / "Contents/Info.plist").open("wb") as stream: plistlib.dump(info, stream)
print(output)
