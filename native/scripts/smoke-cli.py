#!/usr/bin/env python3
"""Exercise the packaged headless CLI and real SIGINT with a local HTTP fixture."""
import json
import selectors
import signal
import subprocess
import tempfile
from pathlib import Path

native = Path(__file__).resolve().parents[1]
bundle = native / "dist/OpenLoop.app"
cli = bundle / "Contents/MacOS/openloop"
with tempfile.TemporaryDirectory(prefix="openloop-cli-smoke-") as directory:
    root = Path(directory)
    source = (native / "Tests/OpenLoopCoreTests/Fixtures/ace-server.py").read_text()
    fixture = root / "server.py"
    fixture.write_text(source.replace("'status': 1", "'status': 0"))
    server = subprocess.Popen(["/usr/bin/python3", str(fixture)], stdout=subprocess.PIPE, text=True)
    try:
        port = int(server.stdout.readline())

        def run(*args, success=True):
            result = subprocess.run([str(cli), "--data-dir", directory, "--json", *args],
                                    capture_output=True, text=True, timeout=15)
            assert (result.returncode == 0) == success, (args, result.returncode, result.stderr)
            events = [json.loads(line) for line in result.stdout.splitlines()]
            assert all(event["v"] == 2 for event in events)
            return events

        assert run("catalog")[0]["kind"] == "result"
        run("project", "create", "Packaged idea")
        assert run("project", "list")[0]["data"][0]["name"] == "Packaged idea"
        settings = run("settings", "get")[0]["data"]
        settings["backendPort"] = port
        path = root / "settings.json"
        path.write_text(json.dumps(settings))
        run("settings", "set", str(path))
        run("clear", success=False)
        process = subprocess.Popen([str(cli), "--data-dir", directory, "--json", "run",
                                    "--configuration", "ace-step/pro", "--prompt", "waiting",
                                    "--duration", "10"], stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True)
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                assert selector.select(10), "CLI emitted no task event"
            assert json.loads(process.stdout.readline())["v"] == 2
            process.send_signal(signal.SIGINT)
            output, error = process.communicate(timeout=15)
            assert process.returncode == 130, (process.returncode, output, error)
            tasks = run("ps")[0]["data"]
            assert any(task["state"] == "cancelled" for task in tasks), tasks
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
        assert list((bundle / "Contents/Resources").rglob("model-files.json"))
        assert (bundle / "Contents/MacOS/uv").is_file()
    finally:
        server.terminate()
        server.wait(timeout=5)
print("Packaged CLI smoke passed, including SIGINT exit 130 and persisted cancellation.")
