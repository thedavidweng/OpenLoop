import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AppSettings,
  BackendProvisionStatus,
  DeviceInfo,
  GenerationRecord,
  ModelStatusSnapshot,
} from "@/app/lib/types";

// ---------------------------------------------------------------------------
// Mocks – declared before imports so vitest hoists them
// ---------------------------------------------------------------------------

const closeSettings = vi.fn();
const refreshModelStatuses = vi.fn().mockResolvedValue(undefined);
const clearGenerationHistory = vi.fn().mockResolvedValue(undefined);
const deleteAllModels = vi.fn().mockResolvedValue(undefined);
const hydrateFromPersistence = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: vi.fn(),
}));

const mockClearBackendCache = vi.fn(() => Promise.resolve(undefined));

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: vi.fn(() => false),
  getDefaultAppPaths: vi.fn(() =>
    Promise.resolve({
      outputDirectory: "~/Music/OpenLoop",
      modelDirectory: "~/Library/Application Support/OpenLoop/models/checkpoints",
      logDirectory: "~/Library/Application Support/OpenLoop/logs/backend",
    }),
  ),
  selectDirectory: vi.fn(() => Promise.resolve(null)),
  setSetting: vi.fn(() => Promise.resolve({})),
  clearBackendCache: (...args: unknown[]) => mockClearBackendCache(...(args as [])),
  getNetworkLog: vi.fn(() => Promise.resolve([])),
  getAppLogs: vi.fn(() => Promise.resolve([])),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/app/components/settings/sections/ModelsSection", () => ({
  ModelsSection: () => <div data-testid="models-section">ModelsSection</div>,
}));
vi.mock("@/app/components/settings/sections/CliPathSection", () => ({
  CliPathSection: () => <div data-testid="clipath-section">CliPathSection</div>,
}));
vi.mock("@/app/components/settings/sections/DefaultsSection", () => ({
  DefaultsSection: () => <div data-testid="defaults-section">DefaultsSection</div>,
}));
vi.mock("@/app/components/settings/sections/GeneralSection", () => ({
  GeneralSection: () => <div data-testid="general-section">GeneralSection</div>,
}));
vi.mock("@/app/components/settings/sections/BackendSection", () => ({
  BackendSection: () => <div data-testid="backend-section">BackendSection</div>,
}));
vi.mock("@/app/components/settings/sections/NetworkActivitySection", () => ({
  NetworkActivitySection: () => <div data-testid="network-section">NetworkActivitySection</div>,
}));
vi.mock("@/app/components/settings/sections/LogsSection", () => ({
  LogsSection: () => <div data-testid="logs-section">LogsSection</div>,
}));
vi.mock("@/app/components/settings/sections/ProfilesSection", () => ({
  ProfilesSection: () => <div data-testid="profiles-section">ProfilesSection</div>,
}));
vi.mock("@/app/components/settings/sections/DangerZoneSection", () => ({
  DangerZoneSection: (props: {
    onClearHistory?: () => void;
    onClearCache?: () => void;
    onDeleteAllModels?: () => void;
  }) => (
    <div data-testid="danger-section">
      <button type="button" data-testid="trigger-clear-history" onClick={props.onClearHistory}>
        clear-history
      </button>
      <button type="button" data-testid="trigger-clear-cache" onClick={props.onClearCache}>
        clear-cache
      </button>
      <button type="button" data-testid="trigger-delete-models" onClick={props.onDeleteAllModels}>
        delete-models
      </button>
    </div>
  ),
}));

vi.mock("@/app/components/settings/SettingsSaveBar", () => ({
  SettingsSaveBar: (props: {
    hasUnsavedChanges?: boolean;
    saveNotice?: string | null;
    onSave?: () => void;
    onDiscard?: () => void;
  }) => (
    <div data-testid="save-bar">
      {props.saveNotice ? <span data-testid="save-notice">{props.saveNotice}</span> : null}
      <button type="button" data-testid="trigger-save" onClick={props.onSave}>
        save
      </button>
      <button type="button" data-testid="trigger-discard" onClick={props.onDiscard}>
        discard
      </button>
    </div>
  ),
}));

