import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GenerationRecord } from "@/app/lib/types";

// --- Suppress jsdom "Not implemented" errors that deadlock vitest -----------
vi.hoisted(() => {
  HTMLMediaElement.prototype.load = function () {};
  HTMLMediaElement.prototype.pause = function () {};
  HTMLMediaElement.prototype.play = async function () {};
  if (typeof URL.createObjectURL === "undefined") {
    (URL as any).createObjectURL = () => "blob:mock-audio-url";
  }
  if (typeof URL.revokeObjectURL === "undefined") {
    (URL as any).revokeObjectURL = () => {};
  }
});

// jsdom returns 0 for getBoundingClientRect, which collapses the metadata
// section.  Override to return a realistic desktop width so track info renders.
const REALISTIC_WIDTH = 1280;
const origGetBCR = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () {
  const rect = origGetBCR.call(this);
  if ((this as HTMLElement).classList?.contains("app-panel-surface")) {
    return {
      ...rect,
      width: REALISTIC_WIDTH,
      height: 86,
      right: REALISTIC_WIDTH,
    };
  }
  return rect;
};

// --- Mocks ------------------------------------------------------------------

const mockReadGenerationAudio = vi.fn();
const mockReadGenerationWaveform = vi.fn();
const mockDeleteGenerationFileAndRecord = vi.fn().mockResolvedValue(undefined);
const mockRevealInFinder = vi.fn().mockResolvedValue(undefined);
const mockCopyAudioTo = vi.fn().mockResolvedValue("/dest/path");

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => false,
  readGenerationAudio: (...args: unknown[]) => mockReadGenerationAudio(...args),
  readGenerationWaveform: (...args: unknown[]) => mockReadGenerationWaveform(...args),
  copyAudioTo: (...args: unknown[]) => mockCopyAudioTo(...args),
  revealInFinder: (...args: unknown[]) => mockRevealInFinder(...args),
  deleteGenerationFileAndRecord: (...args: unknown[]) => mockDeleteGenerationFileAndRecord(...args),
}));

const stableT = (key: string, opts?: Record<string, unknown>) => {
  if (opts?.count !== undefined) return `${key}:${opts.count}`;
  if (opts?.time !== undefined) return `${key}:${opts.time}`;
  if (opts?.path !== undefined) return `${key}:${opts.path}`;
  return key;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: stableT,
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

// Store mock
const mockDeleteGenerationRecord = vi.fn().mockResolvedValue(undefined);
const mockToggleCompareTarget = vi.fn();

interface MockStoreState {
  currentGeneration: GenerationRecord | null;
  deleteGenerationRecord: typeof mockDeleteGenerationRecord;
  playbackToggleRequest: number;
  compareModeActive: boolean;
  toggleCompareTarget: typeof mockToggleCompareTarget;
}

let currentStoreState: MockStoreState;

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: MockStoreState) => unknown) => selector(currentStoreState),
}));

// --- Helpers -----------------------------------------------------------------

const SAMPLE_GENERATION: GenerationRecord = {
  id: "gen-1",
  createdAt: "2026-01-01T00:00:00Z",
  prompt: "lo-fi warm piano",
  negativePrompt: "",
  lyrics: "",
  vocalLanguage: "en",
  durationSeconds: 120,
  bpm: 90,
  keyScale: "C major",
  timeSignature: "4",
  model: "turbo",
  taskType: "text2music",
  thinking: false,
  inferenceSteps: 30,
  guidanceScale: 7,
  useFormat: false,
  useCotCaption: false,
  useCotLanguage: false,
  constrainedDecoding: false,
  useRandomSeed: true,
  audioFormat: "wav",
  outputPath: "/output/gen-1.wav",
  status: "completed",
  errorMessage: null,
  isFavorite: false,
};

function makeStoreOverrides(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    currentGeneration: overrides.currentGeneration ?? null,
    deleteGenerationRecord: overrides.deleteGenerationRecord ?? mockDeleteGenerationRecord,
    playbackToggleRequest: overrides.playbackToggleRequest ?? 0,
    compareModeActive: overrides.compareModeActive ?? false,
    toggleCompareTarget: overrides.toggleCompareTarget ?? mockToggleCompareTarget,
  };
}

const { PlaybackBar } = await import("@/app/components/player/PlaybackBar");

function getButtonByTooltip(label: string): HTMLButtonElement | undefined {
  return screen.getAllByRole("button").find((btn) => {
    const tooltip = btn.closest("[data-tooltip-label]");
    return tooltip?.getAttribute("data-tooltip-label") === label;
  }) as HTMLButtonElement | undefined;
}

// --- Tests -------------------------------------------------------------------

describe("PlaybackBar — export dropdown and outside click", () => {
  beforeEach(() => {
    currentStoreState = makeStoreOverrides({
      currentGeneration: SAMPLE_GENERATION,
    });
    mockReadGenerationAudio.mockResolvedValue([0xff, 0xd8]);
    mockReadGenerationWaveform.mockResolvedValue({ peaks: [0.5, 0.8] });
    mockDeleteGenerationFileAndRecord.mockResolvedValue(undefined);
    mockDeleteGenerationRecord.mockClear();
    mockAddToast.mockClear();
    mockRevealInFinder.mockClear();
    mockCopyAudioTo.mockClear();
  });

  // Covers lines 247-250: outside click closes export dropdown
  it("closes the export dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    render(<PlaybackBar />);
    await screen.findByText("lo-fi warm piano");

    // Open the export dropdown
    const exportBtn = getButtonByTooltip("player.exportMenu")!;
    expect(exportBtn).not.toBeDisabled();
    await user.click(exportBtn);

    // Dropdown should be open
    expect(screen.getByText("player.saveCopyAs")).toBeInTheDocument();

    // Click outside (on the body)
    fireEvent.mouseDown(document.body);

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByText("player.saveCopyAs")).not.toBeInTheDocument();
    });
  });

  // Covers line 664: revealInFinder call
  it("calls api.revealInFinder when reveal in finder is clicked", async () => {
    const user = userEvent.setup();
    render(<PlaybackBar />);
    await screen.findByText("lo-fi warm piano");

    // Open the export dropdown
    const exportBtn = getButtonByTooltip("player.exportMenu")!;
    await user.click(exportBtn);

    // Click reveal in finder
    await user.click(screen.getByText("player.revealInFinder"));

    expect(mockRevealInFinder).toHaveBeenCalledWith("/output/gen-1.wav");
  });

  // Covers lines 690-694: FileReader load handler copies data URL to clipboard
  it("copies data URL to clipboard when copy data URL is clicked", async () => {
    // Mock FileReader with proper addEventListener support
    class MockFileReader {
      result: string | null = null;
      listeners: Record<string, Array<(event: any) => void>> = {};

      addEventListener(event: string, callback: (event: any) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
      }

      readAsDataURL() {
        this.result = "data:audio/wav;base64,AAAA";
        setTimeout(() => {
          (this.listeners["load"] || []).forEach((cb) => cb({ target: this }));
        }, 0);
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    // Mock clipboard
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });

    const user = userEvent.setup();
    render(<PlaybackBar />);
    await screen.findByText("lo-fi warm piano");

    // Open the export dropdown
    const exportBtn = getButtonByTooltip("player.exportMenu")!;
    await user.click(exportBtn);

    // Click copy data URL
    await user.click(screen.getByText("player.copyDataUrl"));

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("success", "toast.dataUrlCopied");
    });

    // Restore
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
  });
});
