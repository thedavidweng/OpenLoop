import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  collectDiagnostics,
  copyDebugInfo,
  formatBackendStatus,
  formatDiagnostics,
  formatDiagnosticsText,
  type DiagnosticsBundle,
} from "@/app/lib/diagnostics";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import("@tauri-apps/api/core");

const mockBundle: DiagnosticsBundle = {
  appVersion: "1.0.0",
  os: "macOS",
  arch: "aarch64",
  isAppleSilicon: true,
  totalMemoryGb: 16,
  tauriVersion: "2.0.0",
  backendStatus: "ok",
  recentErrors: null,
};

describe("collectDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure window exists (jsdom provides it)
    delete (window as any).__TAURI_INTERNALS__;
  });

  it("returns null when __TAURI_INTERNALS__ is absent", async () => {
    const result = await collectDiagnostics();
    expect(result).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("invokes collect_diagnostics when __TAURI_INTERNALS__ is present", async () => {
    (invoke as Mock).mockResolvedValueOnce(mockBundle);
    (window as any).__TAURI_INTERNALS__ = {};

    const result = await collectDiagnostics();

    expect(invoke).toHaveBeenCalledWith("collect_diagnostics");
    expect(result).toEqual(mockBundle);
  });

  it("propagates errors from the Tauri invoke call", async () => {
    (invoke as Mock).mockRejectedValueOnce(new Error("backend down"));
    (window as any).__TAURI_INTERNALS__ = {};

    await expect(collectDiagnostics()).rejects.toThrow("backend down");
  });
});

describe("formatDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).__TAURI_INTERNALS__;
  });

  it("returns error JSON when not in Tauri runtime", async () => {
    const result = await formatDiagnostics();
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({
      error: "Diagnostics are only available in the Tauri runtime.",
    });
  });

  it("returns pretty-printed bundle JSON in Tauri runtime", async () => {
    (invoke as Mock).mockResolvedValueOnce(mockBundle);
    (window as any).__TAURI_INTERNALS__ = {};

    const result = await formatDiagnostics();
    const parsed = JSON.parse(result);

    expect(parsed).toEqual(mockBundle);
    // Verify pretty-printing (2-space indent)
    expect(result).toContain("\n");
    expect(result).toContain("  ");
  });
});

const textBundle: DiagnosticsBundle = {
  appVersion: "1.2.3",
  os: "macos",
  arch: "aarch64",
  isAppleSilicon: true,
  totalMemoryGb: 16,
  buildSha: "abc1234",
  appLogDir: "/Users/test/Library/Logs/OpenLoop",
  backendStatus: { state: "healthy", port: 8001 },
  recentErrors: null,
};

describe("formatBackendStatus", () => {
  it("formats a tagged status with a port", () => {
    expect(formatBackendStatus({ state: "healthy", port: 8001 })).toBe("healthy (port 8001)");
  });

  it("formats a tagged status without a port", () => {
    expect(formatBackendStatus({ state: "stopped" })).toBe("stopped");
  });

  it("falls back for unknown shapes", () => {
    expect(formatBackendStatus(null)).toBe("unknown");
    expect(formatBackendStatus("ok")).toBe("ok");
  });
});

describe("formatDiagnosticsText", () => {
  it("produces stable text containing version, build, and os fields", () => {
    const text = formatDiagnosticsText(textBundle, "9.9.9");
    expect(text).toBe(
      [
        "OpenLoop debug info",
        "Version: 1.2.3 (package 9.9.9)",
        "Build: abc1234",
        "OS: macos aarch64 (Apple Silicon)",
        "Memory: 16 GB",
        "Backend: healthy (port 8001)",
        "Log directory: /Users/test/Library/Logs/OpenLoop",
      ].join("\n"),
    );
  });

  it("uses placeholders when optional fields are absent", () => {
    const text = formatDiagnosticsText(
      { ...textBundle, buildSha: undefined, appLogDir: undefined, isAppleSilicon: false },
      "9.9.9",
    );
    expect(text).toContain("Build: unknown");
    expect(text).toContain("Log directory: unknown");
    expect(text).not.toContain("Apple Silicon");
  });

  it("returns a fallback message outside the desktop runtime", () => {
    const text = formatDiagnosticsText(null, "9.9.9");
    expect(text).toContain("OpenLoop debug info");
    expect(text).toContain("Version: 9.9.9");
    expect(text).toContain("only available in the desktop app");
  });
});

describe("copyDebugInfo", () => {
  it("writes the formatted text via the injected clipboard", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    await copyDebugInfo({
      fetchDiagnostics: () => Promise.resolve(textBundle),
      writeText,
      packageVersion: "9.9.9",
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const written = writeText.mock.calls[0][0];
    expect(written).toContain("Version: 1.2.3 (package 9.9.9)");
    expect(written).toContain("Build: abc1234");
  });
});
