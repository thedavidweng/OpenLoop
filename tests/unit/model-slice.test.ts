import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppSettings,
  BackendProvisionStatus,
  ModelStatusSnapshot,
  ModelVariant,
  GenerationFormValues,
} from "@/app/lib/types";
import type { GenerationStore } from "@/app/lib/store/types";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockApi = {
  isTauriRuntime: vi.fn(() => false),
  downloadModel: vi.fn(),
  deleteModel: vi.fn(),
  cancelDownload: vi.fn(),
  clearPartialDownloads: vi.fn(),
  deleteAllModels: vi.fn(),
  listModelCatalog: vi.fn(),
  listModelRegistry: vi.fn(() => Promise.resolve({ engines: [], packs: [], slots: [] })),
  getModelStatus: vi.fn(),
  getBackendProvisionStatus: vi.fn(),
  provisionBackend: vi.fn(),
  updateBackend: vi.fn(),
  setSetting: vi.fn(),
};

vi.mock("@/app/lib/api", () => mockApi);

/* ------------------------------------------------------------------ */
/*  Imports (after mock setup)                                         */
/* ------------------------------------------------------------------ */

const { DEFAULT_GENERATION_FORM_VALUES } = await import("@/app/lib/validation");
const { createModelSlice } = await import("@/app/lib/store/slices/model");
const { createUISlice } = await import("@/app/lib/store/slices/ui");
const { createSettingsSlice } = await import("@/app/lib/store/slices/settings");
const { createHistorySlice } = await import("@/app/lib/store/slices/history");
const { createGenerationSlice } = await import("@/app/lib/store/slices/generation");
const { createProjectsSlice } = await import("@/app/lib/store/slices/projects");
const { createProfilesSlice } = await import("@/app/lib/store/slices/profiles");

const { create } = await import("zustand");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createStore() {
  return create<GenerationStore>((set, get) => ({
    ...createUISlice(set, get),
    ...createModelSlice(set, get),
    ...createGenerationSlice(set, get),
    ...createHistorySlice(set, get),
    ...createProjectsSlice(set, get),
    ...createSettingsSlice(set, get),
    ...createProfilesSlice(set, get),
  }));
}

function defaultSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    profile: "standard",
    modelVariant: null,
    downloadedModels: [],
    outputDirectory: null,
    backendPort: 8001,
    defaultDurationSeconds: 30,
    defaultAudioFormat: "wav",
    defaultThinking: true,
    firstRunCompleted: false,
    ...overrides,
  };
}

function defaultForm(overrides: Partial<GenerationFormValues> = {}): GenerationFormValues {
  return { ...DEFAULT_GENERATION_FORM_VALUES, ...overrides };
}

function modelStatus(
  variant: ModelVariant,
  state: ModelStatusSnapshot["state"],
  overrides: Partial<ModelStatusSnapshot> = {},
): ModelStatusSnapshot {
  return {
    variant,
    state,
    modelName: variant === "pro" ? "acestep-v15-xl-turbo" : "acestep-v15-turbo",
    label: variant === "pro" ? "XL Turbo" : variant === "lite" ? "Lite" : "Turbo",
    description: "",
    downloadedBytes: state === "ready" ? 8 * 1024 * 1024 * 1024 : 0,
    totalBytes: state === "ready" ? 8 * 1024 * 1024 * 1024 : null,
    error: null,
    ...overrides,
  };
}

