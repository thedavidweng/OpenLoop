#!/usr/bin/env python3
"""Build the local-only arm64 encoder from hash-pinned upstream source releases."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("https://ffmpeg.org/releases/ffmpeg-8.0.3.tar.xz",
     "6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818"),
    ("https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz",
     "ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e"),
    ("https://downloads.xiph.org/releases/ogg/libogg-1.3.6.tar.xz",
     "5c8253428e181840cd20d41f3ca16557a9cc04bad4a3d04cce84808677fa1061"),
    ("https://downloads.xiph.org/releases/vorbis/libvorbis-1.3.7.tar.xz",
     "b33cc4934322bcbf6efcbacf49e3ca01aadbea4114ec9589d1b1e9d20f72954b"),
]


def verify(path, expected):
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected:
        raise ValueError(f"SHA-256 mismatch for {path.name}: expected {expected}, got {actual}")


def build(sources, output):
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        raise RuntimeError("Audio encoder packaging requires Apple Silicon macOS")
    sources.mkdir(parents=True, exist_ok=True)
    for url, digest in SOURCES:
        archive = sources / url.rsplit("/", 1)[1]
        if not archive.exists():
            with urllib.request.urlopen(url, timeout=30) as response:
                archive.write_bytes(response.read())
        verify(archive, digest)

    # Serialize compiler work with the other native implementation worker.
    with open("/tmp/openloop-heavy-build.lock", "a") as lock:
        print("Waiting for the shared heavy-build lock", flush=True)
        fcntl.flock(lock, fcntl.LOCK_EX)
        with tempfile.TemporaryDirectory(prefix="openloop-encoder-") as directory:
            work = Path(directory)
            prefix = work / "prefix"
            env = dict(os.environ, MACOSX_DEPLOYMENT_TARGET="15.0",
                       CC="/usr/bin/clang", CXX="/usr/bin/clang++",
                       CFLAGS="-O2 -arch arm64", LDFLAGS="-arch arm64",
                       PKG_CONFIG_LIBDIR=str(prefix / "lib/pkgconfig"),
                       PKG_CONFIG_PATH="")

            def run(command, cwd):
                subprocess.run(command, cwd=cwd, env=env, check=True)

            for url, _ in SOURCES:
                run(["/usr/bin/tar", "-xf", str(sources / url.rsplit("/", 1)[1]),
                     "-C", str(work)], work)
            for name in ("lame-3.100", "libogg-1.3.6", "libvorbis-1.3.7"):
                source = work / name
                options = ["./configure", f"--prefix={prefix}", "--disable-shared",
                           "--enable-static", "--disable-dependency-tracking"]
                if name.startswith("lame"):
                    options += ["--disable-frontend"]
                run(options, source)
                # Vorbis 1.3.7's Darwin defaults contain a removed PowerPC linker flag.
                run(["make", "-j2", f"CFLAGS={env['CFLAGS']}"], source)
                run(["make", "-j2", "install", f"CFLAGS={env['CFLAGS']}"], source)
            source = work / "ffmpeg-8.0.3"
            run(["./configure", f"--prefix={prefix}", "--cc=/usr/bin/clang",
                 "--arch=arm64", "--target-os=darwin", "--disable-autodetect",
                 "--disable-everything", "--disable-network", "--disable-doc",
                 "--disable-debug", "--disable-shared", "--enable-static",
                 "--disable-ffplay", "--disable-ffprobe", "--enable-ffmpeg",
                 "--enable-libmp3lame", "--enable-libvorbis",
                 "--pkg-config-flags=--static", f"--extra-cflags=-I{prefix}/include",
                 f"--extra-ldflags=-L{prefix}/lib", "--enable-protocol=file",
                 "--enable-demuxer=wav,mp3,flac,ogg",
                 "--enable-decoder=pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le,mp3float,flac,vorbis",
                 "--enable-encoder=libmp3lame,libvorbis,flac,pcm_s16le",
                 "--enable-muxer=mp3,flac,ogg,wav",
                 "--enable-filter=aresample,aformat,anull"], source)
            run(["make", "-j2", "ffmpeg"], source)
            output.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source / "ffmpeg", output / "ffmpeg")
            run(["/usr/bin/strip", "-x", str(output / "ffmpeg")], work)
            dependencies = subprocess.check_output(
                ["/usr/bin/otool", "-L", str(output / "ffmpeg")], text=True)
            for line in dependencies.splitlines()[1:]:
                path = line.strip().split(" ")[0]
                if not path.startswith(("/usr/lib/", "/System/Library/")):
                    raise RuntimeError(f"Non-system dynamic dependency: {path}")
            compliance = output / "Source"
            compliance.mkdir(exist_ok=True)
            for url, _ in SOURCES:
                shutil.copy2(sources / url.rsplit("/", 1)[1], compliance)
            shutil.copy2(__file__, compliance / "prepare-audio-encoder.py")
            for name, path in [
                ("FFmpeg-COPYING.LGPLv2.1", source / "COPYING.LGPLv2.1"),
                ("FFmpeg-LICENSE.md", source / "LICENSE.md"),
                ("LAME-COPYING", work / "lame-3.100/COPYING"),
                ("LAME-LICENSE", work / "lame-3.100/LICENSE"),
                ("Ogg-COPYING", work / "libogg-1.3.6/COPYING"),
                ("Vorbis-COPYING", work / "libvorbis-1.3.7/COPYING"),
            ]:
                shutil.copy2(path, output / name)
            manifest = {
                "sources": [{"url": url, "sha256": digest} for url, digest in SOURCES],
                "license": "FFmpeg LGPL-2.1-or-later; LAME LGPL-2.0-or-later; Ogg/Vorbis BSD-3-Clause",
                "binary_sha256": hashlib.sha256((output / "ffmpeg").read_bytes()).hexdigest(),
                "binary_bytes": (output / "ffmpeg").stat().st_size,
                "configure": (source / "ffbuild/config.log").read_text().splitlines()[0],
                "compiler": subprocess.check_output(["/usr/bin/clang", "--version"], text=True),
                "dynamic_dependencies": dependencies,
            }
            (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
            print(json.dumps(manifest, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=ROOT / "native/binaries/audio-sources")
    parser.add_argument("--output", type=Path, default=ROOT / "native/binaries/audio-encoder")
    args = parser.parse_args()
    build(args.sources.resolve(), args.output.resolve())
