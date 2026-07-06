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
const completeSetup = vi.fn().mockResolvedValue(undefined);
const enterDemoMode = vi.fn();
const downloadModelVariant = vi.fn().mockResolvedValue(undefined);
const selectModelVariant = vi.fn().mockResolvedValue(undefined);
const refreshModelStatuses = vi.fn().mockResolvedValue(undefined);
const provisionBackend = vi.fn().mockResolvedValue(undefined);
const clearGenerationHistory = vi.fn().mockResolvedValue(undefined);
const deleteAllModels = vi.fn().mockResolvedValue(undefined);
const hydrateFromPersistence = vi.fn().mockResolvedValue(undefined);
const openSettings = vi.fn();
const reopenSetup = vi.fn();

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
  clearBackendCache: vi.fn(() => Promise.resolve(undefined)),
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
      {props.hasUnsavedChanges ? <span>unsaved</span> : null}
      {props.saveNotice ? <span>{props.saveNotice}</span> : null}
      <button type="button" data-testid="trigger-save" onClick={props.onSave}>
        save
      </button>
      <button type="button" data-testid="trigger-discard" onClick={props.onDiscard}>
        discard
      </button>
    </div>
  ),
}));

vi.mock("@/app/components/settings/SettingsDialogs", () => ({
  SettingsDialogs: (props: {
    clearHistoryOpen?: boolean;
    clearCacheOpen?: boolean;
    deleteAllModelsOpen?: boolean;
    onConfirmClearHistory?: () => void;
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
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useGenerationStore } from "@/app/lib/store";
import { SetupScreen } from "@/app/components/settings/SetupScreen";
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
    closeSettings,
    completeSetup,
    enterDemoMode,
    downloadModelVariant,
    selectModelVariant,
    refreshModelStatuses,
    provisionBackend,
    clearGenerationHistory,
    deleteAllModels,
    hydrateFromPersistence,
    openSettings,
    reopenSetup,
  };
}

function setupMockStore(overrides?: Record<string, unknown>) {
  const values = { ...defaultStoreValues(), ...overrides };
  (vi.mocked(useGenerationStore) as any).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) => selector(values),
  );
}

/** Click the Next button and wait for the step title to appear. */
async function goToStep(user: ReturnType<typeof userEvent.setup>, stepTitle: string) {
  await user.click(screen.getByText("setup.next"));
  await screen.findByText(stepTitle);
}

// ===========================================================================
// SetupScreen
// ===========================================================================