function defaultProvisionStatus(
  overrides: Partial<BackendProvisionStatus> = {},
): BackendProvisionStatus {
  return {
    state: "not_installed",
    installedCommit: null,
    installedTag: null,
    latestCommit: null,
    latestTag: null,
    updateAvailable: false,
    downloadedBytes: 0,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  beforeEach                                                         */
/* ------------------------------------------------------------------ */

let store: ReturnType<typeof createStore>;

beforeEach(() => {
  vi.clearAllMocks();
  store = createStore();
  store.setState({
    settings: defaultSettings(),
    form: defaultForm(),
    modelStatuses: [],
    bootstrapStatus: { state: "pending", message: "Choose a model" },
    backendProvisionStatus: defaultProvisionStatus(),
  });
});

/* ================================================================== */
/*  Initial state                                                      */
/* ================================================================== */

describe("createModelSlice - initial state", () => {
  it("starts with pending bootstrapStatus", () => {
    expect(store.getState().bootstrapStatus.state).toBe("pending");
  });

  it("populates modelCatalog with all three variants", () => {
    const catalog = store.getState().modelCatalog;
    expect(catalog).toHaveLength(3);
    expect(catalog.map((c) => c.variant).sort()).toEqual(["lite", "pro", "turbo"]);
  });

  it("starts with empty modelStatuses", () => {
    expect(store.getState().modelStatuses).toEqual([]);
  });
});

/* ================================================================== */
/*  applyModelStatus (sync)                                            */
/* ================================================================== */

describe("applyModelStatus", () => {
  it("adds a new status to modelStatuses", () => {
    store.getState().applyModelStatus(modelStatus("turbo", "ready"));

    const statuses = store.getState().modelStatuses;
    expect(statuses).toHaveLength(1);
    expect(statuses[0].variant).toBe("turbo");
    expect(statuses[0].state).toBe("ready");
  });

  it("replaces status for the same variant", () => {
    store.setState({
      modelStatuses: [modelStatus("turbo", "downloading", { downloadedBytes: 1000 })],
    });

    store.getState().applyModelStatus(modelStatus("turbo", "ready"));

    const statuses = store.getState().modelStatuses;
    expect(statuses).toHaveLength(1);
    expect(statuses[0].state).toBe("ready");
  });

  it("updates downloadedModels based on statuses", () => {
    store.setState({
      settings: defaultSettings({ modelVariant: "turbo" }),
    });

    store.getState().applyModelStatus(modelStatus("turbo", "ready"));

    expect(store.getState().settings.downloadedModels).toContain("turbo");
    expect(store.getState().settings.downloadedModels).toContain("lite");
  });

  describe("bootstrapStatus updates", () => {
    it("sets downloading when pack aggregate is downloading for the selected pack", () => {
      store.setState({
        settings: defaultSettings({ modelVariant: "turbo" }),
      });

      store.getState().applyModelStatus(
        modelStatus("turbo", "downloading", {
          downloadedBytes: 500,
          totalBytes: 8000,
        }),
      );

      const bs = store.getState().bootstrapStatus;
      expect(bs.state).toBe("downloading");
    });

    it("sets failed when pack aggregate is failed for the selected pack", () => {
      store.setState({
        settings: defaultSettings({ modelVariant: "turbo" }),
      });

      store.getState().applyModelStatus(
        modelStatus("turbo", "failed", {
          error: { code: "DL_FAIL", message: "disk full", recoverable: true },
        }),
      );

      const bs = store.getState().bootstrapStatus;
      expect(bs.state).toBe("failed");
    });

    it("sets ready when pack aggregate is ready for the selected pack", () => {
      store.setState({
        settings: defaultSettings({ modelVariant: "turbo" }),
      });

      store.getState().applyModelStatus(modelStatus("turbo", "ready"));

      expect(store.getState().bootstrapStatus.state).toBe("ready");
    });

    it("sets pending when pack is not_installed for the selected pack", () => {
      store.setState({
        settings: defaultSettings({ modelVariant: "turbo" }),
      });

      store.getState().applyModelStatus(modelStatus("turbo", "not_installed"));

      expect(store.getState().bootstrapStatus.state).toBe("pending");
    });
  });

  it("clears modelVariant when selected variant's pack loses downloaded status", () => {
    store.setState({
      settings: defaultSettings({
        modelVariant: "turbo",
        downloadedModels: ["lite", "turbo"],
      }),
      modelStatuses: [modelStatus("turbo", "ready")],
    });

    // Apply a failed status for turbo - this removes it from downloadedModels
    store.getState().applyModelStatus(modelStatus("turbo", "failed"));

    expect(store.getState().settings.modelVariant).toBeNull();
  });

  it("preserves modelVariant when the deleted pack is not the selected one", () => {
    store.setState({
      settings: defaultSettings({
        modelVariant: "turbo",
        downloadedModels: ["lite", "turbo", "pro"],
      }),
      modelStatuses: [modelStatus("turbo", "ready"), modelStatus("pro", "ready")],
    });

    store.getState().applyModelStatus(modelStatus("pro", "failed"));

    expect(store.getState().settings.modelVariant).toBe("turbo");
  });

  it("does not call setSetting in non-Tauri runtime", () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    store.getState().applyModelStatus(modelStatus("turbo", "ready"));

    expect(mockApi.setSetting).not.toHaveBeenCalled();
  });

  it("persists downloadedModels via setSetting in Tauri runtime", () => {
    mockApi.isTauriRuntime.mockReturnValue(true);

    store.getState().applyModelStatus(modelStatus("turbo", "ready"));

    expect(mockApi.setSetting).toHaveBeenCalledWith(
      "downloadedModels",
      expect.arrayContaining(["turbo"]),
    );
  });
});

/* ================================================================== */
/*  downloadModelVariant                                               */
/* ================================================================== */

describe("downloadModelVariant", () => {
  describe("non-Tauri runtime", () => {
    beforeEach(() => {
      mockApi.isTauriRuntime.mockReturnValue(false);
    });

    it("adds pack variants to downloadedModels and sets bootstrapStatus to ready", async () => {
      store.setState({
        settings: defaultSettings(),
      });

      await store.getState().downloadModelVariant("turbo");

      const s = store.getState().settings;
      expect(s.downloadedModels).toContain("turbo");
      expect(s.downloadedModels).toContain("lite");
      expect(s.modelVariant).toBe("turbo");
      expect(s.profile).toBe("standard");
      expect(store.getState().bootstrapStatus.state).toBe("ready");
    });

    it("applies profile preset for lite variant", async () => {
      await store.getState().downloadModelVariant("lite");

      const s = store.getState().settings;
      expect(s.profile).toBe("low-memory");
      expect(s.modelVariant).toBe("lite");
    });

    it("applies profile preset for pro variant", async () => {
      await store.getState().downloadModelVariant("pro");

      const s = store.getState().settings;
      expect(s.profile).toBe("quality");
      expect(s.modelVariant).toBe("pro");
    });
  });

  describe("Tauri runtime", () => {
    beforeEach(() => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      mockApi.downloadModel.mockResolvedValue(modelStatus("turbo", "downloading"));
      mockApi.setSetting.mockResolvedValue(undefined);
    });

    it("calls downloadModel with the pack's primary variant", async () => {
      await store.getState().downloadModelVariant("lite");

      // lite is in the "standard" pack whose primary variant is "turbo"
      expect(mockApi.downloadModel).toHaveBeenCalledWith("turbo");
    });

    it("persists modelVariant, profile, and defaultThinking via setSetting", async () => {
      await store.getState().downloadModelVariant("turbo");

      expect(mockApi.setSetting).toHaveBeenCalledWith("modelVariant", "turbo");
      expect(mockApi.setSetting).toHaveBeenCalledWith("selectedModelId", "ace-step/turbo");
      expect(mockApi.setSetting).toHaveBeenCalledWith("profile", "standard");
      expect(mockApi.setSetting).toHaveBeenCalledWith("defaultThinking", expect.any(Boolean));
    });

    it("applies the status returned by downloadModel", async () => {
      await store.getState().downloadModelVariant("turbo");

      expect(store.getState().modelStatuses.length).toBeGreaterThan(0);
    });
  });
});

