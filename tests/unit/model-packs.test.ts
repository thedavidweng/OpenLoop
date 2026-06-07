import { describe, expect, it } from "vitest";
import type { AppSettings, ModelStatusSnapshot, ModelVariant } from "@/app/lib/types";
import {
  modelNameForVariant,
  lmModelPathForVariant,
  packIdForVariant,
  primaryVariantForPack,
  profileForVariant,
  isModelDownloaded,
  expandDownloadedVariantsFromStatuses,
  aggregatePackStatus,
  modelDownloadStateForVariant,
  MODEL_VARIANTS,
  MODEL_PACKS,
} from "@/app/lib/model-packs";

function makeSnapshot(
  variant: ModelVariant,
  state: ModelStatusSnapshot["state"],
  overrides?: Partial<ModelStatusSnapshot>,
): ModelStatusSnapshot {
  return {
    variant,
    state,
    modelName: MODEL_VARIANTS[variant].modelName,
    label: MODEL_VARIANTS[variant].label,
    description: MODEL_VARIANTS[variant].description,
    downloadedBytes: state === "ready" ? 100 : 0,
    totalBytes: 100,
    installedAt: null,
    error: null,
    ...overrides,
  };
}

function makeSettings(downloaded: ModelVariant[]): AppSettings {
  return {
    profile: "standard",
    modelVariant: null,
    downloadedModels: downloaded,
    outputDirectory: null,
    backendPort: 0,
    defaultDurationSeconds: 60,
    defaultAudioFormat: "wav",
    defaultThinking: false,
    firstRunCompleted: true,
  };
}

describe("modelNameForVariant", () => {
  it("returns turbo model name for lite", () => {
    expect(modelNameForVariant("lite")).toBe("acestep-v15-turbo");
  });

  it("returns turbo model name for turbo", () => {
    expect(modelNameForVariant("turbo")).toBe("acestep-v15-turbo");
  });

  it("returns xl-turbo model name for pro", () => {
    expect(modelNameForVariant("pro")).toBe("acestep-v15-xl-turbo");
  });
});

describe("lmModelPathForVariant", () => {
  it("returns 0.6B path for lite", () => {
    expect(lmModelPathForVariant("lite")).toBe("acestep-5Hz-lm-0.6B");
  });

  it("returns 0.6B path for turbo", () => {
    expect(lmModelPathForVariant("turbo")).toBe("acestep-5Hz-lm-0.6B");
  });

  it("returns 1.7B path for pro", () => {
    expect(lmModelPathForVariant("pro")).toBe("acestep-5Hz-lm-1.7B");
  });
});

describe("packIdForVariant", () => {
  it("returns xl for pro", () => {
    expect(packIdForVariant("pro")).toBe("xl");
  });

  it("returns standard for lite", () => {
    expect(packIdForVariant("lite")).toBe("standard");
  });

  it("returns standard for turbo", () => {
    expect(packIdForVariant("turbo")).toBe("standard");
  });
});

describe("primaryVariantForPack", () => {
  it("returns turbo for standard pack", () => {
    expect(primaryVariantForPack("standard")).toBe("turbo");
  });

  it("returns pro for xl pack", () => {
    expect(primaryVariantForPack("xl")).toBe("pro");
  });
});

describe("profileForVariant", () => {
  it("returns low-memory for lite", () => {
    expect(profileForVariant("lite")).toBe("low-memory");
  });

  it("returns standard for turbo", () => {
    expect(profileForVariant("turbo")).toBe("standard");
  });

  it("returns quality for pro", () => {
    expect(profileForVariant("pro")).toBe("quality");
  });
});

describe("isModelDownloaded", () => {
  it("returns false when variant is null", () => {
    expect(isModelDownloaded(makeSettings([]), null)).toBe(false);
  });

  it("returns false when no models are downloaded", () => {
    expect(isModelDownloaded(makeSettings([]), "turbo")).toBe(false);
  });

  it("returns true when the exact variant is downloaded", () => {
    expect(isModelDownloaded(makeSettings(["turbo"]), "turbo")).toBe(true);
  });

  it("returns true when a sibling variant in the same pack is downloaded", () => {
    expect(isModelDownloaded(makeSettings(["lite"]), "turbo")).toBe(true);
  });

  it("returns false when only a variant from a different pack is downloaded", () => {
    expect(isModelDownloaded(makeSettings(["pro"]), "turbo")).toBe(false);
  });

  it("returns true for pro when xl pack is downloaded", () => {
    expect(isModelDownloaded(makeSettings(["pro"]), "pro")).toBe(true);
  });
});

