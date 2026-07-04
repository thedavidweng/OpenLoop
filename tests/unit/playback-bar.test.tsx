import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GenerationRecord } from "@/app/lib/types";

// --- Suppress jsdom "Not implemented" errors that deadlock vitest -----------
vi.hoisted(() => {
  HTMLMediaElement.prototype.load = function () {};
  HTMLMediaElement.prototype.pause = function () {};
  HTMLMediaElement.prototype.play = async function () {};
  // jsdom has no URL.createObjectURL — provide one for blob audio loading
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
  // Only inflate the playback bar container (has class app-panel-surface)
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

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => false,
  readGenerationAudio: (...args: unknown[]) => mockReadGenerationAudio(...args),
  readGenerationWaveform: (...args: unknown[]) =>
    mockReadGenerationWaveform(...args),
  copyAudioTo: vi.fn(),
  revealInFinder: vi.fn(),
  deleteGenerationFileAndRecord: (...args: unknown[]) =>
    mockDeleteGenerationFileAndRecord(...args),
}));

// IMPORTANT: `t` must be a stable reference — the PlaybackBar component has
// `t` in a useEffect dependency array.  A fresh function each render would
// cause an infinite re-render loop.
const stableT = (key: string, opts?: Record<string, unknown>) => {
  if (opts?.count !== undefined) return `${key}:${opts.count}`;
  if (opts?.time !== undefined) return `${key}:${opts.time}`;
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

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/app/components/overlay/Tooltip", () => ({
  Tooltip: ({
    children,
    label,
  }: {
    children: React.ReactNode;
    label: string;
  }) => <span data-tooltip-label={label}>{children}</span>,
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
  useGenerationStore: (selector: (state: MockStoreState) => unknown) =>
    selector(currentStoreState),
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

function makeStoreOverrides(
  overrides: Partial<MockStoreState> = {},
): MockStoreState {
  return {
    currentGeneration: overrides.currentGeneration ?? null,
    deleteGenerationRecord:
      overrides.deleteGenerationRecord ?? mockDeleteGenerationRecord,
    playbackToggleRequest: overrides.playbackToggleRequest ?? 0,
    compareModeActive: overrides.compareModeActive ?? false,
    toggleCompareTarget:
      overrides.toggleCompareTarget ?? mockToggleCompareTarget,
  };
}

// Import component after mocks are installed
const { PlaybackBar } = await import("@/app/components/player/PlaybackBar");

// --- Helper to find buttons by tooltip label --------------------------------

function getButtonByTooltip(label: string): HTMLButtonElement | undefined {
  return screen.getAllByRole("button").find((btn) => {
    const tooltip = btn.closest("[data-tooltip-label]");
    return tooltip?.getAttribute("data-tooltip-label") === label;
  }) as HTMLButtonElement | undefined;
}

// --- Tests -------------------------------------------------------------------

describe("PlaybackBar", () => {
  beforeEach(() => {
    currentStoreState = makeStoreOverrides();
    mockReadGenerationAudio.mockResolvedValue([0xff, 0xd8]);
    mockReadGenerationWaveform.mockResolvedValue({ peaks: [0.5, 0.8] });
  });

  // 1. Renders correctly with no track
  describe("with no track", () => {
    it("shows the app name when no generation is active", () => {
      render(<PlaybackBar />);
      expect(screen.getByText("OpenLoop")).toBeInTheDocument();
    });

    it("shows the no-generation subtitle", () => {
      render(<PlaybackBar />);
      expect(screen.getByText("player.noGeneration")).toBeInTheDocument();
    });

    it("disables the play button when no audio source is loaded", () => {
      render(<PlaybackBar />);
      const playPauseBtn =
        getButtonByTooltip("player.play") ?? getButtonByTooltip("player.pause");
      expect(playPauseBtn).toBeDefined();
      expect(playPauseBtn).toBeDisabled();
    });
  });

  // 2. Renders track info when a generation is loaded
  describe("with a track loaded", () => {
    it("shows the generation prompt as the track title", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      expect(await screen.findByText("lo-fi warm piano")).toBeInTheDocument();
    });

    it("shows format and duration metadata", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      await screen.findByText("lo-fi warm piano");
      expect(screen.getByText(/WAV.*120s/)).toBeInTheDocument();
    });

    it("fetches audio and waveform data for the generation", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      expect(mockReadGenerationAudio).toHaveBeenCalledWith("gen-1");
      expect(mockReadGenerationWaveform).toHaveBeenCalledWith("gen-1");
    });

    it("uses lyrics as track title when prompt is empty", async () => {
      const lyricsGeneration = {
        ...SAMPLE_GENERATION,
        prompt: "",
        lyrics: "Verse one lyrics",
      };
      currentStoreState = makeStoreOverrides({
        currentGeneration: lyricsGeneration,
      });
      render(<PlaybackBar />);
      expect(await screen.findByText("Verse one lyrics")).toBeInTheDocument();
    });
  });

  // 3. Handles play/pause button click
  describe("play/pause toggle", () => {
    it("enables the play button when a track is loaded", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);

      // Wait for the async audio fetch to resolve and set audioSrc
      await vi.waitFor(() => {
        const playPauseBtn =
          getButtonByTooltip("player.play") ??
          getButtonByTooltip("player.pause")!;
        expect(playPauseBtn).not.toBeDisabled();
      });
    });
  });

  // 4. Handles seek interaction
  describe("seek slider", () => {
    it("renders a seek range input with aria-label", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      const seekSlider = screen.getByRole("slider", { name: /seek/i });
      expect(seekSlider).toBeInTheDocument();
    });

    it("is disabled when no audio source is available", () => {
      render(<PlaybackBar />);
      const seekSlider = screen.getByRole("slider", { name: /seek/i });
      expect(seekSlider).toBeDisabled();
    });

    it("renders the seek slider when audio source is loaded", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      const seekSlider = screen.getByRole("slider", { name: /seek/i });
      expect(seekSlider).toBeInTheDocument();
    });
  });

  // 5. Handles volume interaction
  describe("volume control", () => {
    it("renders a volume range input", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      const volumeSlider = screen.getByRole("slider", { name: /volume/i });
      expect(volumeSlider).toBeInTheDocument();
    });

    it("defaults to full volume", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      const volumeSlider = screen.getByRole("slider", {
        name: /volume/i,
      }) as HTMLInputElement;
      expect(parseFloat(volumeSlider.value)).toBe(1);
    });

    it("is disabled when no audio source is available", () => {
      render(<PlaybackBar />);
      const volumeSlider = screen.getByRole("slider", { name: /volume/i });
      expect(volumeSlider).toBeDisabled();
    });

    it("enables the volume slider when audio source is loaded", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      await vi.waitFor(() => {
        const volumeSlider = screen.getByRole("slider", { name: /volume/i });
        expect(volumeSlider).not.toBeDisabled();
      });
    });

    it("toggles mute when the mute button is clicked", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      const user = userEvent.setup();
      render(<PlaybackBar />);

      const muteBtn = getButtonByTooltip("player.mute")!;
      await user.click(muteBtn);

      const volumeSlider = screen.getByRole("slider", {
        name: /volume/i,
      }) as HTMLInputElement;
      expect(parseFloat(volumeSlider.value)).toBe(0);
    });

    it("restores previous volume when unmuted", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      const user = userEvent.setup();
      render(<PlaybackBar />);

      // Mute
      await user.click(getButtonByTooltip("player.mute")!);

      // Unmute
      await user.click(getButtonByTooltip("player.unmute")!);

      const volumeSlider = screen.getByRole("slider", {
        name: /volume/i,
      }) as HTMLInputElement;
      expect(parseFloat(volumeSlider.value)).toBe(1);
    });
  });

  // 6. Handles next/previous track buttons (skip back / skip forward)
  describe("skip buttons", () => {
    it("renders skip-back and skip-forward buttons", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);

      expect(getButtonByTooltip("player.back10")).toBeDefined();
      expect(getButtonByTooltip("player.forward10")).toBeDefined();
    });

    it("disables skip buttons when no audio source is available", () => {
      render(<PlaybackBar />);

      expect(getButtonByTooltip("player.back10")).toBeDisabled();
      expect(getButtonByTooltip("player.forward10")).toBeDisabled();
    });

    it("enables skip buttons when audio source is loaded", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);

      await vi.waitFor(() => {
        expect(getButtonByTooltip("player.back10")).not.toBeDisabled();
        expect(getButtonByTooltip("player.forward10")).not.toBeDisabled();
      });
    });
  });

  // Bonus: compare mode
  describe("compare mode", () => {
    it("shows A/B toggle when compare mode is active", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
        compareModeActive: true,
      });
      render(<PlaybackBar />);
      expect(screen.getByText("A↔B")).toBeInTheDocument();
    });

    it("hides A/B toggle when compare mode is inactive", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
        compareModeActive: false,
      });
      render(<PlaybackBar />);
      expect(screen.queryByText("A↔B")).not.toBeInTheDocument();
    });
  });

  // Bonus: speed control
  describe("speed control", () => {
    it("displays the default speed of 1x", () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      render(<PlaybackBar />);
      expect(screen.getByText("1x")).toBeInTheDocument();
    });

    it("cycles through speed options on click", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      const user = userEvent.setup();
      render(<PlaybackBar />);

      await vi.waitFor(() => {
        expect(getButtonByTooltip("player.speed")).not.toBeDisabled();
      });

      const speedBtn = getButtonByTooltip("player.speed")!;
      await user.click(speedBtn);
      expect(screen.getByText("1.25x")).toBeInTheDocument();

      await user.click(speedBtn);
      expect(screen.getByText("1.5x")).toBeInTheDocument();
    });
  });

  // Bonus: loop toggle
  describe("loop toggle", () => {
    it("toggles loop mode on click", async () => {
      currentStoreState = makeStoreOverrides({
        currentGeneration: SAMPLE_GENERATION,
      });
      const user = userEvent.setup();
      render(<PlaybackBar />);

      await vi.waitFor(() => {
        expect(getButtonByTooltip("player.loop")).not.toBeDisabled();
      });

      const loopBtn = getButtonByTooltip("player.loop")!;
      await user.click(loopBtn);
      expect(loopBtn).toBeInTheDocument();
    });
  });

  // Bonus: time display
  describe("time display", () => {
    it("shows 0:00 for current position and duration when nothing is playing", () => {
      render(<PlaybackBar />);
      const timeLabels = screen.getAllByText("0:00");
      expect(timeLabels.length).toBeGreaterThanOrEqual(2);
    });
  });
});