/* ================================================================== */
/*  deleteModelVariant                                                 */
/* ================================================================== */

describe("deleteModelVariant", () => {
  describe("non-Tauri runtime", () => {
    beforeEach(() => {
      mockApi.isTauriRuntime.mockReturnValue(false);
    });

    it("removes all pack variants from downloadedModels", async () => {
      store.setState({
        settings: defaultSettings({
          downloadedModels: ["lite", "turbo", "pro"],
          modelVariant: "turbo",
        }),
      });

      await store.getState().deleteModelVariant("turbo");

      const dm = store.getState().settings.downloadedModels;
      expect(dm).not.toContain("lite");
      expect(dm).not.toContain("turbo");
      expect(dm).toContain("pro");
    });

    it("clears modelVariant when the selected variant belongs to the deleted pack", async () => {
      store.setState({
        settings: defaultSettings({
          downloadedModels: ["lite", "turbo"],
          modelVariant: "turbo",
        }),
      });

      await store.getState().deleteModelVariant("turbo");

      expect(store.getState().settings.modelVariant).toBeNull();
      expect(store.getState().bootstrapStatus.state).toBe("pending");
    });

    it("preserves modelVariant when selected variant is in a different pack", async () => {
      store.setState({
        settings: defaultSettings({
          downloadedModels: ["lite", "turbo", "pro"],
          modelVariant: "pro",
        }),
      });

      await store.getState().deleteModelVariant("turbo");

      expect(store.getState().settings.modelVariant).toBe("pro");
    });
  });

  describe("Tauri runtime", () => {
    beforeEach(() => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      mockApi.deleteModel.mockResolvedValue(modelStatus("turbo", "not_installed"));
    });

    it("calls deleteModel with the pack's primary variant", async () => {
      await store.getState().deleteModelVariant("lite");

      // lite is in "standard" pack whose primary variant is "turbo"
      expect(mockApi.deleteModel).toHaveBeenCalledWith("turbo");
    });

    it("applies the status returned by deleteModel", async () => {
      store.setState({
        modelStatuses: [modelStatus("turbo", "ready")],
      });

      await store.getState().deleteModelVariant("turbo");

      const turboStatus = store.getState().modelStatuses.find((s) => s.variant === "turbo");
      expect(turboStatus?.state).toBe("not_installed");
    });
  });
});

