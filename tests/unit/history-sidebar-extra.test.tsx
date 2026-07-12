import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GenerationRecord } from "@/app/lib/types";

// Mock @tanstack/react-virtual before anything imports it
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number; getScrollElement: () => HTMLElement | null }) => {
    const items = Array.from({ length: count }, (_, i) => ({
      key: `virtual-${i}`,
      index: i,
      start: i * 90,
      end: (i + 1) * 90,
      size: 90,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * 90,
      measureElement: vi.fn(),
    };
  },
}));

// Make isTauriRuntime configurable
let tauriRuntime = false;
const mockSelectDirectory = vi.fn(() => Promise.resolve(null as string | null));
const mockExportGenerationsToFolder = vi.fn((_dest: string, _ids: string[]) =>
  Promise.resolve([] as string[]),
);

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => tauriRuntime,
  selectDirectory: (...args: unknown[]) => mockSelectDirectory(...(args as [])),
  exportGenerationsToFolder: (...args: unknown[]) =>
    mockExportGenerationsToFolder(...(args as [string, string[]])),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      if (opts?.time !== undefined) return `${key}:${opts.time}`;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

const mockAddToast = vi.fn();

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("@/app/components/overlay/Tooltip", () => ({
  Tooltip: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <span data-tooltip-label={label}>{children}</span>
  ),
}));

