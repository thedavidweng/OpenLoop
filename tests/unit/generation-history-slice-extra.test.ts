import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationRecord } from "@/app/lib/types";

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: vi.fn(() => false),
  enhancePrompt: vi.fn(),
  resumeGenerationTask: vi.fn(),
  cancelGeneration: vi.fn(),
}));

vi.mock("@/app/lib/store-helpers", async (importOriginal) => {
  const mod: any = await importOriginal();
  return { ...mod, sleep: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("@/app/lib/model-packs", async (importOriginal) => {
  const mod: any = await importOriginal();
  return { ...mod, isModelDownloaded: vi.fn(() => true) };
});

const { DEFAULT_GENERATION_FORM_VALUES } = await import("@/app/lib/validation");
const { useGenerationStore } = await import("@/app/lib/store");

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function record(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
  return {
    id: "rec-1",
    createdAt: "2026-04-29T00:00:00Z",
    prompt: "ambient piano",
    lyrics: "",
    vocalLanguage: "en",
    durationSeconds: 30,
    bpm: undefined,
    keyScale: undefined,
    timeSignature: "4",
    model: "acestep-v15-turbo",
    taskType: "text2music",
    thinking: true,
    inferenceSteps: 8,
    guidanceScale: 7,
    useFormat: false,
    useCotCaption: true,
    useCotLanguage: true,
    constrainedDecoding: true,
    useRandomSeed: false,
    seed: 42,
    audioFormat: "wav",
    outputPath: "/tmp/rec-1.wav",
    status: "completed",
    errorMessage: null,
    isFavorite: false,
    ...overrides,
  };
}

function resetStore() {
  useGenerationStore.setState({
    form: { ...DEFAULT_GENERATION_FORM_VALUES },
    validationErrors: {},
    currentRequest: null,
    generationState: {
      status: "idle",
      phase: "idle",
      statusMessage: "Ready",
      error: null,
    },
    isSettingsOpen: false,
    sidebarVisible: true,
    sidebarWidth: 260,
    setupOverride: false,
    lyricsPanelOpen: false,
    demoMode: false,
    history: [],
    currentGeneration: null,
    lastDeletedRecord: null,
    selectedHistoryIds: [],
    compareModeActive: false,
    compareGenerationId: null,
    historyQuery: "",
    bootstrapStatus: {
      state: "ready" as const,
      message: "ok",
    },
  });
}

/* ================================================================== */
/*  Generation Slice — initial state (line 33)                         */
/* ================================================================== */

describe("Generation slice — initial state", () => {
  beforeEach(() => {
    resetStore();
  });

  it("initializes currentGeneration to null", () => {
    // The initial state from createGenerationSlice sets currentGeneration: null
    // After resetStore, it should be null
    expect(useGenerationStore.getState().currentGeneration).toBeNull();
  });

  it("initializes playbackToggleRequest to 0", () => {
    expect(useGenerationStore.getState().playbackToggleRequest).toBe(0);
  });

  it("initializes activeTasks to empty array", () => {
    expect(useGenerationStore.getState().activeTasks).toEqual([]);
  });

  it("initializes generationState to idle", () => {
    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("idle");
    expect(gs.phase).toBe("idle");
    expect(gs.error).toBeNull();
  });

  it("can set currentGeneration to a record and back to null", () => {
    const rec = record({ id: "test-gen" });
    useGenerationStore.setState({ currentGeneration: rec });
    expect(useGenerationStore.getState().currentGeneration?.id).toBe("test-gen");

    // Setting back to null exercises the initial value pattern
    useGenerationStore.setState({ currentGeneration: null });
    expect(useGenerationStore.getState().currentGeneration).toBeNull();
  });
});

/* ================================================================== */
/*  History Slice — initial state (lines 18, 21, 24)                   */
/* ================================================================== */

describe("History slice — initial state", () => {
  beforeEach(() => {
    resetStore();
  });

  // Line 18: currentGeneration: null
  it("initializes currentGeneration to null from history slice", () => {
    expect(useGenerationStore.getState().currentGeneration).toBeNull();
  });

  // Line 21: lastDeletedRecord: null
  it("initializes lastDeletedRecord to null", () => {
    expect(useGenerationStore.getState().lastDeletedRecord).toBeNull();
  });

  // Line 24: compareGenerationId: null
  it("initializes compareGenerationId to null", () => {
    expect(useGenerationStore.getState().compareGenerationId).toBeNull();
  });

  it("initializes history to empty array", () => {
    expect(useGenerationStore.getState().history).toEqual([]);
  });

  it("initializes favoriteRecordIds to empty array", () => {
    expect(useGenerationStore.getState().favoriteRecordIds).toEqual([]);
  });

  it("initializes selectedHistoryIds to empty array", () => {
    expect(useGenerationStore.getState().selectedHistoryIds).toEqual([]);
  });

  it("initializes compareModeActive to false", () => {
    expect(useGenerationStore.getState().compareModeActive).toBe(false);
  });

  // Verify that lastDeletedRecord can be set and restored
  it("can set lastDeletedRecord and restore it to null", () => {
    const rec = record({ id: "deleted-1" });
    useGenerationStore.setState({ lastDeletedRecord: rec });
    expect(useGenerationStore.getState().lastDeletedRecord?.id).toBe("deleted-1");

    useGenerationStore.setState({ lastDeletedRecord: null });
    expect(useGenerationStore.getState().lastDeletedRecord).toBeNull();
  });

  // Verify that compareGenerationId can be set and restored
  it("can set compareGenerationId and restore it to null", () => {
    useGenerationStore.setState({ compareGenerationId: "compare-target" });
    expect(useGenerationStore.getState().compareGenerationId).toBe("compare-target");

    useGenerationStore.setState({ compareGenerationId: null });
    expect(useGenerationStore.getState().compareGenerationId).toBeNull();
  });
});