/* ================================================================== */
/*  cancelModelDownload                                                */
/* ================================================================== */

describe("cancelModelDownload", () => {
  it("calls cancelDownload in Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.cancelDownload.mockResolvedValue(undefined);

    await store.getState().cancelModelDownload("turbo");

    expect(mockApi.cancelDownload).toHaveBeenCalledWith("turbo");
  });

  it("does nothing in non-Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    await store.getState().cancelModelDownload("turbo");

    expect(mockApi.cancelDownload).not.toHaveBeenCalled();
  });
});

/* ================================================================== */
/*  clearPartialModelDownloads                                         */
/* ================================================================== */

describe("clearPartialModelDownloads", () => {
  it("calls clearPartialDownloads and applies status in Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    const status = modelStatus("turbo", "not_installed");
    mockApi.clearPartialDownloads.mockResolvedValue(status);

    await store.getState().clearPartialModelDownloads("turbo");

    expect(mockApi.clearPartialDownloads).toHaveBeenCalledWith("turbo");
    expect(store.getState().modelStatuses).toHaveLength(1);
  });

  it("does nothing in non-Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    await store.getState().clearPartialModelDownloads("turbo");

    expect(mockApi.clearPartialDownloads).not.toHaveBeenCalled();
  });
});

/* ================================================================== */
/*  deleteAllModels                                                    */
/* ================================================================== */

describe("deleteAllModels", () => {
  it("does nothing in non-Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    await store.getState().deleteAllModels();

    expect(mockApi.deleteAllModels).not.toHaveBeenCalled();
  });

  it("clears downloadedModels and resets modelVariant when all deleted", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    store.setState({
      settings: defaultSettings({
        downloadedModels: ["lite", "turbo", "pro"],
        modelVariant: "turbo",
      }),
      modelStatuses: [modelStatus("turbo", "ready"), modelStatus("pro", "ready")],
    });

    mockApi.deleteAllModels.mockResolvedValue([
      modelStatus("turbo", "not_installed"),
      modelStatus("pro", "not_installed"),
    ]);

    await store.getState().deleteAllModels();

    expect(store.getState().settings.downloadedModels).toEqual([]);
    expect(store.getState().settings.modelVariant).toBe("");
  });

  it("preserves modelVariant when some models remain downloaded", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    store.setState({
      settings: defaultSettings({
        downloadedModels: ["lite", "turbo", "pro"],
        modelVariant: "turbo",
      }),
    });

    // turbo not_installed but pro remains ready
    mockApi.deleteAllModels.mockResolvedValue([
      modelStatus("turbo", "not_installed"),
      modelStatus("pro", "ready"),
    ]);

    await store.getState().deleteAllModels();

    // downloadedModels will include pro's pack variants
    expect(store.getState().settings.downloadedModels).toContain("pro");
    expect(store.getState().settings.modelVariant).toBe("turbo");
  });
});

