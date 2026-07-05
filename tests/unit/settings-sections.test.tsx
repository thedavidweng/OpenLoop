import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSettings, BackendProvisionStatus, ModelStatusSnapshot } from "@/app/lib/types";
import type { SettingsDraft } from "@/app/components/settings/hooks/useSettingsDraft";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const closeSettings = vi.fn();
const reopenSetup = vi.fn();
const setLanguage = vi.fn().mockResolvedValue(undefined);
const hydrateFromPersistence = vi.fn().mockResolvedValue(undefined);
const updateBackend = vi.fn().mockResolvedValue(undefined);
const refreshBackendProvisionStatus = vi.fn().mockResolvedValue(undefined);
const selectModelVariant = vi.fn().mockResolvedValue(undefined);
const downloadModelVariant = vi.fn().mockResolvedValue(undefined);
const deleteModelVariant = vi.fn().mockResolvedValue(undefined);
const cancelModelDownload = vi.fn().mockResolvedValue(undefined);
const clearPartialModelDownloads = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: vi.fn(),
}));

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
  restartBackend: vi.fn(() => Promise.resolve(undefined)),
  getBackendLogsPath: vi.fn(() => Promise.resolve("/logs/backend")),
  revealInFinder: vi.fn(() => Promise.resolve(undefined)),
  resetRuntimeSettings: vi.fn(() => Promise.resolve(undefined)),
  isCliInPath: vi.fn(() => Promise.resolve(false)),
  addCliToPath: vi.fn(() => Promise.resolve(undefined)),
  removeCliFromPath: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/app/lib/i18n", () => ({
  default: { t: (key: string) => key, changeLanguage: vi.fn() },
  SUPPORTED_LANGUAGES: [
    { code: "en", name: "English" },
    { code: "zh", name: "Chinese" },
  ],
  detectSystemLanguage: () => "en",
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useGenerationStore } from "@/app/lib/store";
import { DangerZoneSection } from "@/app/components/settings/sections/DangerZoneSection";
import { GeneralSection } from "@/app/components/settings/sections/GeneralSection";
import { BackendSection } from "@/app/components/settings/sections/BackendSection";
import { DefaultsSection } from "@/app/components/settings/sections/DefaultsSection";
import { CliPathSection } from "@/app/components/settings/sections/CliPathSection";
import { ModelsSection } from "@/app/components/settings/sections/ModelsSection";

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

function makeDraft(overrides?: Partial<SettingsDraft>): SettingsDraft {
  return {
    outputDirectory: "",
    modelDirectory: "",
    backendPort: "8080",
    logDirectory: "",
    defaultDurationSeconds: "60",
    defaultAudioFormat: "wav",
    defaultThinking: false,
    checkForUpdates: true,
    ...overrides,
  };
}

function setupMockStore(overrides?: Record<string, unknown>) {
  const values = {
    settings: makeSettings(),
    modelStatuses: makeModelStatuses(),
    backendProvisionStatus: makeProvisionReady(),
    closeSettings,
    reopenSetup,
    setLanguage,
    hydrateFromPersistence,
    updateBackend,
    refreshBackendProvisionStatus,
    selectModelVariant,
    downloadModelVariant,
    deleteModelVariant,
    cancelModelDownload,
    clearPartialModelDownloads,
    highContrast: false,
    setHighContrast: vi.fn(),
    ...overrides,
  };
  (vi.mocked(useGenerationStore) as any).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) => selector(values),
  );
}

// ===========================================================================
// DangerZoneSection
// ===========================================================================