vi.mock("@/app/components/settings/SettingsDialogHost", () => ({
  SettingsDialogHost: ({
    open,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="dialog-host">
        <p>{title}</p>
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const mockDeleteGenerationRecord = vi.fn();
const mockToggleFavoriteRecord = vi.fn();
const mockRestoreLastDeletedRecord = vi.fn();
const mockSelectGenerationRecord = vi.fn();
const mockLoadGenerationSettings = vi.fn();
const mockClearGenerationHistory = vi.fn();
const mockToggleSelectHistory = vi.fn();
const mockClearSelection = vi.fn();
const mockBatchDeleteSelected = vi.fn();
const mockBatchFavoriteSelected = vi.fn();
const mockEnterCompareMode = vi.fn();
const mockExitCompareMode = vi.fn();
const mockSetHistoryQuery = vi.fn();
const mockAssignGenerationToProject = vi.fn();

function makeRecord(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
  return {
    id: "rec-1",
    createdAt: "2025-01-15T10:30:00Z",
    prompt: "ambient piano",
    lyrics: "",
    vocalLanguage: "en",
    durationSeconds: 30,
    bpm: 120,
    keyScale: "C major",
    timeSignature: "4",
    taskType: "text2music",
    thinking: false,
    inferenceSteps: 30,
    guidanceScale: 7.5,
    useFormat: false,
    useCotCaption: false,
    useCotLanguage: false,
    constrainedDecoding: false,
    useRandomSeed: true,
    audioFormat: "wav",
    outputPath: "/output/rec-1.wav",
    status: "completed",
    errorMessage: null,
    isFavorite: false,
    ...overrides,
  };
}

function makeStoreOverrides(overrides: Record<string, unknown> = {}) {
  return {
    history: overrides.history ?? [],
    historyQuery: overrides.historyQuery ?? "",
    currentGeneration: overrides.currentGeneration ?? null,
    selectedHistoryIds: overrides.selectedHistoryIds ?? [],
    favoriteRecordIds: overrides.favoriteRecordIds ?? [],
    compareModeActive: overrides.compareModeActive ?? false,
    compareGenerationId: overrides.compareGenerationId ?? null,
    projects: overrides.projects ?? [],
    activeProjectId: overrides.activeProjectId ?? null,
    setActiveProject: vi.fn(),
    deleteGenerationRecord: mockDeleteGenerationRecord,
    toggleFavoriteRecord: mockToggleFavoriteRecord,
    restoreLastDeletedRecord: mockRestoreLastDeletedRecord,
    selectGenerationRecord: mockSelectGenerationRecord,
    loadGenerationSettings: mockLoadGenerationSettings,
    clearGenerationHistory: mockClearGenerationHistory,
    toggleSelectHistory: mockToggleSelectHistory,
    clearSelection: mockClearSelection,
    batchDeleteSelected: mockBatchDeleteSelected,
    batchFavoriteSelected: mockBatchFavoriteSelected,
    enterCompareMode: mockEnterCompareMode,
    exitCompareMode: mockExitCompareMode,
    setHistoryQuery: mockSetHistoryQuery,
    assignGenerationToProject: mockAssignGenerationToProject,
    ...overrides,
  };
}

let currentStoreState: ReturnType<typeof makeStoreOverrides>;

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(currentStoreState),
}));

const { HistorySidebar } = await import("@/app/components/history/HistorySidebar");

describe("HistorySidebar — batch export dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriRuntime = false;
    currentStoreState = makeStoreOverrides();
    mockSelectDirectory.mockResolvedValue(null);
    mockExportGenerationsToFolder.mockResolvedValue([]);
  });

  // Covers line 512: addToast error when not Tauri runtime
  it("shows export requires desktop error when not in Tauri runtime", async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      selectedHistoryIds: ["rec-1", "rec-2"],
    });
    tauriRuntime = false;

    render(<HistorySidebar />);

    // Click the Export button in the selection toolbar
    await user.click(screen.getByText("Export"));

    // The batch export dialog should open
    expect(screen.getByTestId("dialog-host")).toBeInTheDocument();

    // Click confirm
    await user.click(screen.getByText("Choose folder & export"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("error", "toast.exportRequiresDesktop");
    });
  });

  // Covers line 519: addToast success when export succeeds
  it("shows files exported success toast when export succeeds in Tauri runtime", async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      selectedHistoryIds: ["rec-1", "rec-2"],
    });
    tauriRuntime = true;
    mockSelectDirectory.mockResolvedValue("/export/destination");
    mockExportGenerationsToFolder.mockResolvedValue(["rec-1.wav", "rec-2.wav"]);

    render(<HistorySidebar />);

    // Click the Export button
    await user.click(screen.getByText("Export"));

    // Confirm the export dialog
    await user.click(screen.getByText("Choose folder & export"));

    await waitFor(() => {
      expect(mockSelectDirectory).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockExportGenerationsToFolder).toHaveBeenCalledWith(
        ["rec-1", "rec-2"],
        "/export/destination",
      );
    });
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("success", "toast.filesExported:2");
    });

    tauriRuntime = false;
  });

  // Covers line 521: error handling when export fails
  it("shows error toast with error message when export throws an Error", async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      selectedHistoryIds: ["rec-1", "rec-2"],
    });
    tauriRuntime = true;
    mockSelectDirectory.mockResolvedValue("/export/destination");
    mockExportGenerationsToFolder.mockRejectedValue(new Error("Disk full"));

    render(<HistorySidebar />);

    await user.click(screen.getByText("Export"));
    await user.click(screen.getByText("Choose folder & export"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("error", "Disk full");
    });

    tauriRuntime = false;
  });

  // Covers line 521: error handling with non-Error throw
  it("shows generic export failed toast when export throws a non-Error", async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      selectedHistoryIds: ["rec-1", "rec-2"],
    });
    tauriRuntime = true;
    mockSelectDirectory.mockResolvedValue("/export/destination");
    mockExportGenerationsToFolder.mockRejectedValue("some string error");

    render(<HistorySidebar />);

    await user.click(screen.getByText("Export"));
    await user.click(screen.getByText("Choose folder & export"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("error", "toast.exportFailed");
    });

    tauriRuntime = false;
  });

  // Covers line 515: returns early when no destination selected
  it("does not export when destination dialog is cancelled", async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      selectedHistoryIds: ["rec-1", "rec-2"],
    });
    tauriRuntime = true;
    mockSelectDirectory.mockResolvedValue(null);

    render(<HistorySidebar />);

    await user.click(screen.getByText("Export"));
    await user.click(screen.getByText("Choose folder & export"));

    await waitFor(() => {
      expect(mockSelectDirectory).toHaveBeenCalled();
    });
    // exportGenerationsToFolder should not be called
    expect(mockExportGenerationsToFolder).not.toHaveBeenCalled();

    tauriRuntime = false;
  });
});
