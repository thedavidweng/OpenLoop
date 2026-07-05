import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockApi = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(() => true),
  listFailedRuns: vi.fn(),
  deleteFailedRun: vi.fn(),
  clearFailedRuns: vi.fn(),
}));

const mockAddToast = vi.fn();

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        key: `virtual-${index}`,
        index,
        start: index * 90,
        end: (index + 1) * 90,
        size: 90,
      })),
    getTotalSize: () => count * 90,
    measureElement: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api", () => mockApi);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("@/app/components/overlay/Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/components/settings/SettingsDialogHost", () => ({
  SettingsDialogHost: () => null,
}));

const mockSetField = vi.fn();
const mockSelectGenerationRecord = vi.fn();

let currentStoreState: Record<string, unknown>;

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(currentStoreState),
}));

const { HistorySidebar } = await import("@/app/components/history/HistorySidebar");

const SAMPLE_FAILED_RUN = {
  id: "failed-1",
  createdAt: "2025-01-15T10:30:00Z",
  errorCode: "generation_failed",
  errorMessage: "Backend unavailable",
  errorDetails: null,
  requestJson: null,
};

describe("HistorySidebar failed runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = {
      history: [],
      historyQuery: "",
      currentGeneration: null,
      selectedHistoryIds: [],
      favoriteRecordIds: [],
      compareModeActive: false,
      compareGenerationId: null,
      projects: [],
      activeProjectId: null,
      setActiveProject: vi.fn(),
      deleteGenerationRecord: vi.fn(),
      toggleFavoriteRecord: vi.fn(),
      restoreLastDeletedRecord: vi.fn(),
      selectGenerationRecord: mockSelectGenerationRecord,
      loadGenerationSettings: vi.fn(),
      clearGenerationHistory: vi.fn(),
      toggleSelectHistory: vi.fn(),
      clearSelection: vi.fn(),
      batchDeleteSelected: vi.fn(),
      batchFavoriteSelected: vi.fn(),
      enterCompareMode: vi.fn(),
      exitCompareMode: vi.fn(),
      setHistoryQuery: vi.fn(),
      setField: mockSetField,
    };
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.listFailedRuns.mockResolvedValue([SAMPLE_FAILED_RUN]);
  });

  it("logs a warning when clearing failed runs fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockApi.clearFailedRuns.mockRejectedValue(new Error("db locked"));
    const user = userEvent.setup();

    render(<HistorySidebar />);

    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });

    const failedRunsSection = screen.getByText("history.failedRuns:1").closest(".shrink-0");
    expect(failedRunsSection).toBeTruthy();
    const clearAllButton = failedRunsSection!.querySelector("svg.lucide-trash2")?.closest("button");
    expect(clearAllButton).toBeTruthy();
    await user.click(clearAllButton!);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Failed to clear failed runs:", expect.any(Error));
      expect(mockAddToast).toHaveBeenCalledWith("error", "history.failedRunClearFailed");
    });

    warnSpy.mockRestore();
  });

  it("logs a warning when removing a failed run fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockApi.deleteFailedRun.mockRejectedValue(new Error("db locked"));
    const user = userEvent.setup();

    render(<HistorySidebar />);

    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });

    await user.click(screen.getByText("history.failedRuns:1"));
    const removeButton = document.querySelector("svg.lucide-circle-x")?.closest("svg");
    expect(removeButton).toBeTruthy();
    fireEvent.click(removeButton!);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Failed to remove failed run:", expect.any(Error));
      expect(mockAddToast).toHaveBeenCalledWith("error", "history.failedRunRemoveFailed");
    });

    warnSpy.mockRestore();
  });
});
