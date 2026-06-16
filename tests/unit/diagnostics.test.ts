import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  collectDiagnostics,
  formatDiagnostics,
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