describe("DangerZoneSection", () => {
  const baseProps = {
    historyCount: 5,
    downloadedModelsCount: 2,
    onClearHistory: vi.fn(),
    onClearCache: vi.fn(),
    onDeleteAllModels: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders danger zone title and description", () => {
    render(<DangerZoneSection {...baseProps} />);
    expect(screen.getByText("settings.danger")).toBeTruthy();
    expect(screen.getByText("settings.dangerDescription")).toBeTruthy();
  });

  it("renders clear history button enabled when history exists", () => {
    render(<DangerZoneSection {...baseProps} />);
    const button = screen.getByText("settings.clearHistory").closest("button")!;
    expect(button.disabled).toBe(false);
  });

  it("disables clear history button when historyCount is 0", () => {
    render(<DangerZoneSection {...baseProps} historyCount={0} />);
    const button = screen.getByText("settings.clearHistory").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("disables delete all models button when downloadedModelsCount is 0", () => {
    render(<DangerZoneSection {...baseProps} downloadedModelsCount={0} />);
    const button = screen.getByText("settings.deleteAllModels").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("calls onClearHistory when clear history button is clicked", async () => {
    const user = userEvent.setup();
    render(<DangerZoneSection {...baseProps} />);
    await user.click(screen.getByText("settings.clearHistory"));
    expect(baseProps.onClearHistory).toHaveBeenCalledTimes(1);
  });

  it("calls onClearCache when clear backend cache button is clicked", async () => {
    const user = userEvent.setup();
    render(<DangerZoneSection {...baseProps} />);
    await user.click(screen.getByText("settings.clearBackendCache"));
    expect(baseProps.onClearCache).toHaveBeenCalledTimes(1);
  });

  it("calls onDeleteAllModels when delete all models button is clicked", async () => {
    const user = userEvent.setup();
    render(<DangerZoneSection {...baseProps} />);
    await user.click(screen.getByText("settings.deleteAllModels"));
    expect(baseProps.onDeleteAllModels).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// GeneralSection
// ===========================================================================

describe("GeneralSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  const baseProps = {
    draftCheckForUpdates: true,
    onDraftChange: vi.fn(),
    configDir: "/Users/test/.config/openloop",
    saveNotice: null,
  };

  it("renders general section title and description", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.getByText("settings.general")).toBeTruthy();
    expect(screen.getByText("settings.generalDescription")).toBeTruthy();
  });

  it("renders language selector", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.getByText("settings.language")).toBeTruthy();
    const select = screen.getByDisplayValue("English");
    expect(select).toBeTruthy();
  });

  it("renders check for updates checkbox", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.getByText("settings.checkForUpdates")).toBeTruthy();
  });

  it("renders reopen setup button", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.getByText("settings.reopenSetup")).toBeTruthy();
  });

  it("calls reopenSetup and closeSettings when reopen setup is clicked", async () => {
    const user = userEvent.setup();
    render(<GeneralSection {...baseProps} />);
    await user.click(screen.getByText("settings.reopenSetup"));
    expect(reopenSetup).toHaveBeenCalledTimes(1);
    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  it("renders reveal config file button", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.getByText("settings.revealConfigFile")).toBeTruthy();
  });

  it("renders release notes link", () => {
    render(<GeneralSection {...baseProps} />);
    const link = screen.getByText("settings.releaseNotes");
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "https://github.com/thedavidweng/OpenLoop/releases",
    );
  });

  it("shows save notice when provided", () => {
    render(<GeneralSection {...baseProps} saveNotice="Saved!" />);
    expect(screen.getByText("Saved!")).toBeTruthy();
  });

  it("hides save notice when null", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.queryByText("Saved!")).toBeNull();
  });

  it("calls onDraftChange when check for updates is toggled", async () => {
    const user = userEvent.setup();
    render(<GeneralSection {...baseProps} draftCheckForUpdates={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    // The first enabled checkbox is check for updates
    const enabledCheckbox = checkboxes.find((cb) => !cb.hasAttribute("disabled"));
    expect(enabledCheckbox).toBeTruthy();
    await user.click(enabledCheckbox!);
    expect(baseProps.onDraftChange).toHaveBeenCalledWith({ checkForUpdates: true });
  });

  it("renders anonymous error reports as disabled", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.getByText("settings.anonymousErrorReports")).toBeTruthy();
    // The disabled checkbox for anonymous error reports
    const disabledCheckbox = screen
      .getAllByRole("checkbox")
      .find((cb) => cb.hasAttribute("disabled"));
    expect(disabledCheckbox).toBeTruthy();
  });

  it("toggles high contrast mode when checkbox is clicked", async () => {
    const mockSetHighContrast = vi.fn();
    setupMockStore({ setHighContrast: mockSetHighContrast });
    const user = userEvent.setup();
    render(<GeneralSection {...baseProps} />);
    const highContrastCheckbox = screen.getByRole("checkbox", {
      name: /settings\.highContrast/i,
    }) as HTMLInputElement;
    expect(highContrastCheckbox.checked).toBe(false);
    await user.click(highContrastCheckbox);
    expect(mockSetHighContrast).toHaveBeenCalledWith(true);
  });

  it("reflects high contrast enabled state from store", () => {
    setupMockStore({ highContrast: true });
    render(<GeneralSection {...baseProps} />);
    const highContrastCheckbox = screen.getByRole("checkbox", {
      name: /settings\.highContrast/i,
    }) as HTMLInputElement;
    expect(highContrastCheckbox.checked).toBe(true);
  });

  it("renders reset to defaults button", () => {
    render(<GeneralSection {...baseProps} />);
    expect(screen.getByText("settings.resetToDefaults")).toBeTruthy();
  });
});

