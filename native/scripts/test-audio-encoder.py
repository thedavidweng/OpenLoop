#!/usr/bin/env python3
"""Check pinned archive integrity without compiling or downloading anything."""
import hashlib
from pathlib import Path
import runpy
import tempfile
import unittest

recipe = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/prepare-audio-encoder.py"))


class AudioEncoderTests(unittest.TestCase):
    def test_archive_hash_mismatch_is_a_hard_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "source.tar.xz"
            archive.write_bytes(b"official source")
            expected = hashlib.sha256(archive.read_bytes()).hexdigest()
            recipe["verify"](archive, expected)
            archive.write_bytes(b"corrupted download")
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                recipe["verify"](archive, expected)

    def test_all_sources_have_fixed_https_urls_and_sha256(self):
        self.assertEqual(len(recipe["SOURCES"]), 4)
        for url, digest in recipe["SOURCES"]:
            self.assertTrue(url.startswith("https://"))
            self.assertNotIn("latest", url)
            self.assertEqual(len(bytes.fromhex(digest)), 32)


if __name__ == "__main__":
    unittest.main()