/* ================================================================== */
/*  refreshModelStatuses                                               */
/* ================================================================== */

describe("refreshModelStatuses", () => {
  it("does nothing in non-Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    await store.getState().refreshModelStatuses();

    expect(mockApi.getModelStatus).not.toHaveBeenCalled();
  });

  it("fetches catalog, statuses, and provision in parallel", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    const catalog = [
      {
        variant: "turbo",
        label: "Turbo",
        modelName: "acestep-v15-turbo",
        lmBackend: "mlx",
        estimatedSizeBytes: 8 * 1024 * 1024 * 1024,
        description: "",
        recommendedMemoryGb: 16,
      },
    ];
    mockApi.listModelCatalog.mockResolvedValue(catalog);
    mockApi.getModelStatus.mockResolvedValue([modelStatus("turbo", "ready")]);
    mockApi.getBackendProvisionStatus.mockResolvedValue(defaultProvisionStatus({ state: "ready" }));

    await store.getState().refreshModelStatuses();

    expect(store.getState().modelCatalog).toEqual(catalog);
    expect(store.getState().modelStatuses).toHaveLength(1);
    expect(store.getState().backendProvisionStatus.state).toBe("ready");
  });

  it("falls back to not_installed when backend provision fetch fails", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.listModelCatalog.mockResolvedValue([]);
    mockApi.getModelStatus.mockResolvedValue([]);
    mockApi.getBackendProvisionStatus.mockRejectedValue(new Error("unavailable"));

    await store.getState().refreshModelStatuses();

    expect(store.getState().backendProvisionStatus.state).toBe("not_installed");
  });

  it("updates downloadedModels from fetched statuses", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.listModelCatalog.mockResolvedValue([]);
    mockApi.getModelStatus.mockResolvedValue([
      modelStatus("turbo", "ready"),
      modelStatus("pro", "ready"),
    ]);
    mockApi.getBackendProvisionStatus.mockResolvedValue(defaultProvisionStatus({ state: "ready" }));

    await store.getState().refreshModelStatuses();

    expect(store.getState().settings.downloadedModels).toEqual(
      expect.arrayContaining(["lite", "turbo", "pro"]),
    );
  });
});

/* ================================================================== */
/*  selectModelVariant                                                 */
/* ================================================================== */

describe("selectModelVariant", () => {
  describe("non-Tauri runtime", () => {
    beforeEach(() => {
      mockApi.isTauriRuntime.mockReturnValue(false);
    });

    it("sets modelVariant and profile in settings", async () => {
      await store.getState().selectModelVariant("lite");

      expect(store.getState().settings.modelVariant).toBe("lite");
      expect(store.getState().settings.profile).toBe("low-memory");
    });

    it("applies profile preset to form", async () => {
      await store.getState().selectModelVariant("pro");

      const form = store.getState().form;
      expect(form.model).toBe("acestep-v15-xl-turbo");
    });
  });

  describe("Tauri runtime", () => {
    beforeEach(() => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      mockApi.setSetting.mockResolvedValue(undefined);
      // Provide a stub for hydrateFromPersistence and refreshBootstrapStatus
      store.setState({
        hydrated: true,
      });
    });

    it("persists modelVariant, profile, and defaultThinking", async () => {
      // Stub the methods that selectModelVariant calls after setSetting
      const originalState = store.getState();
      store.setState({
        ...originalState,
        hydrateFromPersistence: vi.fn().mockResolvedValue(undefined),
        refreshBootstrapStatus: vi.fn().mockResolvedValue(undefined),
      });

      await store.getState().selectModelVariant("pro");

      expect(mockApi.setSetting).toHaveBeenCalledWith("modelVariant", "pro");
      expect(mockApi.setSetting).toHaveBeenCalledWith("selectedModelId", "ace-step/pro");
      expect(mockApi.setSetting).toHaveBeenCalledWith("profile", "quality");
      expect(mockApi.setSetting).toHaveBeenCalledWith("defaultThinking", expect.any(Boolean));
    });
  });
});

