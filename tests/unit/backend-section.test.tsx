import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BackendProvisionStatus } from "@/app/lib/types";
import type { SettingsDraft } from "@/app/components/settings/hooks/useSettingsDraft";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  hydrateFromPersistence,
  updateBackend,
  refreshBackendProvisionStatus,
  restartBackend,
  getBackendLogsPath,
  revealInFinder,
  setSetting,
  resetRuntimeSettings,
} = vi.hoisted(() => ({
  hydrateFromPersistence: vi.fn().mockResolvedValue(undefined),
  updateBackend: vi.fn().mockResolvedValue(undefined),
  refreshBackendProvisionStatus: vi.fn().mockResolvedValue(undefined),
  restartBackend: vi.fn(() => Promise.resolve(undefined)),
  getBackendLogsPath: vi.fn(() => Promise.resolve("/logs/backend" as string | null)),
  revealInFinder: vi.fn(() => Promise.resolve(undefined)),
  setSetting: vi.fn(() => Promise.resolve({})),
  resetRuntimeSettings: vi.fn(() => Promise.resolve(undefined)),
}));

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
  setSetting,
  restartBackend,
  getBackendLogsPath,
  revealInFinder,
  resetRuntimeSettings,
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useGenerationStore } from "@/app/lib/store";
import { BackendSection } from "@/app/components/settings/sections/BackendSection";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

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
    hydrateFromPersistence,
    updateBackend,
    refreshBackendProvisionStatus,
    backendProvisionStatus: makeProvisionReady(),
    ...overrides,
  };
  (vi.mocked(useGenerationStore) as any).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) => selector(values),
  );
}

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

  // -------------------------------------------------------------------------
  // restartBackend button (lines 95-98)
  // -------------------------------------------------------------------------

  it("calls restartBackend and shows success notice on resolve", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.restartBackend"));
    await waitFor(() => expect(restartBackend).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.backendRestarted"),
    );
  });

  it("shows failure notice when restartBackend rejects", async () => {
    restartBackend.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.restartBackend"));
    await waitFor(() => expect(restartBackend).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.backendRestartFailed"),
    );
  });

  // -------------------------------------------------------------------------
  // openBackendLog button (lines 107-116)
  // -------------------------------------------------------------------------

  it("calls revealInFinder when getBackendLogsPath returns a path", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.openBackendLog"));
    await waitFor(() => expect(getBackendLogsPath).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(revealInFinder).toHaveBeenCalledWith("/logs/backend"));
    expect(baseProps.onShowNotice).not.toHaveBeenCalled();
  });

  it("shows noBackendLog notice when getBackendLogsPath returns null", async () => {
    getBackendLogsPath.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.openBackendLog"));
    await waitFor(() => expect(getBackendLogsPath).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.noBackendLog"),
    );
    expect(revealInFinder).not.toHaveBeenCalled();
  });

  it("shows backendLogPathFailed notice when getBackendLogsPath rejects", async () => {
    getBackendLogsPath.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.openBackendLog"));
    await waitFor(() => expect(getBackendLogsPath).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.backendLogPathFailed"),
    );
  });

  // -------------------------------------------------------------------------
  // resetDefaultPort button (lines 125-131)
  // -------------------------------------------------------------------------

  it("calls setSetting, hydrates, and shows success notice on reset default port", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.resetDefaultPort"));
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith("backendPort", 8001));
    await waitFor(() => expect(hydrateFromPersistence).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.backendPortReset"),
    );
  });

  it("shows failure notice when setSetting rejects on reset default port", async () => {
    setSetting.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.resetDefaultPort"));
    await waitFor(() => expect(setSetting).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.settingUpdateFailed"),
    );
    expect(hydrateFromPersistence).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // repairRuntime button (lines 140-146)
  // -------------------------------------------------------------------------

  it("calls resetRuntimeSettings, hydrates, and shows success notice on repair runtime", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.repairRuntime"));
    await waitFor(() => expect(resetRuntimeSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hydrateFromPersistence).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.runtimeSettingsRepaired"),
    );
  });

  it("shows failure notice when resetRuntimeSettings rejects on repair runtime", async () => {
    resetRuntimeSettings.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.repairRuntime"));
    await waitFor(() => expect(resetRuntimeSettings).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(baseProps.onShowNotice).toHaveBeenCalledWith("settings.settingUpdateFailed"),
    );
    expect(hydrateFromPersistence).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Backend engine version / update controls
  // -------------------------------------------------------------------------

  it("calls updateBackend when update button is clicked", async () => {
    setupMockStore({
      backendProvisionStatus: {
        ...makeProvisionReady(),
        updateAvailable: true,
        latestTag: "v0.2.0",
      },
    });
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.updateBackend"));
    expect(updateBackend).toHaveBeenCalledTimes(1);
  });

  it("calls refreshBackendProvisionStatus when check for updates is clicked", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.checkForBackendUpdates"));
    expect(refreshBackendProvisionStatus).toHaveBeenCalledTimes(1);
  });

  it("calls onPickDirectory with logDirectory when choose folder is clicked", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.chooseFolder"));
    expect(baseProps.onPickDirectory).toHaveBeenCalledWith("logDirectory");
  });

  it("calls setDraft to clear logDirectory when use default is clicked", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} draft={makeDraft({ logDirectory: "/custom/logs" })} />);
    await user.click(screen.getByText("settings.useDefault"));
    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0];
    expect(updater({ ...makeDraft(), logDirectory: "/custom/logs" })).toEqual({
      ...makeDraft(),
      logDirectory: "",
    });
  });

  it("updates backendPort in draft when port input changes", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    const input = screen.getByDisplayValue("8080");
    await user.clear(input);
    await user.type(input, "9000");
    expect(setDraft).toHaveBeenCalled();
  });

  it("resets backendPort and logDirectory when reset to defaults is clicked", async () => {
    const user = userEvent.setup();
    render(<BackendSection {...baseProps} />);
    await user.click(screen.getByText("settings.resetToDefaults"));
    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0];
    expect(updater(makeDraft())).toEqual({
      ...makeDraft(),
      backendPort: "8001",
      logDirectory: "",
    });
  });
});
