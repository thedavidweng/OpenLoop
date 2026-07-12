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

const mockSetField = vi.fn();
const mockSelectGenerationRecord = vi.fn();

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ setField: mockSetField, selectGenerationRecord: mockSelectGenerationRecord }),
}));

const { FailedRunsDrawer } = await import("@/app/components/history/FailedRunsDrawer");

const SAMPLE_REQUEST = {
  prompt: "cool song",
  negativePrompt: "noise",
  lyrics: "la la la",
  vocalLanguage: "en",
  durationSeconds: 30,
  bpm: 120,
  keyScale: "C",
  timeSignature: "4" as const,
  audioFormat: "wav" as const,
  model: "pro",
  taskType: "text2music" as const,
  lmModelPath: "/path/to/model",
  lmBackend: "mlx" as const,
  thinking: true,
  inferenceSteps: 20,
  guidanceScale: 7.5,
  useFormat: true,
  useCotCaption: false,
  useCotLanguage: true,
  constrainedDecoding: false,
  referenceAudioPath: "/ref.wav",
  srcAudioPath: "/src.wav",
  instruction: "do thing",
  repaintingStart: 0,
  repaintingEnd: 10,
  audioCoverStrength: 1.0,
  useRandomSeed: false,
  seed: 42,
  variationCount: 1,
};

const SAMPLE_FAILED_RUN = {
  id: "failed-1",
  createdAt: "2025-01-15T10:30:00Z",
  errorCode: "generation_failed",
  errorMessage: "Backend unavailable",
  errorDetails: "stack trace here",
  requestJson: JSON.stringify(SAMPLE_REQUEST),
};

const NULL_REQUEST_RUN = {
  id: "failed-2",
  createdAt: "2025-01-16T10:30:00Z",
  errorCode: "no_request",
  errorMessage: "no request",
  errorDetails: null,
  requestJson: null,
};

