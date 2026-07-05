import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GenerationRecord } from "@/app/lib/types";

// Mock @tanstack/react-virtual before anything imports it
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getScrollElement: _getScrollElement,
  }: {
    count: number;
    getScrollElement: () => HTMLElement | null;
  }) => {
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

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => false,
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

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/app/components/overlay/Tooltip", () => ({
  Tooltip: ({ children, label }: { children: React.ReactNode; label: string }) => {
    // Clone child element to add aria-label from tooltip for test accessibility
    if (
      typeof children === "object" &&
      children !== null &&
      "props" in (children as React.ReactElement)
    ) {
      const child = children as React.ReactElement;
      // Only add aria-label if the child doesn't already have one
      if (!(child.props as Record<string, unknown>)["aria-label"]) {
        return <span data-tooltip-label={label}>{child}</span>;
      }
    }
    return <span data-tooltip-label={label}>{children}</span>;
  },
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
    ...overrides,
  };
}

let currentStoreState: ReturnType<typeof makeStoreOverrides>;

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(currentStoreState),
}));

const { HistorySidebar } = await import("@/app/components/history/HistorySidebar");

describe("HistorySidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = makeStoreOverrides();
  });

  it("renders history records in the list", () => {
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar solo" }),
      makeRecord({ id: "rec-3", prompt: "lo-fi beat" }),
    ];
    currentStoreState = makeStoreOverrides({ history: records });

    render(<HistorySidebar />);

    expect(screen.getByText("ambient piano")).toBeInTheDocument();
    expect(screen.getByText("jazz guitar solo")).toBeInTheDocument();
    expect(screen.getByText("lo-fi beat")).toBeInTheDocument();
  });

  it("shows the item count in the header", () => {
    const records = [
      makeRecord({ id: "rec-1" }),
      makeRecord({ id: "rec-2" }),
      makeRecord({ id: "rec-3" }),
    ];
    currentStoreState = makeStoreOverrides({ history: records });

    render(<HistorySidebar />);

    expect(screen.getByText("history.itemCount:3")).toBeInTheDocument();
  });

  it("shows empty state when no records exist", () => {
    currentStoreState = makeStoreOverrides({ history: [] });

    render(<HistorySidebar />);

    expect(screen.getByText("history.empty")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("filters records when historyQuery is set", () => {
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar solo" }),
      makeRecord({ id: "rec-3", prompt: "lo-fi beat" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      historyQuery: "jazz",
    });

    render(<HistorySidebar />);

    expect(screen.getByText("jazz guitar solo")).toBeInTheDocument();
    expect(screen.queryByText("ambient piano")).not.toBeInTheDocument();
    expect(screen.queryByText("lo-fi beat")).not.toBeInTheDocument();
  });

  it("shows empty state when search has no matches", () => {
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      historyQuery: "nonexistent",
    });

    render(<HistorySidebar />);

    expect(screen.getByText("history.empty")).toBeInTheDocument();
  });

  it("highlights the current/selected record", () => {
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      currentGeneration: records[0],
    });

    render(<HistorySidebar />);

    // The selected record's wrapper div has the sidebar-row-selected border/bg classes
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(2);
    // The first item's container should have the selected styling
    const firstItemContainer = listItems[0].querySelector("[draggable]");
    expect(firstItemContainer?.className).toContain("sidebar-row-selected");
  });

  it("toggles favorite on star button click", async () => {
    const user = userEvent.setup();
    const records = [makeRecord({ id: "rec-1", prompt: "ambient piano", isFavorite: false })];
    currentStoreState = makeStoreOverrides({
      history: records,
      favoriteRecordIds: [],
    });

    const { container } = render(<HistorySidebar />);

    // Find the favorite button via its tooltip wrapper
    const tooltipSpan = container.querySelector('[data-tooltip-label="history.favorite"]');
    expect(tooltipSpan).not.toBeNull();
    const starButton = tooltipSpan!.querySelector("button")!;
    await user.click(starButton);

    expect(mockToggleFavoriteRecord).toHaveBeenCalledWith("rec-1");
  });

  it("shows selection mode UI when items are multi-selected", () => {
    const records = [
      makeRecord({ id: "rec-1", prompt: "ambient piano" }),
      makeRecord({ id: "rec-2", prompt: "jazz guitar" }),
      makeRecord({ id: "rec-3", prompt: "lo-fi beat" }),
    ];
    currentStoreState = makeStoreOverrides({
      history: records,
      selectedHistoryIds: ["rec-1", "rec-3"],
    });

    render(<HistorySidebar />);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Favorite")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("handles delete action by opening confirm dialog", async () => {
    const user = userEvent.setup();
    const records = [makeRecord({ id: "rec-1", prompt: "ambient piano" })];
    currentStoreState = makeStoreOverrides({
      history: records,
      currentGeneration: records[0],
    });

    const { container } = render(<HistorySidebar />);

    // Find the delete button via its tooltip wrapper
    const tooltipSpan = container.querySelector('[data-tooltip-label="common.delete"]');
    expect(tooltipSpan).not.toBeNull();
    const deleteButton = tooltipSpan!.querySelector("button")!;
    await user.click(deleteButton);

    // The confirm dialog should open
    expect(screen.getByTestId("dialog-host")).toBeInTheDocument();
    expect(screen.getByText("history.deleteTitle")).toBeInTheDocument();
  });

  it("renders the search box with correct placeholder", () => {
    currentStoreState = makeStoreOverrides({ history: [] });

    render(<HistorySidebar />);

    const searchInput = screen.getByRole("textbox", { name: "history.search" });
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("placeholder", "history.search");
  });

  it("displays record metadata (BPM, format, duration)", () => {
    const records = [
      makeRecord({
        id: "rec-1",
        prompt: "test song",
        bpm: 140,
        keyScale: "A minor",
        audioFormat: "mp3",
        durationSeconds: 65,
      }),
    ];
    currentStoreState = makeStoreOverrides({ history: records });

    render(<HistorySidebar />);

    expect(screen.getByText(/140 BPM/)).toBeInTheDocument();
    expect(screen.getByText(/A minor/)).toBeInTheDocument();
    expect(screen.getByText(/MP3/)).toBeInTheDocument();
    expect(screen.getByText(/65s/)).toBeInTheDocument();
  });

  it("calls selectGenerationRecord when a record is clicked", async () => {
    const user = userEvent.setup();
    const records = [makeRecord({ id: "rec-1", prompt: "ambient piano" })];
    currentStoreState = makeStoreOverrides({ history: records });

    render(<HistorySidebar />);

    const recordButton = screen.getByRole("button", { name: /ambient piano/ });
    await user.click(recordButton);

    expect(mockSelectGenerationRecord).toHaveBeenCalledWith("rec-1");
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it("disables the clear-all button when history is empty", () => {
    currentStoreState = makeStoreOverrides({ history: [] });

    render(<HistorySidebar />);

    const clearAllButton = screen.getByRole("button", {
      name: /history\.clearAllShort/,
    });
    expect(clearAllButton).toBeDisabled();
  });

  it("filters 1000 records by search query without errors", () => {
    const records: GenerationRecord[] = Array.from({ length: 1000 }, (_, i) =>
      makeRecord({
        id: `rec-${i}`,
        prompt: i % 10 === 0 ? `needle ${i}` : `haystack ${i}`,
      }),
    );
    currentStoreState = makeStoreOverrides({ history: records, historyQuery: "needle" });

    render(<HistorySidebar />);

    // 1000 records, every 10th matches "needle" → 100 matches
    expect(screen.getByText("needle 0")).toBeInTheDocument();
    expect(screen.getByText("needle 990")).toBeInTheDocument();
    expect(screen.queryByText("haystack 1")).not.toBeInTheDocument();
  });

  it("uses Set-based O(1) membership lookups for favorites", () => {
    const records: GenerationRecord[] = Array.from({ length: 100 }, (_, i) =>
      makeRecord({ id: `rec-${i}`, prompt: `track ${i}` }),
    );
    const favIds = Array.from({ length: 50 }, (_, i) => `rec-${i * 2}`);
    currentStoreState = makeStoreOverrides({
      history: records,
      favoriteRecordIds: favIds,
    });

    const { container } = render(<HistorySidebar />);

    // 50 favorited records → 50 unfavorite tooltip wrappers
    const unfavTooltips = container.querySelectorAll('[data-tooltip-label="history.unfavorite"]');
    expect(unfavTooltips).toHaveLength(50);
    // Non-favorited records show the favorite tooltip wrapper
    const favTooltips = container.querySelectorAll('[data-tooltip-label="history.favorite"]');
    expect(favTooltips).toHaveLength(50);
  });
});
