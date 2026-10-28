#!/usr/bin/env python3
"""Check pinned archive integrity without compiling or downloading anything."""
import hashlib
import io
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch

recipe = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/prepare-audio-encoder.py"))


class AudioEncoderTests(unittest.TestCase):
    def test_bad_download_is_not_cached_and_can_be_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "source.tar.xz"
            expected = hashlib.sha256(b"official source").hexdigest()
            with patch("urllib.request.urlopen", return_value=io.BytesIO(b"corrupted")):
                with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                    recipe["download"]("https://example.com/source", archive, expected)
            self.assertEqual(list(archive.parent.iterdir()), [])
            with patch("urllib.request.urlopen", return_value=io.BytesIO(b"official source")):
                recipe["download"]("https://example.com/source", archive, expected)
            self.assertEqual(archive.read_bytes(), b"official source")

    def test_archive_hash_mismatch_is_a_hard_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "source.tar.xz"
            archive.write_bytes(b"official source")
            expected = hashlib.sha256(archive.read_bytes()).hexdigest()
            recipe["verify"](archive, expected)
            archive.write_bytes(b"corrupted download")
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                recipe["verify"](archive, expected)


if __name__ == "__main__":
    unittest.main()
