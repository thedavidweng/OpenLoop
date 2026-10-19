#!/usr/bin/env python3
"""Verify only #73's installed encoder/CLI export contract, with no backend or network."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import wave


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, default=Path("native/dist/OpenLoop.app"))
    bundle = parser.parse_args().bundle.resolve()
    cli = bundle / "Contents/MacOS/openloop-cli"
    encoder = bundle / "Contents/MacOS/ffmpeg"
    compliance = bundle / "Contents/Resources/AudioEncoder"
    subprocess.run(["/usr/bin/codesign", "--verify", "--deep", "--strict", str(bundle)], check=True)
    subprocess.run(["/usr/bin/codesign", "--verify", "--strict", str(encoder)], check=True)
    manifest = json.loads((compliance / "manifest.json").read_text())
    assert len(manifest["sources"]) == 4
    for source in manifest["sources"]:
        path = compliance / "Source" / source["url"].rsplit("/", 1)[1]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source["sha256"]
    assert (compliance / "Source/prepare-audio-encoder.py").is_file()
    for name in ("FFmpeg-COPYING.LGPLv2.1", "FFmpeg-LICENSE.md", "LAME-COPYING",
                 "LAME-LICENSE", "Ogg-COPYING", "Vorbis-COPYING"):
        assert (compliance / name).is_file(), name
    protocols = subprocess.check_output([str(encoder), "-hide_banner", "-protocols"], text=True)
    assert protocols.split() == ["Supported", "file", "protocols:", "Input:", "file", "Output:", "file"], protocols
    with tempfile.TemporaryDirectory(prefix="openloop-audio-exports-") as directory:
        root = Path(directory)
        source = root / "Export \u97f3\u4e50.wav"
        pcm = b"".join(struct.pack("<hh", int(math.sin(i * 2 * math.pi * 440 / 44100) * 6000),
                                  int(math.sin(i * 2 * math.pi * 660 / 44100) * 6000))
                       for i in range(44100))
        with wave.open(str(source), "wb") as stream:
            stream.setparams((2, 2, 44100, 0, "NONE", "not compressed"))
            stream.writeframes(pcm)
        original = source.read_bytes()
        # Conversion must not depend on Homebrew/PATH tools or the inference runtime.
        env = dict(os.environ, PATH=f"{root}:/usr/bin:/bin")
        linked = root / "openloop"
        linked.symlink_to(cli)

        def run(*arguments, success=True):
            result = subprocess.run(
                [linked.name, "--data-dir", str(root / "library"), "--json", *arguments],
                cwd="/", env=env, capture_output=True, text=True, timeout=30)
            assert (result.returncode == 0) == success, (arguments, result.stdout, result.stderr)
            events = [json.loads(line) for line in (result.stdout if success else result.stderr).splitlines()]
            assert events and all(event["v"] == 2 for event in events), result
            assert events[-1]["kind"] == ("result" if success else "error"), events
            return events[-1]["data"]

        for fmt, codec in [("mp3", "mp3"), ("flac", "flac"), ("ogg", "vorbis")]:
            output = source.with_suffix("." + fmt)
            assert run("files", "convert", str(source), "--format", fmt) == str(output)
            probe = subprocess.run([str(encoder), "-hide_banner", "-i", str(output)],
                                   capture_output=True, text=True, timeout=30)
            assert f"Audio: {codec}" in probe.stderr, probe.stderr
            assert "Export \u97f3\u4e50" in probe.stderr, probe.stderr
            decoded = root / ("decoded-" + fmt + ".wav")
            subprocess.run([str(encoder), "-nostdin", "-loglevel", "error", "-i", str(output),
                            "-c:a", "pcm_s16le", str(decoded)], check=True, timeout=30)
            with wave.open(str(decoded)) as stream:
                assert stream.getnchannels() == 2 and stream.getframerate() == 44100
                frames = stream.readframes(stream.getnframes())
                assert abs(len(frames) - len(pcm)) <= 4 * 1024
                if fmt == "flac":
                    assert frames == pcm, "Lossless archive changed PCM samples"
            saved = output.read_bytes()
            run("files", "convert", str(source), "--format", fmt, success=False)
            assert output.read_bytes() == saved

        podcast = root / "podcast.mp3"
        run("files", "convert", str(source), "--format", "mp3", "--preset", "podcast", "--output", str(podcast))
        probe = subprocess.run([str(encoder), "-hide_banner", "-i", str(podcast)],
                               capture_output=True, text=True, timeout=30)
        assert "44100 Hz, mono" in probe.stderr and "96 kb/s" in probe.stderr, probe.stderr
        for options in [[], ["--format", "aac"], ["--format", "ogg", "--preset", "podcast"],
                        ["--format", "mp3", "--output", str(root / "wrong.flac")]]:
            run("files", "convert", str(source), *options, success=False)
        bad = root / "invalid.wav"
        bad.write_bytes(b"invalid audio")
        run("files", "convert", str(bad), "--format", "mp3", success=False)
        assert not bad.with_suffix(".mp3").exists()
        assert source.read_bytes() == original
        assert not list(root.glob(".openloop-export-*"))
    print("PASS: bundled signatures/sources, local MP3/FLAC/OGG, Unicode tags, PCM lossless roundtrip, podcast, NDJSON errors and no overwrite")


if __name__ == "__main__":
    main()
