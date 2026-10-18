#!/usr/bin/env python3
"""Check release packaging order without building Swift or contacting Apple."""
import os
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


class ReleasePackagingTests(unittest.TestCase):
    def package(self, identity="Developer ID Application: Test (TESTTEAM)", key="test.p8", notarize=True,
                corrupt=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("OpenLoop", "openloop-cli", "uv", "ffmpeg"):
                (root / name).write_text("test executable")
            encoder = root / "encoder"
            encoder.mkdir()
            (encoder / "ffmpeg").write_bytes((root / "ffmpeg").read_bytes())
            (encoder / "Source").mkdir()
            (encoder / "Source/source.tar.xz").write_bytes(b"source")
            (encoder / "manifest.json").write_text(json.dumps({
                "binary_sha256": hashlib.sha256((encoder / "ffmpeg").read_bytes()).hexdigest(),
                "sources": [{"url": "https://example.com/source.tar.xz",
                             "sha256": hashlib.sha256(b"source").hexdigest()}],
            }))
            if corrupt:
                (encoder / corrupt).write_bytes(b"corrupted")
            output = root / "OpenLoop.app"
            dmg = root / "OpenLoop.dmg"
            calls = []

            def run(command, **kwargs):
                calls.append(command)
                return subprocess.CompletedProcess(command, 0)

            env = dict(os.environ, APPLE_SIGNING_IDENTITY=identity,
                       APPLE_SIGNING_KEYCHAIN="test.keychain-db", APPLE_TEAM_ID="TESTTEAM",
                       APPLE_API_KEY_PATH=key, APPLE_API_KEY_ID="KEYID", APPLE_API_ISSUER="issuer")
            argv = ["package-app.py", "--uv", str(root / "uv"), "--output", str(output),
                    "--dmg", str(dmg), "--sign", identity, "--encoder-directory", str(encoder)]
            if notarize:
                argv.append("--notarize")
            with patch.dict(os.environ, env, clear=True), patch.object(sys, "argv", argv), \
                    patch("subprocess.run", side_effect=run), \
                    patch("subprocess.check_output", return_value=str(root)):
                try:
                    runpy.run_path(str(Path(__file__).with_name("package-app.py")), run_name="__main__")
                except SystemExit as error:
                    return error.code, calls, output.exists()
            return 0, calls, output.exists()

    def test_release_staples_app_before_creating_dmg(self):
        status, calls, exists = self.package()
        self.assertEqual(status, 0)
        self.assertTrue(exists)
        submissions = [i for i, call in enumerate(calls) if call[0] == "bash"]
        self.assertEqual(len(submissions), 2)
        dmg_index = next(i for i, call in enumerate(calls) if call[0] == "hdiutil")
        self.assertLess(submissions[0], dmg_index)
        self.assertLess(dmg_index, submissions[1])
        self.assertTrue(calls[submissions[0]][-1].endswith("OpenLoop.app"))
        self.assertTrue(calls[submissions[1]][-1].endswith("OpenLoop.dmg"))
        nested = [call for call in calls if "--identifier" in call]
        self.assertEqual(len(nested), 3)
        self.assertTrue(any(call[-1].endswith("/ffmpeg") for call in nested))
        for call in nested:
            self.assertIn("--timestamp", call)
            self.assertIn("runtime", call)
            self.assertEqual(call[call.index("--keychain") + 1], "test.keychain-db")

    def test_notarization_rejects_adhoc_before_building(self):
        status, calls, exists = self.package(identity="-")
        self.assertNotEqual(status, 0)
        self.assertEqual(calls, [])
        self.assertFalse(exists)

    def test_missing_notary_key_rejected_before_building(self):
        status, calls, exists = self.package(key="")
        self.assertNotEqual(status, 0)
        self.assertEqual(calls, [])
        self.assertFalse(exists)

    def test_local_adhoc_build_does_not_submit(self):
        status, calls, exists = self.package(identity="-", notarize=False)
        self.assertEqual(status, 0)
        self.assertTrue(exists)
        self.assertFalse(any(call[0] == "bash" for call in calls))

    def test_encoder_and_source_corruption_fail_before_build(self):
        for path in ("ffmpeg", "Source/source.tar.xz"):
            with self.subTest(path=path):
                status, calls, exists = self.package(corrupt=path)
                self.assertNotEqual(status, 0)
                self.assertEqual(calls, [])
                self.assertFalse(exists)


if __name__ == "__main__":
    unittest.main()
