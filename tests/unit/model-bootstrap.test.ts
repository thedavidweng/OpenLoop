import { describe, expect, it } from "vitest";
import type {
  AppSettings,
  DeviceInfo,
  ModelStatusSnapshot,
} from "@/app/lib/types";
import {
  DEFAULT_APP_SETTINGS,
  resolveModelBootstrapStatus,
} from "@/app/lib/model-bootstrap";

const readySettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  firstRunCompleted: true,
  profile: "standard",
  modelVariant: "turbo",
  downloadedModels: ["turbo"],
};

const deviceInfo: DeviceInfo = {
  os: "macOS",
  arch: "aarch64",
  isAppleSilicon: true,
  totalMemoryGb: 16,
  recommendedProfile: "standard",
};

function status(state: ModelStatusSnapshot["state"]): ModelStatusSnapshot {
  return {
    variant: "turbo",
    state,
    modelName: "acestep-v15-turbo",
    label: "Standard",
    description: "Standard",
    downloadedBytes: state === "ready" ? 10 : 4,
    totalBytes: 10,
    installedAt: state === "ready" ? "2026-04-29T00:00:00Z" : null,
    error:
      state === "failed"
        ? {
            code: "MODEL_DOWNLOAD_FAILED",
            message: "download failed",
            recoverable: true,
          }
        : null,
  };
}

describe("model bootstrap status", () => {
  it("requires first-run setup before reporting model readiness", () => {
    const result = resolveModelBootstrapStatus(
      { ...readySettings, firstRunCompleted: false },
      deviceInfo,
      [status("ready")],
      null,
      true,
    );

    expect(result.state).toBe("pending");
    expect(result.message).toBeTruthy();
  });

  it("reports selected model download progress", () => {
    const result = resolveModelBootstrapStatus(
      readySettings,
      deviceInfo,
      [status("downloading")],
      null,
      true,
    );

    expect(result.state).toBe("downloading");
    if (result.state !== "downloading") {
      throw new Error("expected downloading bootstrap status");
    }
    expect(result.downloadedBytes).toBe(4);
    expect(result.totalBytes).toBe(10);
  });

  it("reports ready in Tauri runtime when the selected pack is installed", () => {
    const result = resolveModelBootstrapStatus(
      readySettings,
      deviceInfo,
      [status("ready")],
      null,
      true,
    );

    expect(result.state).toBe("ready");
  });
});