// ===========================================================================
// BackendSection
// ===========================================================================

describe("BackendSection", () => {
  const setDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  const baseProps = {
    draft: makeDraft(),
    setDraft,
    defaultPaths: {
      outputDirectory: "~/Music/OpenLoop",
      modelDirectory: "~/Library/Application Support/OpenLoop/models/checkpoints",
      logDirectory: "~/Library/Application Support/OpenLoop/logs/backend",
    },
    backendPortValid: true,
    onPickDirectory: vi.fn(),
    onShowNotice: vi.fn(),
  };

  it("renders backend section title and description", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.backend")).toBeTruthy();
    expect(screen.getByText("settings.backendDescription")).toBeTruthy();
  });

  it("renders backend port input with current value", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.backendPort")).toBeTruthy();
    const input = screen.getByDisplayValue("8080");
    expect(input).toBeTruthy();
  });

  it("shows invalid port warning when backendPortValid is false", () => {
    render(<BackendSection {...baseProps} backendPortValid={false} />);
    expect(screen.getByText("settings.backendPortInvalid")).toBeTruthy();
  });

  it("hides invalid port warning when backendPortValid is true", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.queryByText("settings.backendPortInvalid")).toBeNull();
  });

  it("renders log directory picker", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.logDirectory")).toBeTruthy();
  });

  it("renders restart backend button", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.restartBackend")).toBeTruthy();
  });

  it("renders open backend log button", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.openBackendLog")).toBeTruthy();
  });

  it("renders reset default port button", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.resetDefaultPort")).toBeTruthy();
  });

  it("renders repair runtime config button", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.repairRuntime")).toBeTruthy();
  });

  it("renders backend engine section", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.backendEngine")).toBeTruthy();
    expect(screen.getByText("v0.1.0")).toBeTruthy();
  });

  it("shows check for updates button when no update available", () => {
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.checkForBackendUpdates")).toBeTruthy();
  });

  it("shows update button when update is available", () => {
    setupMockStore({
      backendProvisionStatus: {
        ...makeProvisionReady(),
        updateAvailable: true,
        latestTag: "v0.2.0",
      },
    });
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.updateBackend")).toBeTruthy();
  });

  it("shows provisioning state when backend is downloading", () => {
    setupMockStore({
      backendProvisionStatus: {
        ...makeProvisionReady(),
        state: "downloading",
      },
    });
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("settings.provisioningBackend")).toBeTruthy();
  });

  it("shows not installed when no tag or commit available", () => {
    setupMockStore({
      backendProvisionStatus: {
        ...makeProvisionReady(),
        installedTag: null,
        installedCommit: null,
      },
    });
    render(<BackendSection {...baseProps} />);
    expect(screen.getByText("common.notInstalled")).toBeTruthy();
  });

  it("calls setDraft reset to defaults", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.resetToDefaults"));
    expect(setDraft).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// DefaultsSection
// ===========================================================================

describe("DefaultsSection", () => {
  const setDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  const baseProps = {
    draft: makeDraft(),
    setDraft,
    defaultPaths: {
      outputDirectory: "~/Music/OpenLoop",
      modelDirectory: "~/Library/Application Support/OpenLoop/models/checkpoints",
      logDirectory: "~/Library/Application Support/OpenLoop/logs/backend",
    },
    modelDirectoryLocked: false,
    showModelDirRestartHint: false,
    onPickDirectory: vi.fn(),
  };

  it("renders defaults section title and description", () => {
    render(<DefaultsSection {...baseProps} />);
    expect(screen.getByText("settings.defaults")).toBeTruthy();
    expect(screen.getByText("settings.defaultsDescription")).toBeTruthy();
  });

  it("renders default duration input", () => {
    render(<DefaultsSection {...baseProps} />);
    expect(screen.getByText("settings.defaultDuration")).toBeTruthy();
    expect(screen.getByDisplayValue("60")).toBeTruthy();
  });

  it("renders audio format selector", () => {
    render(<DefaultsSection {...baseProps} />);
    expect(screen.getByText("settings.audioFormat")).toBeTruthy();
    expect(screen.getByDisplayValue("WAV")).toBeTruthy();
  });

  it("renders output directory picker", () => {
    render(<DefaultsSection {...baseProps} />);
    expect(screen.getByText("settings.outputDirectory")).toBeTruthy();
  });

  it("renders model directory picker", () => {
    render(<DefaultsSection {...baseProps} />);
    expect(screen.getByText("settings.modelDirectory")).toBeTruthy();
  });

  it("renders default thinking checkbox", () => {
    render(<DefaultsSection {...baseProps} />);
    expect(screen.getByText("settings.defaultThinking")).toBeTruthy();
    expect(screen.getByText("settings.defaultThinkingDescription")).toBeTruthy();
  });

  it("shows model dir restart hint when showModelDirRestartHint is true", () => {
    render(<DefaultsSection {...baseProps} showModelDirRestartHint />);
    expect(screen.getByText("settings.restartForModelDir")).toBeTruthy();
    expect(screen.getByText("settings.restartNow")).toBeTruthy();
  });

  it("hides model dir restart hint by default", () => {
    render(<DefaultsSection {...baseProps} />);
    expect(screen.queryByText("settings.restartForModelDir")).toBeNull();
  });

  it("calls setDraft when reset to defaults is clicked", async () => {
    const user = userEvent.setup();
    render(<DefaultsSection {...baseProps} />);
    await user.click(screen.getByText("settings.resetToDefaults"));
    expect(setDraft).toHaveBeenCalledTimes(1);
  });

  it("calls setDraft when duration is changed", async () => {
    const user = userEvent.setup();
    render(<DefaultsSection {...baseProps} />);
    const input = screen.getByDisplayValue("60");
    await user.clear(input);
    await user.type(input, "90");
    expect(setDraft).toHaveBeenCalled();
  });
});

// ===========================================================================
// CliPathSection
// ===========================================================================

describe("CliPathSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  it("renders CLI path section title and description", () => {
    render(<CliPathSection />);
    expect(screen.getByText("settings.cliPath")).toBeTruthy();
    expect(screen.getByText("settings.cliPathDescription")).toBeTruthy();
  });

  it("renders CLI path hint text", () => {
    render(<CliPathSection />);
    expect(screen.getByText("settings.cliPathHint")).toBeTruthy();
  });

  it("shows loading state initially", () => {
    render(<CliPathSection />);
    expect(screen.getByText("settings.cliPathChecking")).toBeTruthy();
  });

  it("shows add button after loading completes (not added)", async () => {
    render(<CliPathSection />);
    const addButton = await screen.findByText("settings.cliPathAdd");
    expect(addButton).toBeTruthy();
  });
});

