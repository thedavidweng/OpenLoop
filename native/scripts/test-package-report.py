#!/usr/bin/env python3
"""Protect package accounting against duplicate symlinked resources."""
from pathlib import Path
import runpy
import tempfile
import unittest

breakdown = runpy.run_path(str(Path(__file__).with_name("package-report.py")))["breakdown"]


class PackageReportTests(unittest.TestCase):
    def test_components_partition_logical_bytes_without_following_links(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory)
            files = {
                "Contents/MacOS/OpenLoop": 10,
                "Contents/MacOS/openloop-cli": 20,
                "Contents/MacOS/uv": 30,
                "Contents/Resources/Engine.bundle/catalog.json": 40,
                "Contents/Resources/OpenLoop.icns": 50,
                "Contents/Info.plist": 60,
            }
            for name, size in files.items():
                path = bundle / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"x" * size)
            (bundle / "Contents/MacOS/Engine.bundle").symlink_to("../Resources/Engine.bundle")
            (bundle / "Contents/Resources/icon-link").symlink_to("OpenLoop.icns")
            report = breakdown(bundle)
            self.assertEqual(report["app_bytes"], 210)
            self.assertEqual(
                {key: value["bytes"] for key, value in report["components"].items()},
                dict(gui=10, cli=20, uv=30, resources=40, icons=50, other=60))
            self.assertAlmostEqual(
                sum(value["percent"] for value in report["components"].values()), 100, places=2)


if __name__ == "__main__":
    unittest.main()