describe("SetupScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  // -- Welcome step ---------------------------------------------------------

  it("renders the welcome step by default with action cards", () => {
    render(<SetupScreen />);

    expect(screen.getByText("setup.welcome")).toBeTruthy();
    expect(screen.getByText("setup.welcomeBody")).toBeTruthy();
    expect(screen.getByText("setup.downloadModel")).toBeTruthy();
    expect(screen.getByText("setup.pickOutput")).toBeTruthy();
  });

  it("renders the privacy policy link on the welcome step", () => {
    render(<SetupScreen />);

    const privacyLink = screen.getByText("Privacy policy");
    expect(privacyLink.getAttribute("href")).toContain("privacy.md");
    expect(privacyLink.getAttribute("target")).toBe("_blank");
  });

  // -- Navigation -----------------------------------------------------------

  it("navigates through all steps with Next button", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");
    await goToStep(user, "setup.output");
    await goToStep(user, "setup.done");
  });

  it("shows Back button after the first step and navigates backward", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    // No back button on welcome step
    expect(screen.queryByText("setup.back")).toBeNull();

    // Move to device step
    await goToStep(user, "setup.device");
    expect(screen.getByText("setup.back")).toBeTruthy();

    // Go back to welcome
    await user.click(screen.getByText("setup.back"));
    await screen.findByText("setup.welcome");
    expect(screen.queryByText("setup.back")).toBeNull();
  });

  it("shows Finish button on the done step instead of Next", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");
    await goToStep(user, "setup.output");
    await goToStep(user, "setup.done");

    expect(screen.queryByText("setup.next")).toBeNull();
    expect(screen.getByText("setup.finish")).toBeTruthy();
  });

  it("calls completeSetup when Finish is clicked", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");
    await goToStep(user, "setup.output");
    await goToStep(user, "setup.done");

    await user.click(screen.getByText("setup.finish"));
    expect(completeSetup).toHaveBeenCalledTimes(1);
  });

  // -- Close button ---------------------------------------------------------

  it("shows Close button when onClose prop is provided", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SetupScreen onClose={onClose} />);

    await user.click(screen.getByText("setup.close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not show Close button when onClose is not provided", () => {
    render(<SetupScreen />);

    expect(screen.queryByText("setup.close")).toBeNull();
  });

  // -- Device step ----------------------------------------------------------

  it("renders device info cards on the device step", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");

    expect(screen.getByText("setup.os")).toBeTruthy();
    expect(screen.getByText("macOS")).toBeTruthy();
    expect(screen.getByText("setup.architecture")).toBeTruthy();
    expect(screen.getByText("aarch64")).toBeTruthy();
    expect(screen.getByText("setup.memory")).toBeTruthy();
    expect(screen.getByText("16 GB")).toBeTruthy();
    expect(screen.getByText("setup.recommendedProfile")).toBeTruthy();
  });

  it("falls back to 'common.unknown' when deviceInfo is null", async () => {
    setupMockStore({ deviceInfo: null });
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");

    const unknowns = screen.getAllByText("common.unknown");
    // os, arch, memory = 3 unknowns (profile falls back to settings.profile)
    expect(unknowns.length).toBeGreaterThanOrEqual(3);
  });

  // -- Model step -----------------------------------------------------------

  it("renders engine provisioning card and model packs on the model step", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");

    expect(screen.getByText("ACE-Step Engine")).toBeTruthy();
    expect(screen.getByText("settings.backendEngineDescription")).toBeTruthy();
    expect(screen.getByText("setup.engineReady")).toBeTruthy();
  });

  it("shows variant picker cards on the model step", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");

    expect(screen.getByText("Lite")).toBeTruthy();
    expect(screen.getByText("Turbo")).toBeTruthy();
    expect(screen.getByText("XL Turbo")).toBeTruthy();
  });

  it("shows skip demo link on the model step", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");

    // "setup.skipDemo" has defaultValue: "setup.skipDemo"
    expect(screen.getByText("setup.skipDemo")).toBeTruthy();
  });

  it("calls enterDemoMode and completeSetup when skip demo is clicked", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");
    await user.click(screen.getByText("setup.skipDemo"));

    expect(enterDemoMode).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(completeSetup).toHaveBeenCalled();
    });
  });

  // -- Output step ----------------------------------------------------------

  it("renders output directory picker on the output step", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");
    await goToStep(user, "setup.output");

    expect(screen.getByText("settings.outputDirectory")).toBeTruthy();
    expect(screen.getByText("settings.chooseFolder")).toBeTruthy();
    expect(screen.getByText("settings.defaultPath")).toBeTruthy();
    expect(screen.getByText("~/Music/OpenLoop")).toBeTruthy();
  });

  it("hides default path badge when custom directory is set", async () => {
    setupMockStore({ settings: makeSettings({ outputDirectory: "/custom/path" }) });
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");
    await goToStep(user, "setup.output");

    expect(screen.getByText("/custom/path")).toBeTruthy();
    expect(screen.queryByText("settings.defaultPath")).toBeNull();
  });

  // -- Done step ------------------------------------------------------------

  it("renders keyboard shortcuts card on the done step", async () => {
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");
    await goToStep(user, "setup.output");
    await goToStep(user, "setup.done");

    // "setup.shortcutsHint" has defaultValue: "setup.shortcutsHint"
    expect(screen.getByText("setup.shortcutsHint")).toBeTruthy();
  });

  // -- StepIndicator --------------------------------------------------------

  it("renders step indicator with correct number of dots", () => {
    const { container } = render(<SetupScreen />);

    // StepIndicator renders one child per step
    const stepDots = container.querySelectorAll(".h-1.rounded-full");
    expect(stepDots.length).toBe(5);
  });

  // -- Engine status states -------------------------------------------------

  it("shows failed badge when backend provision fails", async () => {
    setupMockStore({
      backendProvisionStatus: {
        ...makeProvisionReady(),
        state: "failed",
        error: { code: "ERR", message: "download error", recoverable: true },
      },
    });
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");

    expect(screen.getByText("model.failed")).toBeTruthy();
  });

  it("shows retry button when engine download failed", async () => {
    setupMockStore({
      backendProvisionStatus: {
        ...makeProvisionReady(),
        state: "failed",
      },
    });
    const user = userEvent.setup();
    render(<SetupScreen />);

    await goToStep(user, "setup.device");
    await goToStep(user, "setup.model");

    const retryButtons = screen.getAllByText("model.retry");
    expect(retryButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// SettingsOverlay
// ===========================================================================

describe("SettingsOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  // -- Basic rendering ------------------------------------------------------

  it("renders the settings title and description", () => {
    render(<SettingsOverlay />);

    expect(screen.getByText("settings.title")).toBeTruthy();
    expect(screen.getByText("settings.description")).toBeTruthy();
  });

  it("renders all section navigation tabs", () => {
    render(<SettingsOverlay />);

    expect(screen.getByText("settings.models")).toBeTruthy();
    expect(screen.getByText("settings.defaults")).toBeTruthy();
    expect(screen.getByText("settings.general")).toBeTruthy();
    expect(screen.getByText("settings.backend")).toBeTruthy();
    expect(screen.getByText("settings.danger")).toBeTruthy();
  });

  it("renders all section components", () => {
    render(<SettingsOverlay />);

    expect(screen.getByTestId("models-section")).toBeTruthy();
    expect(screen.getByTestId("clipath-section")).toBeTruthy();
    expect(screen.getByTestId("defaults-section")).toBeTruthy();
    expect(screen.getByTestId("general-section")).toBeTruthy();
    expect(screen.getByTestId("backend-section")).toBeTruthy();
    expect(screen.getByTestId("danger-section")).toBeTruthy();
  });

  it("renders the save bar", () => {
    render(<SettingsOverlay />);

    expect(screen.getByTestId("save-bar")).toBeTruthy();
  });

  // -- Close button ---------------------------------------------------------

  it("calls closeSettings when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsOverlay />);

    await user.click(screen.getByLabelText("setup.close"));

    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  // -- Section navigation scroll --------------------------------------------

  it("scrolls to section when nav tab is clicked", async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const user = userEvent.setup();
    render(<SettingsOverlay />);

    // Create a target element for scrollIntoView
    const target = document.createElement("div");
    target.id = "settings-section-models";
    document.body.appendChild(target);

    await user.click(screen.getByText("settings.models"));

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "start" });

    document.body.removeChild(target);
  });

  // -- Dialogs (via DangerZoneSection mock) ---------------------------------

  it("opens clear history dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-clear-history"));
    expect(screen.getByText("clear-history-open")).toBeTruthy();
  });

  it("opens clear cache dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-clear-cache"));
    expect(screen.getByText("clear-cache-open")).toBeTruthy();
  });

  it("opens delete all models dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-delete-models"));
    expect(screen.getByText("delete-models-open")).toBeTruthy();
  });

  // -- Save and discard actions ---------------------------------------------

  it("calls saveChanges via save bar trigger", async () => {
    const user = userEvent.setup();
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-save"));

    // saveChanges calls persistSetting (which is mocked via api.setSetting),
    // then hydrateFromPersistence on success
    await waitFor(() => {
      expect(hydrateFromPersistence).toHaveBeenCalled();
    });
  });

  it("calls discardChanges via discard bar trigger", async () => {
    const user = userEvent.setup();
    render(<SettingsOverlay />);

    await user.click(screen.getByTestId("trigger-discard"));

    // discard resets draft; component should remain rendered
    expect(screen.getByTestId("save-bar")).toBeTruthy();
  });

  // -- Edge cases -----------------------------------------------------------

  it("renders with empty history", () => {
    setupMockStore({ history: [] });
    render(<SettingsOverlay />);

    expect(screen.getByText("settings.title")).toBeTruthy();
    expect(screen.getByTestId("danger-section")).toBeTruthy();
  });

  it("renders with no downloaded models", () => {
    setupMockStore({
      settings: makeSettings({ downloadedModels: [] }),
      modelStatuses: [],
    });
    render(<SettingsOverlay />);

    expect(screen.getByText("settings.title")).toBeTruthy();
    expect(screen.getByTestId("models-section")).toBeTruthy();
  });
});
