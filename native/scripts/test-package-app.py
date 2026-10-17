#!/usr/bin/env python3
"""Check release packaging order without building Swift or contacting Apple."""
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


class ReleasePackagingTests(unittest.TestCase):
    def package(self, identity="Developer ID Application: Test (TESTTEAM)", key="test.p8", notarize=True):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("OpenLoop", "openloop-cli", "uv"):
                (root / name).write_text("test executable")
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
                    "--dmg", str(dmg), "--sign", identity]
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
        self.assertEqual(len(nested), 2)
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


if __name__ == "__main__":
    unittest.main()
