import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const api = await import("@/app/lib/api");

beforeEach(() => {
  mockInvoke.mockReset();
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe("getSettings", () => {
  it("calls 'get_settings' with no args", async () => {
    const settings = { outputDirectory: "/tmp" };
    mockInvoke.mockResolvedValue(settings);

    const result = await api.getSettings();

    expect(mockInvoke).toHaveBeenCalledWith("get_settings");
    expect(result).toBe(settings);
  });
});

describe("setSetting", () => {
  it("calls 'set_setting' with key and value", async () => {
    const updated = { outputDirectory: "/new" };
    mockInvoke.mockResolvedValue(updated);

    const result = await api.setSetting("outputDirectory", "/new");

    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "outputDirectory",
      value: "/new",
    });
    expect(result).toBe(updated);
  });
});

describe("resetRuntimeSettings", () => {
  it("calls 'reset_runtime_settings' with no args", async () => {
    const settings = { outputDirectory: "/default" };
    mockInvoke.mockResolvedValue(settings);

    const result = await api.resetRuntimeSettings();

    expect(mockInvoke).toHaveBeenCalledWith("reset_runtime_settings");
    expect(result).toBe(settings);
  });
});

// ---------------------------------------------------------------------------
// Device & Window
// ---------------------------------------------------------------------------

describe("getDeviceInfo", () => {
  it("calls 'get_device_info' with no args", async () => {
    const info = { os: "macOS", arch: "aarch64" };
    mockInvoke.mockResolvedValue(info);

    const result = await api.getDeviceInfo();

    expect(mockInvoke).toHaveBeenCalledWith("get_device_info");
    expect(result).toBe(info);
  });
});

