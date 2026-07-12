import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { AppSettings, BackendProvisionStatus, ModelStatusSnapshot } from "@/app/lib/types";
import type { SettingsDraft } from "@/app/components/settings/hooks/useSettingsDraft";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddToast = vi.fn();
const mockRestartBackend = vi.fn(() => Promise.resolve(undefined));

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
  restartBackend: (...args: unknown[]) => mockRestartBackend(...(args as [])),
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
  useToast: () => ({ addToast: mockAddToast }),
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
import { DefaultsSection } from "@/app/components/settings/sections/DefaultsSection";

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
    ...overrides,
  };
  (vi.mocked(useGenerationStore) as any).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) => selector(values),
  );
}

// ===========================================================================
// DefaultsSection — restart backend button (lines 119-124)
// ===========================================================================

describe("DefaultsSection restart backend button", () => {
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
    showModelDirRestartHint: true,
    onPickDirectory: vi.fn(),
  };

  it("calls api.restartBackend and shows success toast when restart succeeds", async () => {
    mockRestartBackend.mockResolvedValue(undefined);
    render(<DefaultsSection {...baseProps} />);

    const restartButton = screen.getByText("settings.restartNow");
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mockRestartBackend).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("success", "settings.backendRestarted");
    });
  });

  it("shows error toast when restart backend fails", async () => {
    mockRestartBackend.mockRejectedValue(new Error("restart failed"));
    render(<DefaultsSection {...baseProps} />);

    const restartButton = screen.getByText("settings.restartNow");
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mockRestartBackend).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("error", "settings.backendRestartFailed");
    });
  });
});