/* ================================================================== */
/*  refreshBootstrapStatus                                             */
/* ================================================================== */

describe("refreshBootstrapStatus", () => {
  it("resolves to ready when model is downloaded and firstRunCompleted", async () => {
    store.setState({
      settings: defaultSettings({
        firstRunCompleted: true,
        modelVariant: "turbo",
        downloadedModels: ["lite", "turbo"],
      }),
      modelStatuses: [modelStatus("turbo", "ready")],
      backendProvisionStatus: defaultProvisionStatus({ state: "ready" }),
    });

    await store.getState().refreshBootstrapStatus();

    expect(store.getState().bootstrapStatus.state).toBe("ready");
  });

  it("sets pending when no model variant selected", async () => {
    store.setState({
      settings: defaultSettings({
        firstRunCompleted: true,
        modelVariant: null,
      }),
    });

    await store.getState().refreshBootstrapStatus();

    expect(store.getState().bootstrapStatus.state).toBe("pending");
  });
});

/* ================================================================== */
/*  refreshBackendProvisionStatus                                      */
/* ================================================================== */

describe("refreshBackendProvisionStatus", () => {
  it("does nothing in non-Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    await store.getState().refreshBackendProvisionStatus();

    expect(mockApi.getBackendProvisionStatus).not.toHaveBeenCalled();
  });

  it("updates backendProvisionStatus on success", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    const status = defaultProvisionStatus({ state: "ready" });
    mockApi.getBackendProvisionStatus.mockResolvedValue(status);

    await store.getState().refreshBackendProvisionStatus();

    expect(store.getState().backendProvisionStatus.state).toBe("ready");
  });

  it("logs a warning when status refresh fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.getBackendProvisionStatus.mockRejectedValue(new Error("boom"));

    await store.getState().refreshBackendProvisionStatus();

    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to refresh backend provision status:",
      expect.any(Error),
    );
    expect(store.getState().backendProvisionStatus.state).toBe("not_installed");
    warnSpy.mockRestore();
  });
});

/* ================================================================== */
/*  provisionBackend                                                   */
/* ================================================================== */

describe("provisionBackend", () => {
  it("does nothing in non-Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    await store.getState().provisionBackend();

    expect(mockApi.provisionBackend).not.toHaveBeenCalled();
  });

  it("sets status to ready on success", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.provisionBackend.mockResolvedValue(defaultProvisionStatus({ state: "ready" }));

    await store.getState().provisionBackend();

    expect(store.getState().backendProvisionStatus.state).toBe("ready");
  });

  it("sets status to failed on error", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.provisionBackend.mockRejectedValue(new Error("disk space"));

    await store.getState().provisionBackend();

    const bs = store.getState().backendProvisionStatus;
    expect(bs.state).toBe("failed");
    expect(bs.error?.code).toBe("BACKEND_PROVISION_FAILED");
    expect(bs.error?.message).toBe("disk space");
    expect(bs.error?.recoverable).toBe(true);
  });
});

/* ================================================================== */
/*  updateBackend                                                      */
/* ================================================================== */

describe("updateBackend", () => {
  it("does nothing in non-Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);

    await store.getState().updateBackend();

    expect(mockApi.updateBackend).not.toHaveBeenCalled();
  });

  it("sets status on success", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.updateBackend.mockResolvedValue(
      defaultProvisionStatus({ state: "ready", updateAvailable: false }),
    );

    await store.getState().updateBackend();

    expect(store.getState().backendProvisionStatus.state).toBe("ready");
  });

  it("sets failed state with error details on failure", async () => {
    mockApi.isTauriRuntime.mockReturnValue(true);
    store.setState({
      backendProvisionStatus: defaultProvisionStatus({ state: "ready" }),
    });
    mockApi.updateBackend.mockRejectedValue(new Error("network timeout"));

    await store.getState().updateBackend();

    const bs = store.getState().backendProvisionStatus;
    expect(bs.state).toBe("failed");
    expect(bs.error?.code).toBe("BACKEND_PROVISION_FAILED");
    expect(bs.error?.message).toBe("network timeout");
  });
});