describe("getWindowShellState", () => {
  it("calls 'get_window_shell_state' with no args", async () => {
    const snapshot = { maximized: false };
    mockInvoke.mockResolvedValue(snapshot);

    const result = await api.getWindowShellState();

    expect(mockInvoke).toHaveBeenCalledWith("get_window_shell_state");
    expect(result).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Paths & CLI
// ---------------------------------------------------------------------------

describe("getDefaultAppPaths", () => {
  it("calls 'get_default_app_paths' with no args", async () => {
    const paths = {
      outputDirectory: "/out",
      modelDirectory: "/models",
      logDirectory: "/logs",
    };
    mockInvoke.mockResolvedValue(paths);

    const result = await api.getDefaultAppPaths();

    expect(mockInvoke).toHaveBeenCalledWith("get_default_app_paths");
    expect(result).toBe(paths);
  });
});

describe("addCliToPath", () => {
  it("calls 'add_cli_to_path' with no args", async () => {
    mockInvoke.mockResolvedValue("added");

    const result = await api.addCliToPath();

    expect(mockInvoke).toHaveBeenCalledWith("add_cli_to_path");
    expect(result).toBe("added");
  });
});

describe("removeCliFromPath", () => {
  it("calls 'remove_cli_from_path' with no args", async () => {
    mockInvoke.mockResolvedValue("removed");

    const result = await api.removeCliFromPath();

    expect(mockInvoke).toHaveBeenCalledWith("remove_cli_from_path");
    expect(result).toBe("removed");
  });
});

describe("isCliInPath", () => {
  it("calls 'is_cli_in_path' with no args", async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await api.isCliInPath();

    expect(mockInvoke).toHaveBeenCalledWith("is_cli_in_path");
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Generations CRUD
// ---------------------------------------------------------------------------

describe("listGenerations", () => {
  it("calls 'list_generations' with query when provided", async () => {
    const records = [{ id: "1" }];
    mockInvoke.mockResolvedValue(records);

    const result = await api.listGenerations("hello");

    expect(mockInvoke).toHaveBeenCalledWith("list_generations", {
      query: "hello",
    });
    expect(result).toBe(records);
  });

  it("sends null query when trimmed string is empty", async () => {
    mockInvoke.mockResolvedValue([]);

    await api.listGenerations("   ");

    expect(mockInvoke).toHaveBeenCalledWith("list_generations", {
      query: null,
    });
  });

  it("sends null query when undefined", async () => {
    mockInvoke.mockResolvedValue([]);

    await api.listGenerations();

    expect(mockInvoke).toHaveBeenCalledWith("list_generations", {
      query: null,
    });
  });
});

describe("getGeneration", () => {
  it("calls 'get_generation' with id", async () => {
    const record = { id: "abc" };
    mockInvoke.mockResolvedValue(record);

    const result = await api.getGeneration("abc");

    expect(mockInvoke).toHaveBeenCalledWith("get_generation", { id: "abc" });
    expect(result).toBe(record);
  });

  it("returns null when generation not found", async () => {
    mockInvoke.mockResolvedValue(null);

    const result = await api.getGeneration("missing");

    expect(result).toBeNull();
  });
});

describe("insertGeneration", () => {
  it("calls 'insert_generation' with the record", async () => {
    const record = { id: "new" } as any;
    mockInvoke.mockResolvedValue(record);

    const result = await api.insertGeneration(record);

    expect(mockInvoke).toHaveBeenCalledWith("insert_generation", { record });
    expect(result).toBe(record);
  });
});

describe("deleteGeneration", () => {
  it("calls 'delete_generation' with id", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.deleteGeneration("abc");

    expect(mockInvoke).toHaveBeenCalledWith("delete_generation", { id: "abc" });
  });
});

describe("clearGenerationHistory", () => {
  it("calls 'clear_generation_history' with no args", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.clearGenerationHistory();

    expect(mockInvoke).toHaveBeenCalledWith("clear_generation_history");
  });
});

describe("toggleGenerationFavorite", () => {
  it("calls 'toggle_generation_favorite' with id", async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await api.toggleGenerationFavorite("abc");

    expect(mockInvoke).toHaveBeenCalledWith("toggle_generation_favorite", {
      id: "abc",
    });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Generation audio & waveform
// ---------------------------------------------------------------------------

describe("readGenerationAudio", () => {
  it("calls 'read_generation_audio' with id", async () => {
    const buf = new ArrayBuffer(8);
    mockInvoke.mockResolvedValue(buf);

    const result = await api.readGenerationAudio("abc");

    expect(mockInvoke).toHaveBeenCalledWith("read_generation_audio", {
      id: "abc",
    });
    expect(result).toBe(buf);
  });
});

describe("readGenerationWaveform", () => {
  it("calls 'read_generation_waveform' with id", async () => {
    const waveform = { peaks: [0.1, 0.2] } as any;
    mockInvoke.mockResolvedValue(waveform);

    const result = await api.readGenerationWaveform("abc");

    expect(mockInvoke).toHaveBeenCalledWith("read_generation_waveform", {
      id: "abc",
    });
    expect(result).toBe(waveform);
  });
});

// ---------------------------------------------------------------------------
// Generation execution
// ---------------------------------------------------------------------------

describe("generateMusic", () => {
  it("calls 'generate_music' with request", async () => {
    const request = { prompt: "jazz" } as any;
    const result_ = { runId: "r1" } as any;
    mockInvoke.mockResolvedValue(result_);

    const result = await api.generateMusic(request);

    expect(mockInvoke).toHaveBeenCalledWith("generate_music", { request });
    expect(result).toBe(result_);
  });
});

describe("cancelGeneration", () => {
  it("calls 'cancel_generation' with no args", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.cancelGeneration();

    expect(mockInvoke).toHaveBeenCalledWith("cancel_generation");
  });
});

describe("enhancePrompt", () => {
  it("calls 'enhance_prompt' with request", async () => {
    const request = { prompt: "test" } as any;
    const enhanced = { enhancedPrompt: "better test" } as any;
    mockInvoke.mockResolvedValue(enhanced);

    const result = await api.enhancePrompt(request);

    expect(mockInvoke).toHaveBeenCalledWith("enhance_prompt", { request });
    expect(result).toBe(enhanced);
  });
});

// ---------------------------------------------------------------------------
// Active generation tasks
// ---------------------------------------------------------------------------

describe("listActiveGenerationTasks", () => {
  it("calls 'list_active_generation_tasks' with no args", async () => {
    const tasks = [{ id: "t1" }] as any;
    mockInvoke.mockResolvedValue(tasks);

    const result = await api.listActiveGenerationTasks();

    expect(mockInvoke).toHaveBeenCalledWith("list_active_generation_tasks");
    expect(result).toBe(tasks);
  });
});

describe("resumeGenerationTask", () => {
  it("calls 'resume_generation_task' with id", async () => {
    const record = { id: "t1" } as any;
    mockInvoke.mockResolvedValue(record);

    const result = await api.resumeGenerationTask("t1");

    expect(mockInvoke).toHaveBeenCalledWith("resume_generation_task", {
      id: "t1",
    });
    expect(result).toBe(record);
  });
});

describe("discardActiveGenerationTask", () => {
  it("calls 'discard_active_generation_task' with id", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.discardActiveGenerationTask("t1");

    expect(mockInvoke).toHaveBeenCalledWith("discard_active_generation_task", {
      id: "t1",
    });
  });
});

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------

describe("backendStatus", () => {
  it("calls 'backend_status' with no args", async () => {
    const status = { running: true };
    mockInvoke.mockResolvedValue(status);

    const result = await api.backendStatus();

    expect(mockInvoke).toHaveBeenCalledWith("backend_status");
    expect(result).toBe(status);
  });
});

describe("startBackend", () => {
  it("calls 'start_backend' with no args", async () => {
    const status = { running: true };
    mockInvoke.mockResolvedValue(status);

    const result = await api.startBackend();

    expect(mockInvoke).toHaveBeenCalledWith("start_backend");
    expect(result).toBe(status);
  });
});

describe("stopBackend", () => {
  it("calls 'stop_backend' with no args", async () => {
    const status = { running: false };
    mockInvoke.mockResolvedValue(status);

    const result = await api.stopBackend();

    expect(mockInvoke).toHaveBeenCalledWith("stop_backend");
    expect(result).toBe(status);
  });
});

describe("restartBackend", () => {
  it("calls 'restart_backend' with no args", async () => {
    const status = { running: true };
    mockInvoke.mockResolvedValue(status);

    const result = await api.restartBackend();

    expect(mockInvoke).toHaveBeenCalledWith("restart_backend");
    expect(result).toBe(status);
  });
});

describe("getBackendLogsPath", () => {
  it("calls 'get_backend_logs_path' with no args", async () => {
    mockInvoke.mockResolvedValue("/logs/backend.log");

    const result = await api.getBackendLogsPath();

    expect(mockInvoke).toHaveBeenCalledWith("get_backend_logs_path");
    expect(result).toBe("/logs/backend.log");
  });

  it("passes through null", async () => {
    mockInvoke.mockResolvedValue(null);

    const result = await api.getBackendLogsPath();

    expect(result).toBeNull();
  });
});

describe("clearBackendCache", () => {
  it("calls 'clear_backend_cache' with no args", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.clearBackendCache();

    expect(mockInvoke).toHaveBeenCalledWith("clear_backend_cache");
  });
});

// ---------------------------------------------------------------------------
// Backend provisioning
// ---------------------------------------------------------------------------

describe("getBackendProvisionStatus", () => {
  it("calls 'get_backend_provision_status' with no args", async () => {
    const status = { state: "ready" } as any;
    mockInvoke.mockResolvedValue(status);

    const result = await api.getBackendProvisionStatus();

    expect(mockInvoke).toHaveBeenCalledWith("get_backend_provision_status");
    expect(result).toBe(status);
  });
});

describe("provisionBackend", () => {
  it("calls 'provision_backend' with no args", async () => {
    const status = { state: "provisioning" } as any;
    mockInvoke.mockResolvedValue(status);

    const result = await api.provisionBackend();

    expect(mockInvoke).toHaveBeenCalledWith("provision_backend");
    expect(result).toBe(status);
  });
});

describe("checkBackendUpdates", () => {
  it("calls 'check_backend_updates' with no args", async () => {
    const status = { state: "up-to-date" } as any;
    mockInvoke.mockResolvedValue(status);

    const result = await api.checkBackendUpdates();

    expect(mockInvoke).toHaveBeenCalledWith("check_backend_updates");
    expect(result).toBe(status);
  });
});

describe("updateBackend", () => {
  it("calls 'update_backend' with no args", async () => {
    const status = { state: "updating" } as any;
    mockInvoke.mockResolvedValue(status);

    const result = await api.updateBackend();

    expect(mockInvoke).toHaveBeenCalledWith("update_backend");
    expect(result).toBe(status);
  });
});

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

describe("listModelCatalog", () => {
  it("calls 'list_model_catalog' with no args", async () => {
    const catalog = [{ id: "turbo" }] as any;
    mockInvoke.mockResolvedValue(catalog);

    const result = await api.listModelCatalog();

    expect(mockInvoke).toHaveBeenCalledWith("list_model_catalog");
    expect(result).toBe(catalog);
  });
});

describe("listModelRegistry", () => {
  it("calls 'list_model_registry' with no args", async () => {
    const registry = { engines: [], packs: [], slots: [] };
    mockInvoke.mockResolvedValue(registry);

    const result = await api.listModelRegistry();

    expect(mockInvoke).toHaveBeenCalledWith("list_model_registry");
    expect(result).toBe(registry);
  });
});

describe("getModelStatus", () => {
  it("calls 'get_model_status' with no args", async () => {
    const statuses = [{ variant: "turbo", state: "ready" }] as any;
    mockInvoke.mockResolvedValue(statuses);

    const result = await api.getModelStatus();

    expect(mockInvoke).toHaveBeenCalledWith("get_model_status");
    expect(result).toBe(statuses);
  });
});

describe("downloadModel", () => {
  it("calls 'download_model' with variant", async () => {
    const snapshot = { variant: "turbo", state: "downloading" } as any;
    mockInvoke.mockResolvedValue(snapshot);

    const result = await api.downloadModel("turbo");

    expect(mockInvoke).toHaveBeenCalledWith("download_model", {
      variant: "turbo",
    });
    expect(result).toBe(snapshot);
  });
});

describe("deleteModel", () => {
  it("calls 'delete_model' with variant", async () => {
    const snapshot = { variant: "turbo", state: "not-downloaded" } as any;
    mockInvoke.mockResolvedValue(snapshot);

    const result = await api.deleteModel("turbo");

    expect(mockInvoke).toHaveBeenCalledWith("delete_model", {
      variant: "turbo",
    });
    expect(result).toBe(snapshot);
  });
});

describe("clearPartialDownloads", () => {
  it("calls 'clear_partial_downloads' with variant", async () => {
    const snapshot = { variant: "turbo", state: "not-downloaded" } as any;
    mockInvoke.mockResolvedValue(snapshot);

    const result = await api.clearPartialDownloads("turbo");

    expect(mockInvoke).toHaveBeenCalledWith("clear_partial_downloads", {
      variant: "turbo",
    });
    expect(result).toBe(snapshot);
  });
});

describe("cancelDownload", () => {
  it("calls 'cancel_download' with variant", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.cancelDownload("turbo");

    expect(mockInvoke).toHaveBeenCalledWith("cancel_download", {
      variant: "turbo",
    });
  });
});

describe("deleteAllModels", () => {
  it("calls 'delete_all_models' with no args", async () => {
    const statuses = [] as any;
    mockInvoke.mockResolvedValue(statuses);

    const result = await api.deleteAllModels();

    expect(mockInvoke).toHaveBeenCalledWith("delete_all_models");
    expect(result).toBe(statuses);
  });
});

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

describe("revealInFinder", () => {
  it("resolves without invoking outside the Tauri runtime", async () => {
    await expect(api.revealInFinder("/some/path")).resolves.toBeUndefined();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("copyAudioTo", () => {
  it("calls 'copy_audio_to' with path and destination", async () => {
    mockInvoke.mockResolvedValue("/dest/file.wav");

    const result = await api.copyAudioTo("/src/file.wav", "/dest");

    expect(mockInvoke).toHaveBeenCalledWith("copy_audio_to", {
      path: "/src/file.wav",
      destination: "/dest",
    });
    expect(result).toBe("/dest/file.wav");
  });
});

describe("fileExists", () => {
  it("calls 'file_exists' with path", async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await api.fileExists("/some/file");

    expect(mockInvoke).toHaveBeenCalledWith("file_exists", {
      path: "/some/file",
    });
    expect(result).toBe(true);
  });
});

describe("deleteGenerationFile", () => {
  it("calls 'delete_generation_file' with path", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.deleteGenerationFile("/audio.wav");

    expect(mockInvoke).toHaveBeenCalledWith("delete_generation_file", {
      path: "/audio.wav",
    });
  });
});

describe("deleteGenerationFileAndRecord", () => {
  it("calls 'delete_generation_file_and_record' with id", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.deleteGenerationFileAndRecord("abc");

    expect(mockInvoke).toHaveBeenCalledWith("delete_generation_file_and_record", { id: "abc" });
  });
});

// ---------------------------------------------------------------------------
// Failed runs
// ---------------------------------------------------------------------------

describe("listFailedRuns", () => {
  it("calls 'list_failed_runs' with limit", async () => {
    const runs = [{ id: "f1" }] as any;
    mockInvoke.mockResolvedValue(runs);

    const result = await api.listFailedRuns(10);

    expect(mockInvoke).toHaveBeenCalledWith("list_failed_runs", { limit: 10 });
    expect(result).toBe(runs);
  });
});

describe("clearFailedRuns", () => {
  it("calls 'clear_failed_runs' with no args", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.clearFailedRuns();

    expect(mockInvoke).toHaveBeenCalledWith("clear_failed_runs");
  });
});

describe("deleteFailedRun", () => {
  it("calls 'delete_failed_run' with id", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await api.deleteFailedRun("f1");

    expect(mockInvoke).toHaveBeenCalledWith("delete_failed_run", { id: "f1" });
  });
});

// ---------------------------------------------------------------------------
// Export & drag
// ---------------------------------------------------------------------------

describe("exportGenerationsToFolder", () => {
  it("calls 'export_generations_to_folder' with ids and destination", async () => {
    const exported = ["/dest/a.wav", "/dest/b.wav"];
    mockInvoke.mockResolvedValue(exported);

    const result = await api.exportGenerationsToFolder(["a", "b"], "/dest");

    expect(mockInvoke).toHaveBeenCalledWith("export_generations_to_folder", {
      ids: ["a", "b"],
      destination: "/dest",
    });
    expect(result).toBe(exported);
  });
});

describe("prepareDragPayload", () => {
  it("calls 'prepare_drag_payload' with id", async () => {
    mockInvoke.mockResolvedValue("/tmp/payload.wav");

    const result = await api.prepareDragPayload("abc");

    expect(mockInvoke).toHaveBeenCalledWith("prepare_drag_payload", {
      id: "abc",
    });
    expect(result).toBe("/tmp/payload.wav");
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe("error propagation", () => {
  it("propagates invoke rejection for no-arg commands", async () => {
    const error = new Error("backend crashed");
    mockInvoke.mockRejectedValue(error);

    await expect(api.backendStatus()).rejects.toThrow("backend crashed");
  });

  it("propagates invoke rejection for commands with args", async () => {
    const error = new Error("not found");
    mockInvoke.mockRejectedValue(error);

    await expect(api.getGeneration("abc")).rejects.toThrow("not found");
  });

  it("propagates invoke rejection for void commands", async () => {
    const error = new Error("permission denied");
    mockInvoke.mockRejectedValue(error);

    await expect(api.deleteGeneration("abc")).rejects.toThrow("permission denied");
  });
});

// ---------------------------------------------------------------------------
// isTauriRuntime
// ---------------------------------------------------------------------------

describe("isTauriRuntime", () => {
  let originalInternals: unknown;

  beforeEach(() => {
    originalInternals = (window as any).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    // ensure clean state for subsequent tests
    if (originalInternals !== undefined) {
      (window as any).__TAURI_INTERNALS__ = originalInternals;
    } else {
      delete (window as any).__TAURI_INTERNALS__;
    }
  });

  it("returns false when __TAURI_INTERNALS__ is absent", () => {
    delete (window as any).__TAURI_INTERNALS__;
    expect(api.isTauriRuntime()).toBe(false);
  });

  it("returns true when __TAURI_INTERNALS__ is present", () => {
    (window as any).__TAURI_INTERNALS__ = {};
    expect(api.isTauriRuntime()).toBe(true);
  });
});
