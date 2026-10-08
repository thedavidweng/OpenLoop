#!/usr/bin/env python3
"""Build and verify a signed Apple Silicon app, optionally packaged as a DMG."""
import argparse
import json
import plistlib
import shutil
import subprocess
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--uv", required=True, type=Path, help="Verified bundled uv executable")
parser.add_argument("--output", type=Path, default=Path("native/dist/OpenLoop.app"))
parser.add_argument("--sign", default="-", help="Signing identity; '-' is the Alpha ad-hoc identity")
parser.add_argument("--dmg", type=Path, help="Create an installable DMG at this path")
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
if not args.uv.is_file():
    parser.error("--uv must point to the prepared sidecar executable")
subprocess.run(["swift", "build", "--package-path", str(root / "native"), "-c", "release", "--arch", "arm64"], check=True, timeout=900)
bin_path = Path(subprocess.check_output(["swift", "build", "--package-path", str(root / "native"), "-c", "release", "--arch", "arm64", "--show-bin-path"], text=True, timeout=30).strip())
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
shutil.copy2(root / "native/Assets/OpenLoop.icns", resources / "OpenLoop.icns")
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
# Sign nested tools before sealing the completed app's resources.
signing = ["codesign", "--force", "--sign", args.sign]
if args.sign != "-":
    signing += ["--timestamp", "--options", "runtime"]
for name in ("openloop-cli", "uv"):
    subprocess.run([*signing, "--identifier", f"com.openmusic.openloop.{name}", str(macos / name)], check=True)
subprocess.run([*signing, str(output)], check=True)
subprocess.run(["codesign", "--verify", "--deep", "--strict", str(output)], check=True)
print(output)
if args.dmg:
    destination = args.dmg.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="openloop-dmg-") as directory:
        staging = Path(directory)
        shutil.copytree(output, staging / output.name, symlinks=True)
        (staging / "Applications").symlink_to("/Applications")
        subprocess.run(["hdiutil", "create", "-volname", "OpenLoop", "-srcfolder", str(staging),
                        "-format", "UDZO", str(destination)], check=True)
    print(destination)
