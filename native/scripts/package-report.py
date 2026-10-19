#!/usr/bin/env python3
"""Record source, toolchain, checksums and logical bytes without counting symlinks twice."""
import argparse
import hashlib
import json
import plistlib
import subprocess
from pathlib import Path


def breakdown(bundle):
    sizes = dict(gui=0, cli=0, uv=0, encoder=0, encoder_compliance=0,
                 resources=0, icons=0, other=0)
    for path in bundle.rglob("*"):
        if path.is_symlink() or not path.is_file():
            continue
        relative = path.relative_to(bundle).as_posix()
        if relative == "Contents/MacOS/OpenLoop":
            category = "gui"
        elif relative == "Contents/MacOS/openloop-cli":
            category = "cli"
        elif relative == "Contents/MacOS/uv":
            category = "uv"
        elif relative == "Contents/MacOS/ffmpeg":
            category = "encoder"
        elif relative.startswith("Contents/Resources/AudioEncoder/"):
            category = "encoder_compliance"
        elif path.suffix == ".icns":
            category = "icons"
        elif any(part.endswith(".bundle") for part in path.relative_to(bundle).parts):
            category = "resources"
        else:
            category = "other"
        sizes[category] += path.stat().st_size
    total = sum(sizes.values())
    return {
        "app_bytes": total,
        "components": {
            name: {"bytes": size, "percent": round(size / total * 100, 3)}
            for name, size in sizes.items()
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True, type=Path)
    parser.add_argument("--dmg", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    info = plistlib.loads((args.bundle / "Contents/Info.plist").read_bytes())
    report = {
        "revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
        "swift": subprocess.check_output(["swift", "--version"], text=True).strip(),
        "build": "swift build --package-path native --jobs 2 -c release --arch arm64",
        "version": info["CFBundleShortVersionString"],
        **breakdown(args.bundle),
        "dmg": {
            "name": args.dmg.name,
            "bytes": args.dmg.stat().st_size,
            "sha256": hashlib.sha256(args.dmg.read_bytes()).hexdigest(),
        },
    }
    args.output.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