describe("FailedRunsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.isTauriRuntime.mockReturnValue(true);
    mockApi.listFailedRuns.mockResolvedValue([SAMPLE_FAILED_RUN]);
  });

  // 1. Rendering
  it("renders null when no failed runs", async () => {
    mockApi.listFailedRuns.mockResolvedValue([]);
    const { container } = render(<FailedRunsDrawer />);
    await waitFor(() => expect(mockApi.listFailedRuns).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders failed runs count badge when runs exist", async () => {
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
  });

  // 2. Expand/collapse
  it("toggles the run list and chevron on click", async () => {
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });

    // collapsed by default - chevron right, no error code visible
    expect(document.querySelector("svg.lucide-chevron-right")).toBeTruthy();
    expect(document.querySelector("svg.lucide-chevron-down")).toBeNull();
    expect(screen.queryByText("generation_failed")).toBeNull();

    // expand
    fireEvent.click(screen.getByText("history.failedRuns:1"));
    expect(document.querySelector("svg.lucide-chevron-down")).toBeTruthy();
    expect(document.querySelector("svg.lucide-chevron-right")).toBeNull();
    expect(screen.getByText("generation_failed")).toBeInTheDocument();

    // collapse
    fireEvent.click(screen.getByText("history.failedRuns:1"));
    expect(document.querySelector("svg.lucide-chevron-right")).toBeTruthy();
    expect(document.querySelector("svg.lucide-chevron-down")).toBeNull();
    expect(screen.queryByText("generation_failed")).toBeNull();
  });

  // 3. Clear all
  it("clears all runs on trash click and shows success toast", async () => {
    mockApi.clearFailedRuns.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });

    const clearAllButton = document.querySelector("svg.lucide-trash2")?.closest("button");
    expect(clearAllButton).toBeTruthy();
    await user.click(clearAllButton!);

    await waitFor(() => {
      expect(mockApi.clearFailedRuns).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith("info", "history.failedRunCleared");
    });
    expect(screen.queryByText("history.failedRuns:1")).toBeNull();
  });

  it("logs warning and shows error toast when clear all fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockApi.clearFailedRuns.mockRejectedValue(new Error("db locked"));
    const user = userEvent.setup();
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });

    const clearAllButton = document.querySelector("svg.lucide-trash2")?.closest("button");
    await user.click(clearAllButton!);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Failed to clear failed runs:", expect.any(Error));
      expect(mockAddToast).toHaveBeenCalledWith("error", "history.failedRunClearFailed");
    });
    warnSpy.mockRestore();
  });

  // 4. Retry
  it("retries with valid requestJson: sets all fields, clears record, shows info toast", async () => {
    const user = userEvent.setup();
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("history.failedRuns:1"));

    const retryButton = screen.getByText("common.retry").closest("button");
    expect(retryButton).toBeTruthy();
    await user.click(retryButton!);

    expect(mockSetField).toHaveBeenCalledWith("prompt", "cool song");
    expect(mockSetField).toHaveBeenCalledWith("negativePrompt", "noise");
    expect(mockSetField).toHaveBeenCalledWith("lyrics", "la la la");
    expect(mockSetField).toHaveBeenCalledWith("vocalLanguage", "en");
    expect(mockSetField).toHaveBeenCalledWith("durationSeconds", "30");
    expect(mockSetField).toHaveBeenCalledWith("bpmMode", "manual");
    expect(mockSetField).toHaveBeenCalledWith("bpm", "120");
    expect(mockSetField).toHaveBeenCalledWith("keyScale", "C");
    expect(mockSetField).toHaveBeenCalledWith("timeSignature", "4");
    expect(mockSetField).toHaveBeenCalledWith("audioFormat", "wav");
    expect(mockSetField).toHaveBeenCalledWith("model", "pro");
    expect(mockSetField).toHaveBeenCalledWith("taskType", "text2music");
    expect(mockSetField).toHaveBeenCalledWith("lmModelPath", "/path/to/model");
    expect(mockSetField).toHaveBeenCalledWith("lmBackend", "mlx");
    expect(mockSetField).toHaveBeenCalledWith("thinking", true);
    expect(mockSetField).toHaveBeenCalledWith("inferenceSteps", "20");
    expect(mockSetField).toHaveBeenCalledWith("guidanceScale", "7.5");
    expect(mockSetField).toHaveBeenCalledWith("useFormat", true);
    expect(mockSetField).toHaveBeenCalledWith("useCotCaption", false);
    expect(mockSetField).toHaveBeenCalledWith("useCotLanguage", true);
    expect(mockSetField).toHaveBeenCalledWith("constrainedDecoding", false);
    expect(mockSetField).toHaveBeenCalledWith("referenceAudioPath", "/ref.wav");
    expect(mockSetField).toHaveBeenCalledWith("srcAudioPath", "/src.wav");
    expect(mockSetField).toHaveBeenCalledWith("instruction", "do thing");
    expect(mockSetField).toHaveBeenCalledWith("repaintingStart", "0");
    expect(mockSetField).toHaveBeenCalledWith("repaintingEnd", "10");
    expect(mockSetField).toHaveBeenCalledWith("audioCoverStrength", "1");
    expect(mockSetField).toHaveBeenCalledWith("useRandomSeed", false);
    expect(mockSetField).toHaveBeenCalledWith("seed", "42");
    expect(mockSelectGenerationRecord).toHaveBeenCalledWith("");
    expect(mockAddToast).toHaveBeenCalledWith("info", "history.failedRunRetryLoaded");
  });

  it("disables retry button when requestJson is null", async () => {
    mockApi.listFailedRuns.mockResolvedValue([NULL_REQUEST_RUN]);
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("history.failedRuns:1"));

    const retryButton = screen.getByText("common.retry").closest("button");
    expect(retryButton).toBeDisabled();
  });

  it("shows error toast when requestJson is invalid JSON", async () => {
    mockApi.listFailedRuns.mockResolvedValue([
      { ...SAMPLE_FAILED_RUN, requestJson: "{not valid json" },
    ]);
    const user = userEvent.setup();
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("history.failedRuns:1"));

    const retryButton = screen.getByText("common.retry").closest("button");
    await user.click(retryButton!);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("error", "history.failedRunRetryFailed");
    });
    expect(mockSetField).not.toHaveBeenCalled();
  });

  // 5. Copy diagnostics
  it("copies error code/message/details to clipboard and shows info toast", async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("history.failedRuns:1"));

    const copyButton = screen.getByText("common.copy").closest("button");
    expect(copyButton).toBeTruthy();
    await user.click(copyButton!);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(
        "Error Code: generation_failed\nError Message: Backend unavailable\nError Details: stack trace here",
      );
      expect(mockAddToast).toHaveBeenCalledWith("info", "history.failedRunCopied");
    });
  });

  // 6. Remove
  it("removes a run on XCircle click and shows success toast", async () => {
    mockApi.deleteFailedRun.mockResolvedValue(undefined);
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("history.failedRuns:1"));

    const removeIcon = document.querySelector("svg.lucide-circle-x");
    expect(removeIcon).toBeTruthy();
    fireEvent.click(removeIcon!);

    await waitFor(() => {
      expect(mockApi.deleteFailedRun).toHaveBeenCalledWith("failed-1");
      expect(mockAddToast).toHaveBeenCalledWith("info", "history.failedRunRemoved");
    });
    expect(screen.queryByText("history.failedRuns:1")).toBeNull();
  });

  it("logs warning and shows error toast when remove fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockApi.deleteFailedRun.mockRejectedValue(new Error("db locked"));
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("history.failedRuns:1"));

    const removeIcon = document.querySelector("svg.lucide-circle-x");
    fireEvent.click(removeIcon!);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Failed to remove failed run:", expect.any(Error));
      expect(mockAddToast).toHaveBeenCalledWith("error", "history.failedRunRemoveFailed");
    });
    warnSpy.mockRestore();
  });

  // 7. Fetch
  it("fetches failed runs on mount with limit 50 and populates state", async () => {
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(mockApi.listFailedRuns).toHaveBeenCalledWith(50);
      expect(screen.getByText("history.failedRuns:1")).toBeInTheDocument();
    });
  });

  it("does not fetch when not Tauri runtime", async () => {
    mockApi.isTauriRuntime.mockReturnValue(false);
    const { container } = render(<FailedRunsDrawer />);
    // give effect a chance to run
    await new Promise((r) => setTimeout(r, 50));
    expect(mockApi.listFailedRuns).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it("logs warning on fetch error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockApi.listFailedRuns.mockRejectedValue(new Error("network"));
    render(<FailedRunsDrawer />);
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Failed to fetch failed runs:", expect.any(Error));
    });
    warnSpy.mockRestore();
  });
});