describe("expandDownloadedVariantsFromStatuses", () => {
  it("returns empty array for empty statuses", () => {
    expect(expandDownloadedVariantsFromStatuses([])).toEqual([]);
  });

  it("returns empty array when no statuses are ready", () => {
    const statuses = [
      makeSnapshot("turbo", "downloading"),
      makeSnapshot("pro", "not_installed"),
    ];
    expect(expandDownloadedVariantsFromStatuses(statuses)).toEqual([]);
  });

  it("expands standard pack when turbo is ready", () => {
    const statuses = [makeSnapshot("turbo", "ready")];
    const result = expandDownloadedVariantsFromStatuses(statuses);
    expect(result).toContain("lite");
    expect(result).toContain("turbo");
  });

  it("expands xl pack when pro is ready", () => {
    const statuses = [makeSnapshot("pro", "ready")];
    expect(expandDownloadedVariantsFromStatuses(statuses)).toEqual(["pro"]);
  });

  it("deduplicates packs even if multiple variants report ready", () => {
    const statuses = [
      makeSnapshot("lite", "ready"),
      makeSnapshot("turbo", "ready"),
    ];
    const result = expandDownloadedVariantsFromStatuses(statuses);
    expect(result).toHaveLength(2);
    expect(result).toContain("lite");
    expect(result).toContain("turbo");
  });
});

describe("aggregatePackStatus", () => {
  it("returns not_installed when no statuses match the pack", () => {
    const result = aggregatePackStatus([], "standard");
    expect(result.state).toBe("not_installed");
    expect(result.downloadedBytes).toBe(0);
    expect(result.totalBytes).toBe(MODEL_PACKS.standard.estimatedSizeBytes);
    expect(result.label).toBe("Standard");
    expect(result.error).toBeNull();
  });

  it("returns ready when a variant in the pack is ready", () => {
    const statuses = [makeSnapshot("turbo", "ready")];
    const result = aggregatePackStatus(statuses, "standard");
    expect(result.state).toBe("ready");
    expect(result.sample).toBe(statuses[0]);
  });

  it("ranks failed above ready", () => {
    const statuses = [
      makeSnapshot("lite", "ready"),
      makeSnapshot("turbo", "failed", {
        error: { code: "DOWNLOAD_ERR", message: "fail", recoverable: true },
      }),
    ];
    const result = aggregatePackStatus(statuses, "standard");
    expect(result.state).toBe("failed");
    expect(result.error).toEqual({
      code: "DOWNLOAD_ERR",
      message: "fail",
      recoverable: true,
    });
  });

  it("ranks downloading above ready but below failed", () => {
    const statuses = [
      makeSnapshot("lite", "ready"),
      makeSnapshot("turbo", "downloading", { downloadedBytes: 50 }),
    ];
    const result = aggregatePackStatus(statuses, "standard");
    expect(result.state).toBe("downloading");
  });

  it("picks the maximum downloadedBytes across entries", () => {
    const statuses = [
      makeSnapshot("lite", "downloading", { downloadedBytes: 30 }),
      makeSnapshot("turbo", "downloading", { downloadedBytes: 70 }),
    ];
    const result = aggregatePackStatus(statuses, "standard");
    expect(result.downloadedBytes).toBe(70);
  });

  it("falls back to estimatedSizeBytes when no entry has totalBytes", () => {
    const statuses = [
      makeSnapshot("turbo", "ready", { totalBytes: undefined }),
    ];
    const result = aggregatePackStatus(statuses, "standard");
    expect(result.totalBytes).toBe(MODEL_PACKS.standard.estimatedSizeBytes);
  });

  it("uses the first found totalBytes when present", () => {
    const statuses = [
      makeSnapshot("turbo", "ready", { totalBytes: 999 }),
    ];
    const result = aggregatePackStatus(statuses, "standard");
    expect(result.totalBytes).toBe(999);
  });
});

describe("modelDownloadStateForVariant", () => {
  it("returns not_installed when variant is null", () => {
    expect(modelDownloadStateForVariant([], null)).toBe("not_installed");
  });

  it("delegates to aggregatePackStatus for standard variant", () => {
    const statuses = [makeSnapshot("turbo", "ready")];
    expect(modelDownloadStateForVariant(statuses, "turbo")).toBe("ready");
  });

  it("returns not_installed for pro with empty statuses", () => {
    expect(modelDownloadStateForVariant([], "pro")).toBe("not_installed");
  });

  it("returns failed when pack aggregate reports failed", () => {
    const statuses = [
      makeSnapshot("pro", "failed", {
        error: { code: "ERR", message: "err", recoverable: false },
      }),
    ];
    expect(modelDownloadStateForVariant(statuses, "pro")).toBe("failed");
  });
});