// Mock SettingsDialogs with all three confirm handlers exposed as buttons
vi.mock("@/app/components/settings/SettingsDialogs", () => ({
  SettingsDialogs: (props: {
    clearHistoryOpen?: boolean;
    clearCacheOpen?: boolean;
    deleteAllModelsOpen?: boolean;
    onConfirmClearHistory?: () => void;
    onConfirmClearCache?: () => void;
    onConfirmDeleteAllModels?: () => void;
  }) => (
    <div data-testid="settings-dialogs">
      {props.clearHistoryOpen ? <span>clear-history-open</span> : null}
      {props.clearCacheOpen ? <span>clear-cache-open</span> : null}
      {props.deleteAllModelsOpen ? <span>delete-models-open</span> : null}
      <button
        type="button"
        data-testid="confirm-clear-history"
        onClick={props.onConfirmClearHistory}
      >
        confirm-clear-history
      </button>
      <button type="button" data-testid="confirm-clear-cache" onClick={props.onConfirmClearCache}>
        confirm-clear-cache
      </button>
      <button
        type="button"
        data-testid="confirm-delete-models"
        onClick={props.onConfirmDeleteAllModels}
      >
        confirm-delete-models
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useGenerationStore } from "@/app/lib/store";
import { SettingsOverlay } from "@/app/components/settings/SettingsOverlay";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeSettings(overrides?: Partial<AppSettings>): AppSettings {
  return {
    profile: "standard",
    modelVariant: "turbo",
    downloadedModels: ["turbo"],
    outputDirectory: null,
    backendPort: 8080,
    defaultDurationSeconds: 60,
    defaultAudioFormat: "wav",
    defaultThinking: false,
    firstRunCompleted: true,
    ...overrides,
  };
}

function makeDeviceInfo(): DeviceInfo {
  return {
    os: "macOS",
    arch: "aarch64",
    isAppleSilicon: true,
    totalMemoryGb: 16,
    recommendedProfile: "standard",
  };
}

function makeProvisionReady(): BackendProvisionStatus {
  return {
    state: "ready",
    installedCommit: "abc123",
    installedTag: "v0.1.0",
    latestCommit: "abc123",
    latestTag: "v0.1.0",
    updateAvailable: false,
    downloadedBytes: 0,
  };
}

function makeModelStatuses(): ModelStatusSnapshot[] {
  return [
    {
      variant: "turbo",
      state: "ready",
      modelName: "acestep-v15-turbo",
      label: "Turbo",
      description: "Turbo model",
      downloadedBytes: 8 * 1024 * 1024 * 1024,
      totalBytes: 8 * 1024 * 1024 * 1024,
    },
  ];
}

function makeGenerationRecord(): GenerationRecord {
  return {
    id: "gen-1",
    createdAt: "2026-01-01T00:00:00Z",
    prompt: "test prompt",
    lyrics: "",
    vocalLanguage: "en",
    durationSeconds: 30,
    timeSignature: "4",
    taskType: "text2music",
    thinking: false,
    inferenceSteps: 30,
    guidanceScale: 7,
    useFormat: false,
    useCotCaption: false,
    useCotLanguage: false,
    constrainedDecoding: false,
    audioFormat: "wav",
    outputPath: null,
    status: "completed",
    errorMessage: null,
    isFavorite: false,
    useRandomSeed: false,
  };
}

function defaultStoreValues() {
  return {
    deviceInfo: makeDeviceInfo(),
    settings: makeSettings(),
    modelStatuses: makeModelStatuses(),
    backendProvisionStatus: makeProvisionReady(),
    history: [makeGenerationRecord()],
    profiles: [],
    closeSettings,
    refreshModelStatuses,
    clearGenerationHistory,
    deleteAllModels,
    hydrateFromPersistence,
  };
}

function setupMockStore(overrides?: Record<string, unknown>) {
  const values = { ...defaultStoreValues(), ...overrides };
  (vi.mocked(useGenerationStore) as any).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) => selector(values),
  );
}

// ===========================================================================
// SettingsOverlay — dialog confirm handlers
// ===========================================================================

describe("SettingsOverlay dialog confirm handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  // -- Clear history confirm (lines 194-196) -------------------------------

  it("sets historyCleared notice when clearGenerationHistory succeeds", async () => {
    const user = userEvent.setup();
    clearGenerationHistory.mockResolvedValue(undefined);
    render(<SettingsOverlay />);

    // Open the clear history dialog
    await user.click(screen.getByTestId("trigger-clear-history"));
    // Confirm it
    await user.click(screen.getByTestId("confirm-clear-history"));

    await waitFor(() => {
      expect(clearGenerationHistory).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-notice").textContent).toBe("settings.historyCleared");
    });
  });

  it("sets clearHistoryFailed notice when clearGenerationHistory rejects", async () => {
    const user = userEvent.setup();
    clearGenerationHistory.mockRejectedValue(new Error("fail"));
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-clear-history"));
    await user.click(screen.getByTestId("confirm-clear-history"));

    await waitFor(() => {
      expect(clearGenerationHistory).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-notice").textContent).toBe("settings.clearHistoryFailed");
    });
  });

  // -- Clear cache confirm (lines 202-203) ----------------------------------

  it("sets backendCacheCleared notice when clearBackendCache succeeds", async () => {
    const user = userEvent.setup();
    mockClearBackendCache.mockResolvedValue(undefined);
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-clear-cache"));
    await user.click(screen.getByTestId("confirm-clear-cache"));

    await waitFor(() => {
      expect(mockClearBackendCache).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-notice").textContent).toBe("settings.backendCacheCleared");
    });
  });

  it("sets clearCacheFailed notice when clearBackendCache rejects", async () => {
    const user = userEvent.setup();
    mockClearBackendCache.mockRejectedValue(new Error("fail"));
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-clear-cache"));
    await user.click(screen.getByTestId("confirm-clear-cache"));

    await waitFor(() => {
      expect(mockClearBackendCache).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-notice").textContent).toBe("settings.clearCacheFailed");
    });
  });

  // -- Delete all models confirm (lines 207-209) ----------------------------

  it("sets modelsDeleted notice when deleteAllModels succeeds", async () => {
    const user = userEvent.setup();
    deleteAllModels.mockResolvedValue(undefined);
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-delete-models"));
    await user.click(screen.getByTestId("confirm-delete-models"));

    await waitFor(() => {
      expect(deleteAllModels).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-notice").textContent).toBe("settings.modelsDeleted");
    });
  });

  it("sets deleteModelsFailed notice when deleteAllModels rejects", async () => {
    const user = userEvent.setup();
    deleteAllModels.mockRejectedValue(new Error("fail"));
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-delete-models"));
    await user.click(screen.getByTestId("confirm-delete-models"));

    await waitFor(() => {
      expect(deleteAllModels).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-notice").textContent).toBe("settings.deleteModelsFailed");
    });
  });
});