// ===========================================================================
// ModelsSection
// ===========================================================================

describe("ModelsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  it("renders models section title and description", () => {
    render(<ModelsSection />);
    expect(screen.getByText("settings.models")).toBeTruthy();
    expect(screen.getByText("settings.modelsDescription")).toBeTruthy();
  });

  it("renders model packs heading", () => {
    render(<ModelsSection />);
    expect(screen.getByText("settings.modelPacks")).toBeTruthy();
  });

  it("renders run profiles heading", () => {
    render(<ModelsSection />);
    expect(screen.getByText("settings.runProfiles")).toBeTruthy();
  });

  it("renders variant cards for lite, turbo, and pro", () => {
    render(<ModelsSection />);
    expect(screen.getByText("Lite")).toBeTruthy();
    expect(screen.getByText("Turbo")).toBeTruthy();
    expect(screen.getByText("XL Turbo")).toBeTruthy();
  });

  it("renders pack cards for standard and xl", () => {
    render(<ModelsSection />);
    // Model pack labels
    expect(screen.getByText("Standard")).toBeTruthy();
    expect(screen.getByText("XL")).toBeTruthy();
  });

  it("shows active badge on selected variant", () => {
    render(<ModelsSection />);
    expect(screen.getByText("model.active")).toBeTruthy();
  });
});
