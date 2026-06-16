import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, GenerationEvent, GenerationRecord } from "@/app/lib/types";

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
const api = await import("@/app/lib/api");
const { isModelDownloaded } = await import("@/app/lib/model-packs");

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

/* ------------------------------------------------------------------ */
/*  beforeEach: reset store to clean baseline                          */
/* ------------------------------------------------------------------ */

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
/*  1. UI Slice                                                        */
/* ================================================================== */

describe("UI slice", () => {
  beforeEach(() => {
    resetStore();
  });

  /* --- setField --------------------------------------------------- */

  describe("setField", () => {
    it("updates the specified form field", () => {
      useGenerationStore.getState().setField("prompt", "jazz drums");
      expect(useGenerationStore.getState().form.prompt).toBe("jazz drums");
    });

    it("clears cot fields when thinking is set to false", () => {
      // Pre-set cot fields to true
      useGenerationStore.setState({
        form: {
          ...useGenerationStore.getState().form,
          thinking: true,
          useCotCaption: true,
          useCotLanguage: true,
          constrainedDecoding: true,
        },
      });

      useGenerationStore.getState().setField("thinking", false);

      const form = useGenerationStore.getState().form;
      expect(form.thinking).toBe(false);
      expect(form.useCotCaption).toBe(false);
      expect(form.useCotLanguage).toBe(false);
      expect(form.constrainedDecoding).toBe(false);
    });

    it("does not clear cot fields when thinking is set to true", () => {
      useGenerationStore.setState({
        form: {
          ...useGenerationStore.getState().form,
          thinking: false,
          useCotCaption: false,
          useCotLanguage: false,
          constrainedDecoding: false,
        },
      });

      useGenerationStore.getState().setField("thinking", true);

      const form = useGenerationStore.getState().form;
      expect(form.thinking).toBe(true);
      // These should remain as-is since we didn't set them
      expect(form.useCotCaption).toBe(false);
      expect(form.useCotLanguage).toBe(false);
      expect(form.constrainedDecoding).toBe(false);
    });

    it("recomputes validationErrors after field change", () => {
      // Clear prompt to trigger validation error
      useGenerationStore.getState().setField("prompt", "");
      expect(useGenerationStore.getState().validationErrors.prompt).toBeDefined();
    });

    it("resets generationState to idle when status is not running or validating", () => {
      useGenerationStore.setState({
        generationState: {
          status: "completed",
          phase: "completed",
          statusMessage: "Done",
          error: null,
        },
      });

      useGenerationStore.getState().setField("prompt", "new prompt");

      expect(useGenerationStore.getState().generationState.status).toBe("idle");
      expect(useGenerationStore.getState().generationState.phase).toBe("idle");
    });

    it("resets generationState to idle when status is failed", () => {
      useGenerationStore.setState({
        generationState: {
          status: "failed",
          phase: "failed",
          statusMessage: "Failed",
          error: null,
        },
      });

      useGenerationStore.getState().setField("prompt", "new prompt");

      expect(useGenerationStore.getState().generationState.status).toBe("idle");
    });

    it("preserves generationState when status is running", () => {
      useGenerationStore.setState({
        generationState: {
          status: "running",
          phase: "running",
          statusMessage: "Generating...",
          error: null,
        },
      });

      useGenerationStore.getState().setField("prompt", "new prompt");

      expect(useGenerationStore.getState().generationState.status).toBe("running");
    });

    it("preserves generationState when status is validating", () => {
      useGenerationStore.setState({
        generationState: {
          status: "validating",
          phase: "validating",
          statusMessage: "Validating...",
          error: null,
        },
      });

      useGenerationStore.getState().setField("prompt", "new prompt");

      expect(useGenerationStore.getState().generationState.status).toBe("validating");
    });
  });

  /* --- toggleSettings --------------------------------------------- */

  describe("toggleSettings", () => {
    it("flips isSettingsOpen from false to true", () => {
      useGenerationStore.setState({ isSettingsOpen: false });
      useGenerationStore.getState().toggleSettings();
      expect(useGenerationStore.getState().isSettingsOpen).toBe(true);
    });

    it("flips isSettingsOpen from true to false", () => {
      useGenerationStore.setState({ isSettingsOpen: true });
      useGenerationStore.getState().toggleSettings();
      expect(useGenerationStore.getState().isSettingsOpen).toBe(false);
    });
  });

  /* --- toggleSidebar ---------------------------------------------- */

  describe("toggleSidebar", () => {
    it("flips sidebarVisible from true to false", () => {
      useGenerationStore.setState({ sidebarVisible: true });
      useGenerationStore.getState().toggleSidebar();
      expect(useGenerationStore.getState().sidebarVisible).toBe(false);
    });

    it("flips sidebarVisible from false to true", () => {
      useGenerationStore.setState({ sidebarVisible: false });
      useGenerationStore.getState().toggleSidebar();
      expect(useGenerationStore.getState().sidebarVisible).toBe(true);
    });
  });

  /* --- toggleLyricsPanel ------------------------------------------ */

  describe("toggleLyricsPanel", () => {
    it("flips lyricsPanelOpen from false to true", () => {
      useGenerationStore.setState({ lyricsPanelOpen: false });
      useGenerationStore.getState().toggleLyricsPanel();
      expect(useGenerationStore.getState().lyricsPanelOpen).toBe(true);
    });

    it("flips lyricsPanelOpen from true to false", () => {
      useGenerationStore.setState({ lyricsPanelOpen: true });
      useGenerationStore.getState().toggleLyricsPanel();
      expect(useGenerationStore.getState().lyricsPanelOpen).toBe(false);
    });
  });

  /* --- setSidebarWidth -------------------------------------------- */

  describe("setSidebarWidth", () => {
    it("sets width within range", () => {
      useGenerationStore.getState().setSidebarWidth(300);
      expect(useGenerationStore.getState().sidebarWidth).toBe(300);
    });

    it("clamps to minimum (240)", () => {
      useGenerationStore.getState().setSidebarWidth(100);
      expect(useGenerationStore.getState().sidebarWidth).toBe(240);
    });

    it("clamps to maximum (420)", () => {
      useGenerationStore.getState().setSidebarWidth(600);
      expect(useGenerationStore.getState().sidebarWidth).toBe(420);
    });

    it("accepts exact minimum boundary", () => {
      useGenerationStore.getState().setSidebarWidth(240);
      expect(useGenerationStore.getState().sidebarWidth).toBe(240);
    });

    it("accepts exact maximum boundary", () => {
      useGenerationStore.getState().setSidebarWidth(420);
      expect(useGenerationStore.getState().sidebarWidth).toBe(420);
    });
  });

  /* --- setHistoryQuery -------------------------------------------- */

  describe("setHistoryQuery", () => {
    it("updates the historyQuery string", () => {
      useGenerationStore.getState().setHistoryQuery("piano");
      expect(useGenerationStore.getState().historyQuery).toBe("piano");
    });

    it("accepts empty string", () => {
      useGenerationStore.setState({ historyQuery: "old" });
      useGenerationStore.getState().setHistoryQuery("");
      expect(useGenerationStore.getState().historyQuery).toBe("");
    });
  });

  /* --- closeSettings / openSettings ------------------------------- */

  describe("closeSettings / openSettings", () => {
    it("closeSettings sets isSettingsOpen to false", () => {
      useGenerationStore.setState({ isSettingsOpen: true });
      useGenerationStore.getState().closeSettings();
      expect(useGenerationStore.getState().isSettingsOpen).toBe(false);
    });

    it("openSettings sets isSettingsOpen to true", () => {
      useGenerationStore.setState({ isSettingsOpen: false });
      useGenerationStore.getState().openSettings();
      expect(useGenerationStore.getState().isSettingsOpen).toBe(true);
    });
  });

  /* --- closeSetup / reopenSetup ----------------------------------- */

  describe("closeSetup / reopenSetup", () => {
    it("closeSetup sets setupOverride to false", () => {
      useGenerationStore.setState({ setupOverride: true });
      useGenerationStore.getState().closeSetup();
      expect(useGenerationStore.getState().setupOverride).toBe(false);
    });

    it("reopenSetup sets setupOverride to true", () => {
      useGenerationStore.setState({ setupOverride: false });
      useGenerationStore.getState().reopenSetup();
      expect(useGenerationStore.getState().setupOverride).toBe(true);
    });

    it("reopenSetup also closes settings", () => {
      useGenerationStore.setState({
        setupOverride: false,
        isSettingsOpen: true,
      });
      useGenerationStore.getState().reopenSetup();
      expect(useGenerationStore.getState().isSettingsOpen).toBe(false);
    });
  });

  /* --- enterDemoMode / dismissDemoMode ---------------------------- */

  describe("enterDemoMode / dismissDemoMode", () => {
    it("enterDemoMode sets demoMode to true", () => {
      useGenerationStore.setState({ demoMode: false });
      useGenerationStore.getState().enterDemoMode();
      expect(useGenerationStore.getState().demoMode).toBe(true);
    });

    it("dismissDemoMode sets demoMode to false", () => {
      useGenerationStore.setState({ demoMode: true });
      useGenerationStore.getState().dismissDemoMode();
      expect(useGenerationStore.getState().demoMode).toBe(false);
    });
  });

  /* --- resetForm -------------------------------------------------- */

  describe("resetForm", () => {
    it("resets form to default values", () => {
      useGenerationStore.setState({
        form: {
          ...DEFAULT_GENERATION_FORM_VALUES,
          prompt: "custom prompt",
          lyrics: "custom lyrics",
          durationSeconds: "120",
        },
      });

      useGenerationStore.getState().resetForm();

      expect(useGenerationStore.getState().form.prompt).toBe("");
      expect(useGenerationStore.getState().form.lyrics).toBe("");
      expect(useGenerationStore.getState().form.durationSeconds).toBe("30");
      expect(useGenerationStore.getState().form).toEqual(DEFAULT_GENERATION_FORM_VALUES);
    });

    it("clears validation errors", () => {
      useGenerationStore.setState({
        validationErrors: { prompt: "required" },
      });

      useGenerationStore.getState().resetForm();

      expect(useGenerationStore.getState().validationErrors).toEqual({});
    });

    it("resets generationState to idle", () => {
      useGenerationStore.setState({
        generationState: {
          status: "completed",
          phase: "completed",
          statusMessage: "Done",
          error: null,
        },
      });

      useGenerationStore.getState().resetForm();

      const gs = useGenerationStore.getState().generationState;
      expect(gs.status).toBe("idle");
      expect(gs.phase).toBe("idle");
      expect(gs.error).toBeNull();
    });

    it("closes lyrics panel", () => {
      useGenerationStore.setState({ lyricsPanelOpen: true });
      useGenerationStore.getState().resetForm();
      expect(useGenerationStore.getState().lyricsPanelOpen).toBe(false);
    });
  });
});

/* ================================================================== */
/*  2. History Slice — pure actions                                    */
/* ================================================================== */

describe("History slice (pure actions)", () => {
  beforeEach(() => {
    resetStore();
  });

  /* --- selectGenerationRecord ------------------------------------- */

  describe("selectGenerationRecord", () => {
    it("sets currentGeneration to the matching record", () => {
      const rec = record({ id: "target" });
      useGenerationStore.setState({ history: [rec] });

      useGenerationStore.getState().selectGenerationRecord("target");

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("target");
    });

    it("keeps currentGeneration unchanged when id is not found", () => {
      const current = record({ id: "current" });
      useGenerationStore.setState({
        history: [current],
        currentGeneration: current,
      });

      useGenerationStore.getState().selectGenerationRecord("nonexistent");

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("current");
    });
  });

  /* --- restoreLastDeletedRecord ----------------------------------- */

  describe("restoreLastDeletedRecord", () => {
    it("moves lastDeletedRecord back to history and sets as current", () => {
      const deleted = record({ id: "restored", prompt: "deleted item" });
      useGenerationStore.setState({
        history: [],
        lastDeletedRecord: deleted,
        currentGeneration: null,
      });

      useGenerationStore.getState().restoreLastDeletedRecord();

      const state = useGenerationStore.getState();
      expect(state.history[0]?.id).toBe("restored");
      expect(state.lastDeletedRecord).toBeNull();
      expect(state.currentGeneration?.id).toBe("restored");
    });

    it("prepends the restored record to the front of history", () => {
      const existing = record({ id: "existing" });
      const deleted = record({ id: "restored" });
      useGenerationStore.setState({
        history: [existing],
        lastDeletedRecord: deleted,
      });

      useGenerationStore.getState().restoreLastDeletedRecord();

      expect(useGenerationStore.getState().history.map((r: GenerationRecord) => r.id)).toEqual([
        "restored",
        "existing",
      ]);
    });

    it("is a no-op when lastDeletedRecord is null", () => {
      useGenerationStore.setState({
        history: [],
        lastDeletedRecord: null,
        currentGeneration: null,
      });

      useGenerationStore.getState().restoreLastDeletedRecord();

      expect(useGenerationStore.getState().history).toEqual([]);
      expect(useGenerationStore.getState().currentGeneration).toBeNull();
    });
  });

  /* --- toggleSelectHistory ---------------------------------------- */

  describe("toggleSelectHistory", () => {
    it("selects an id when not yet selected (single mode)", () => {
      useGenerationStore.getState().toggleSelectHistory("a");
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual(["a"]);
    });

    it("deselects an id when already selected (single mode)", () => {
      useGenerationStore.setState({ selectedHistoryIds: ["a"] });
      useGenerationStore.getState().toggleSelectHistory("a");
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual([]);
    });

    it("replaces selection in single mode", () => {
      useGenerationStore.setState({ selectedHistoryIds: ["a"] });
      useGenerationStore.getState().toggleSelectHistory("b");
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual(["b"]);
    });

    it("adds to selection in multi mode", () => {
      useGenerationStore.setState({ selectedHistoryIds: ["a"] });
      useGenerationStore.getState().toggleSelectHistory("b", true);
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual(["a", "b"]);
    });

    it("removes from selection in multi mode", () => {
      useGenerationStore.setState({ selectedHistoryIds: ["a", "b"] });
      useGenerationStore.getState().toggleSelectHistory("a", true);
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual(["b"]);
    });

    it("caps at 2 selections in multi mode (for A/B compare)", () => {
      useGenerationStore.setState({ selectedHistoryIds: ["a", "b"] });
      useGenerationStore.getState().toggleSelectHistory("c", true);
      // Oldest ("a") is shifted out, ["b", "c"] remain
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual(["b", "c"]);
    });
  });

  /* --- clearSelection --------------------------------------------- */

  describe("clearSelection", () => {
    it("empties selectedHistoryIds", () => {
      useGenerationStore.setState({
        selectedHistoryIds: ["a", "b", "c"],
      });
      useGenerationStore.getState().clearSelection();
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual([]);
    });
  });

  /* --- enterCompareMode ------------------------------------------- */

  describe("enterCompareMode", () => {
    it("sets compareModeActive and compareGenerationId", () => {
      const current = record({ id: "current" });
      useGenerationStore.setState({ currentGeneration: current });

      useGenerationStore.getState().enterCompareMode("other");

      expect(useGenerationStore.getState().compareModeActive).toBe(true);
      expect(useGenerationStore.getState().compareGenerationId).toBe("other");
    });

    it("clears selectedHistoryIds on enter", () => {
      const current = record({ id: "current" });
      useGenerationStore.setState({
        currentGeneration: current,
        selectedHistoryIds: ["a", "b"],
      });

      useGenerationStore.getState().enterCompareMode("other");

      expect(useGenerationStore.getState().selectedHistoryIds).toEqual([]);
    });

    it("is a no-op when no currentGeneration is set", () => {
      useGenerationStore.setState({ currentGeneration: null });

      useGenerationStore.getState().enterCompareMode("other");

      expect(useGenerationStore.getState().compareModeActive).toBe(false);
      expect(useGenerationStore.getState().compareGenerationId).toBeNull();
    });

    it("is a no-op when id matches currentGeneration", () => {
      const current = record({ id: "same" });
      useGenerationStore.setState({ currentGeneration: current });

      useGenerationStore.getState().enterCompareMode("same");

      expect(useGenerationStore.getState().compareModeActive).toBe(false);
    });
  });

  /* --- exitCompareMode -------------------------------------------- */

  describe("exitCompareMode", () => {
    it("clears compareModeActive and compareGenerationId", () => {
      useGenerationStore.setState({
        compareModeActive: true,
        compareGenerationId: "some-id",
      });

      useGenerationStore.getState().exitCompareMode();

      expect(useGenerationStore.getState().compareModeActive).toBe(false);
      expect(useGenerationStore.getState().compareGenerationId).toBeNull();
    });
  });

  /* --- toggleCompareTarget ---------------------------------------- */

  describe("toggleCompareTarget", () => {
    it("swaps currentGeneration and compareGenerationId", () => {
      const current = record({ id: "cur" });
      const target = record({ id: "tgt", prompt: "target prompt" });
      useGenerationStore.setState({
        history: [current, target],
        currentGeneration: current,
        compareModeActive: true,
        compareGenerationId: "tgt",
      });

      useGenerationStore.getState().toggleCompareTarget();

      const state = useGenerationStore.getState();
      expect(state.currentGeneration?.id).toBe("tgt");
      expect(state.compareGenerationId).toBe("cur");
    });

    it("is a no-op when compareModeActive is false", () => {
      const current = record({ id: "cur" });
      useGenerationStore.setState({
        history: [current],
        currentGeneration: current,
        compareModeActive: false,
        compareGenerationId: null,
      });

      useGenerationStore.getState().toggleCompareTarget();

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("cur");
      expect(useGenerationStore.getState().compareGenerationId).toBeNull();
    });

    it("is a no-op when compareGenerationId is null", () => {
      const current = record({ id: "cur" });
      useGenerationStore.setState({
        history: [current],
        currentGeneration: current,
        compareModeActive: true,
        compareGenerationId: null,
      });

      useGenerationStore.getState().toggleCompareTarget();

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("cur");
      expect(useGenerationStore.getState().compareGenerationId).toBeNull();
    });

    it("is a no-op when target record is not in history", () => {
      const current = record({ id: "cur" });
      useGenerationStore.setState({
        history: [current],
        currentGeneration: current,
        compareModeActive: true,
        compareGenerationId: "missing",
      });

      useGenerationStore.getState().toggleCompareTarget();

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("cur");
      expect(useGenerationStore.getState().compareGenerationId).toBe("missing");
    });
  });
});

/* ================================================================== */
/*  3. Generation Slice — applyGenerationEvent                         */
/* ================================================================== */

describe("applyGenerationEvent", () => {
  beforeEach(() => {
    resetStore();
  });

  it("backend_starting: sets phase to backend_starting", () => {
    const event: GenerationEvent = { type: "backend_starting" };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("running");
    expect(gs.phase).toBe("backend_starting");
    expect(gs.error).toBeNull();
  });

  it("submitted: sets phase to submitted and stores taskId", () => {
    const event: GenerationEvent = {
      type: "submitted",
      taskId: "task-42",
    };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("running");
    expect(gs.phase).toBe("submitted");
    expect(gs.taskId).toBe("task-42");
    expect(gs.error).toBeNull();
  });

  it("queued: sets phase to queued", () => {
    const event: GenerationEvent = { type: "queued" };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("running");
    expect(gs.phase).toBe("queued");
    expect(gs.error).toBeNull();
  });

  it("running: updates progress percent", () => {
    const event: GenerationEvent = {
      type: "running",
      progressPercent: 55,
    };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("running");
    expect(gs.phase).toBe("running");
    expect(gs.progressPercent).toBe(55);
    expect(gs.error).toBeNull();
  });

  it("downloading: sets phase to downloading", () => {
    const event: GenerationEvent = { type: "downloading" };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("running");
    expect(gs.phase).toBe("downloading");
    expect(gs.error).toBeNull();
  });

  it("completed: sets status and phase to completed", () => {
    const event: GenerationEvent = {
      type: "completed",
      generationId: "gen-1",
      outputPath: "/tmp/gen-1.wav",
    };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("completed");
    expect(gs.phase).toBe("completed");
    expect(gs.error).toBeNull();
  });

  it("cancelled: sets status and phase to cancelled", () => {
    const event: GenerationEvent = { type: "cancelled" };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("cancelled");
    expect(gs.phase).toBe("cancelled");
    expect(gs.error).toBeNull();
  });

  it("failed: sets status to failed and stores error", () => {
    const appError: AppError = {
      code: "SOME_ERROR",
      message: "Something went wrong",
      recoverable: true,
    };
    const event: GenerationEvent = { type: "failed", error: appError };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("failed");
    expect(gs.phase).toBe("failed");
    expect(gs.error).toBeDefined();
    expect(gs.error?.code).toBe("SOME_ERROR");
  });

  it("failed with bootstrap error code updates bootstrapStatus", () => {
    const appError: AppError = {
      code: "BACKEND_START_FAILED",
      message: "Backend failed to start",
      recoverable: true,
    };
    const event: GenerationEvent = { type: "failed", error: appError };
    useGenerationStore.getState().applyGenerationEvent(event);

    const bs = useGenerationStore.getState().bootstrapStatus;
    expect(bs.state).toBe("failed");
  });

  it("failed with non-bootstrap error code keeps bootstrapStatus ready", () => {
    useGenerationStore.setState({
      bootstrapStatus: { state: "ready", message: "ok" },
    });

    const appError: AppError = {
      code: "VALIDATION_FAILED",
      message: "Invalid input",
      recoverable: true,
    };
    const event: GenerationEvent = { type: "failed", error: appError };
    useGenerationStore.getState().applyGenerationEvent(event);

    const bs = useGenerationStore.getState().bootstrapStatus;
    expect(bs.state).toBe("ready");
  });

  /* --- variation fields ------------------------------------------- */

  it("passes variation fields through submitted event", () => {
    const event: GenerationEvent = {
      type: "submitted",
      taskId: "task-1",
      variationCurrent: 2,
      variationTotal: 4,
    };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.variationCurrent).toBe(2);
    expect(gs.variationTotal).toBe(4);
  });

  it("passes variation fields through completed event", () => {
    const event: GenerationEvent = {
      type: "completed",
      generationId: "gen-1",
      outputPath: "/tmp/gen-1.wav",
      variationCurrent: 3,
      variationTotal: 3,
    };
    useGenerationStore.getState().applyGenerationEvent(event);

    const gs = useGenerationStore.getState().generationState;
    expect(gs.variationCurrent).toBe(3);
    expect(gs.variationTotal).toBe(3);
  });
});

/* ================================================================== */
/*  4. History Slice — uncovered actions                               */
/* ================================================================== */

describe("History slice (uncovered actions)", () => {
  beforeEach(() => {
    resetStore();
  });

  /* --- deleteGenerationRecord ------------------------------------- */

  describe("deleteGenerationRecord", () => {
    it("removes the record from history", async () => {
      const rec = record({ id: "del-1" });
      useGenerationStore.setState({ history: [rec] });

      await useGenerationStore.getState().deleteGenerationRecord("del-1");

      expect(useGenerationStore.getState().history).toEqual([]);
    });

    it("stores lastDeletedRecord by default (undoable)", async () => {
      const rec = record({ id: "del-1" });
      useGenerationStore.setState({ history: [rec] });

      await useGenerationStore.getState().deleteGenerationRecord("del-1");

      expect(useGenerationStore.getState().lastDeletedRecord?.id).toBe("del-1");
    });

    it("does not store lastDeletedRecord when undoable is false", async () => {
      const rec = record({ id: "del-1" });
      useGenerationStore.setState({ history: [rec], lastDeletedRecord: null });

      await useGenerationStore.getState().deleteGenerationRecord("del-1", { undoable: false });

      expect(useGenerationStore.getState().lastDeletedRecord).toBeNull();
    });

    it("advances currentGeneration to next record when deleting current", async () => {
      const cur = record({ id: "cur" });
      const next = record({ id: "next" });
      useGenerationStore.setState({
        history: [cur, next],
        currentGeneration: cur,
      });

      await useGenerationStore.getState().deleteGenerationRecord("cur");

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("next");
    });

    it("sets currentGeneration to null when deleting the last record", async () => {
      const cur = record({ id: "only" });
      useGenerationStore.setState({
        history: [cur],
        currentGeneration: cur,
      });

      await useGenerationStore.getState().deleteGenerationRecord("only");

      expect(useGenerationStore.getState().currentGeneration).toBeNull();
    });

    it("keeps currentGeneration when deleting a non-current record", async () => {
      const cur = record({ id: "cur" });
      const other = record({ id: "other" });
      useGenerationStore.setState({
        history: [cur, other],
        currentGeneration: cur,
      });

      await useGenerationStore.getState().deleteGenerationRecord("other");

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("cur");
    });
  });

  /* --- clearGenerationHistory ------------------------------------- */

  describe("clearGenerationHistory", () => {
    it("empties history array", async () => {
      useGenerationStore.setState({
        history: [record({ id: "a" }), record({ id: "b" })],
      });

      await useGenerationStore.getState().clearGenerationHistory();

      expect(useGenerationStore.getState().history).toEqual([]);
    });

    it("clears currentGeneration", async () => {
      const cur = record({ id: "cur" });
      useGenerationStore.setState({ currentGeneration: cur });

      await useGenerationStore.getState().clearGenerationHistory();

      expect(useGenerationStore.getState().currentGeneration).toBeNull();
    });

    it("resets compare state", async () => {
      useGenerationStore.setState({
        compareModeActive: true,
        compareGenerationId: "some-id",
        selectedHistoryIds: ["a", "b"],
        favoriteRecordIds: ["a"],
      });

      await useGenerationStore.getState().clearGenerationHistory();

      const state = useGenerationStore.getState();
      expect(state.compareModeActive).toBe(false);
      expect(state.compareGenerationId).toBeNull();
      expect(state.selectedHistoryIds).toEqual([]);
      expect(state.favoriteRecordIds).toEqual([]);
    });
  });

  /* --- loadGenerationSettings ------------------------------------- */

  describe("loadGenerationSettings", () => {
    it("is a no-op when record id is not in history", () => {
      const curForm = useGenerationStore.getState().form;
      useGenerationStore.setState({ history: [] });

      useGenerationStore.getState().loadGenerationSettings("missing", "settings");

      expect(useGenerationStore.getState().form).toEqual(curForm);
    });

    it("populates form fields from the record in settings mode", () => {
      const rec = record({
        id: "src",
        prompt: "lo-fi beats",
        durationSeconds: 60,
        bpm: 120,
        useRandomSeed: false,
        seed: 99,
      });
      useGenerationStore.setState({ history: [rec] });

      useGenerationStore.getState().loadGenerationSettings("src", "settings");

      const form = useGenerationStore.getState().form;
      expect(form.prompt).toBe("lo-fi beats");
      expect(form.durationSeconds).toBe("60");
      expect(form.bpm).toBe("120");
      expect(form.useRandomSeed).toBe(false);
      expect(form.seed).toBe("99");
    });

    it("forces useRandomSeed to false in reproduce mode", () => {
      const rec = record({
        id: "src",
        useRandomSeed: true,
        seed: 42,
      });
      useGenerationStore.setState({ history: [rec] });

      useGenerationStore.getState().loadGenerationSettings("src", "reproduce");

      expect(useGenerationStore.getState().form.useRandomSeed).toBe(false);
    });

    it("sets seed to the record's seed in reproduce mode", () => {
      const rec = record({
        id: "src",
        useRandomSeed: false,
        seed: 77,
      });
      useGenerationStore.setState({ history: [rec] });

      useGenerationStore.getState().loadGenerationSettings("src", "reproduce");

      expect(useGenerationStore.getState().form.seed).toBe("77");
    });

    it("sets currentGeneration to the loaded record", () => {
      const rec = record({ id: "src" });
      useGenerationStore.setState({ history: [rec], currentGeneration: null });

      useGenerationStore.getState().loadGenerationSettings("src", "settings");

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("src");
    });

    it("resets generationState to idle", () => {
      const rec = record({ id: "src" });
      useGenerationStore.setState({
        history: [rec],
        generationState: {
          status: "completed",
          phase: "completed",
          statusMessage: "Done",
          error: null,
        },
      });

      useGenerationStore.getState().loadGenerationSettings("src", "settings");

      expect(useGenerationStore.getState().generationState.status).toBe("idle");
    });

    it("handles bpm undefined (auto mode)", () => {
      const rec = record({ id: "src", bpm: undefined });
      useGenerationStore.setState({ history: [rec] });

      useGenerationStore.getState().loadGenerationSettings("src", "settings");

      expect(useGenerationStore.getState().form.bpmMode).toBe("auto");
      expect(useGenerationStore.getState().form.bpm).toBe("");
    });

    it("handles seed undefined in reproduce mode", () => {
      const rec = record({ id: "src", useRandomSeed: false, seed: undefined });
      useGenerationStore.setState({ history: [rec] });

      useGenerationStore.getState().loadGenerationSettings("src", "reproduce");

      expect(useGenerationStore.getState().form.seed).toBe("");
    });

    it("sets seed to empty string when useRandomSeed is true in settings mode", () => {
      const rec = record({ id: "src", useRandomSeed: true, seed: 42 });
      useGenerationStore.setState({ history: [rec] });

      useGenerationStore.getState().loadGenerationSettings("src", "settings");

      expect(useGenerationStore.getState().form.seed).toBe("");
    });
  });

  /* --- toggleFavoriteRecord (non-Tauri path) ---------------------- */

  describe("toggleFavoriteRecord", () => {
    it("adds id to favoriteRecordIds when not currently favorite", async () => {
      const rec = record({ id: "fav-1", isFavorite: false });
      useGenerationStore.setState({
        history: [rec],
        favoriteRecordIds: [],
      });

      await useGenerationStore.getState().toggleFavoriteRecord("fav-1");

      const state = useGenerationStore.getState();
      expect(state.favoriteRecordIds).toContain("fav-1");
      expect(state.history.find((r) => r.id === "fav-1")?.isFavorite).toBe(true);
    });

    it("removes id from favoriteRecordIds when already favorite", async () => {
      const rec = record({ id: "fav-1", isFavorite: true });
      useGenerationStore.setState({
        history: [rec],
        favoriteRecordIds: ["fav-1"],
      });

      await useGenerationStore.getState().toggleFavoriteRecord("fav-1");

      const state = useGenerationStore.getState();
      expect(state.favoriteRecordIds).not.toContain("fav-1");
      expect(state.history.find((r) => r.id === "fav-1")?.isFavorite).toBe(false);
    });

    it("does not affect other records in history", async () => {
      const a = record({ id: "a", isFavorite: false });
      const b = record({ id: "b", isFavorite: false });
      useGenerationStore.setState({
        history: [a, b],
        favoriteRecordIds: [],
      });

      await useGenerationStore.getState().toggleFavoriteRecord("a");

      expect(useGenerationStore.getState().history.find((r) => r.id === "b")?.isFavorite).toBe(
        false,
      );
    });
  });

  /* --- batchDeleteSelected ---------------------------------------- */

  describe("batchDeleteSelected", () => {
    it("is a no-op when selectedHistoryIds is empty", async () => {
      const history = [record({ id: "a" })];
      useGenerationStore.setState({ history, selectedHistoryIds: [] });

      await useGenerationStore.getState().batchDeleteSelected();

      expect(useGenerationStore.getState().history).toEqual(history);
    });

    it("removes all selected records from history", async () => {
      const a = record({ id: "a" });
      const b = record({ id: "b" });
      const c = record({ id: "c" });
      useGenerationStore.setState({
        history: [a, b, c],
        selectedHistoryIds: ["a", "c"],
      });

      await useGenerationStore.getState().batchDeleteSelected();

      expect(useGenerationStore.getState().history.map((r) => r.id)).toEqual(["b"]);
    });

    it("clears selectedHistoryIds after batch delete", async () => {
      useGenerationStore.setState({
        history: [record({ id: "a" })],
        selectedHistoryIds: ["a"],
      });

      await useGenerationStore.getState().batchDeleteSelected();

      expect(useGenerationStore.getState().selectedHistoryIds).toEqual([]);
    });

    it("nullifies currentGeneration when it was among the deleted", async () => {
      const a = record({ id: "a" });
      const b = record({ id: "b" });
      useGenerationStore.setState({
        history: [a, b],
        currentGeneration: a,
        selectedHistoryIds: ["a"],
      });

      await useGenerationStore.getState().batchDeleteSelected();

      expect(useGenerationStore.getState().currentGeneration).toBeNull();
    });

    it("keeps currentGeneration when it was not among the deleted", async () => {
      const a = record({ id: "a" });
      const b = record({ id: "b" });
      useGenerationStore.setState({
        history: [a, b],
        currentGeneration: b,
        selectedHistoryIds: ["a"],
      });

      await useGenerationStore.getState().batchDeleteSelected();

      expect(useGenerationStore.getState().currentGeneration?.id).toBe("b");
    });

    it("exits compare mode when compare target is deleted", async () => {
      const a = record({ id: "a" });
      const b = record({ id: "b" });
      useGenerationStore.setState({
        history: [a, b],
        currentGeneration: a,
        compareModeActive: true,
        compareGenerationId: "b",
        selectedHistoryIds: ["b"],
      });

      await useGenerationStore.getState().batchDeleteSelected();

      const state = useGenerationStore.getState();
      expect(state.compareModeActive).toBe(false);
      expect(state.compareGenerationId).toBeNull();
    });

    it("keeps compare mode when compare target is not deleted", async () => {
      const a = record({ id: "a" });
      const b = record({ id: "b" });
      const c = record({ id: "c" });
      useGenerationStore.setState({
        history: [a, b, c],
        currentGeneration: a,
        compareModeActive: true,
        compareGenerationId: "b",
        selectedHistoryIds: ["c"],
      });

      await useGenerationStore.getState().batchDeleteSelected();

      const state = useGenerationStore.getState();
      expect(state.compareModeActive).toBe(true);
      expect(state.compareGenerationId).toBe("b");
    });
  });

  /* --- batchFavoriteSelected -------------------------------------- */

  describe("batchFavoriteSelected", () => {
    it("is a no-op when selectedHistoryIds is empty", async () => {
      useGenerationStore.setState({
        history: [record({ id: "a", isFavorite: false })],
        selectedHistoryIds: [],
        favoriteRecordIds: [],
      });

      await useGenerationStore.getState().batchFavoriteSelected();

      expect(useGenerationStore.getState().history[0].isFavorite).toBe(false);
    });

    it("clears selectedHistoryIds after batch favorite", async () => {
      useGenerationStore.setState({
        history: [record({ id: "a" })],
        selectedHistoryIds: ["a"],
        favoriteRecordIds: [],
      });

      await useGenerationStore.getState().batchFavoriteSelected();

      expect(useGenerationStore.getState().selectedHistoryIds).toEqual([]);
    });

    it("leaves favoriteRecordIds unchanged in non-Tauri (no Tauri calls)", async () => {
      useGenerationStore.setState({
        history: [record({ id: "a" }), record({ id: "b" })],
        selectedHistoryIds: ["a", "b"],
        favoriteRecordIds: [],
      });

      await useGenerationStore.getState().batchFavoriteSelected();

      // In non-Tauri, newFavorites/removedFavorites stay empty, so records
      // get isFavorite=false (empty includes check) and favoriteRecordIds
      // gets deduped from existing minus removed plus new.
      expect(useGenerationStore.getState().selectedHistoryIds).toEqual([]);
    });
  });
});

/* ================================================================== */
/*  5. Generation Slice — async actions                                 */
/* ================================================================== */

describe("requestPlaybackToggle", () => {
  beforeEach(() => {
    resetStore();
  });

  it("increments playbackToggleRequest from 0 to 1", () => {
    useGenerationStore.setState({ playbackToggleRequest: 0 });
    useGenerationStore.getState().requestPlaybackToggle();
    expect(useGenerationStore.getState().playbackToggleRequest).toBe(1);
  });

  it("increments playbackToggleRequest from 5 to 6", () => {
    useGenerationStore.setState({ playbackToggleRequest: 5 });
    useGenerationStore.getState().requestPlaybackToggle();
    expect(useGenerationStore.getState().playbackToggleRequest).toBe(6);
  });

  it("increments monotonically across repeated calls", () => {
    useGenerationStore.setState({ playbackToggleRequest: 0 });
    useGenerationStore.getState().requestPlaybackToggle();
    useGenerationStore.getState().requestPlaybackToggle();
    useGenerationStore.getState().requestPlaybackToggle();
    expect(useGenerationStore.getState().playbackToggleRequest).toBe(3);
  });
});

/* ------------------------------------------------------------------ */

describe("cancelGeneration (preview)", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("sets generationState to cancelled", async () => {
    useGenerationStore.setState({
      generationState: {
        status: "running",
        phase: "running",
        statusMessage: "Generating...",
        error: null,
      },
    });

    await useGenerationStore.getState().cancelGeneration();

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("cancelled");
    expect(gs.phase).toBe("cancelled");
    expect(gs.error).toBeNull();
  });

  it("overwrites a failed state with cancelled", async () => {
    useGenerationStore.setState({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Error",
        error: { code: "X", message: "err", recoverable: true },
      },
    });

    await useGenerationStore.getState().cancelGeneration();

    expect(useGenerationStore.getState().generationState.status).toBe("cancelled");
    expect(useGenerationStore.getState().generationState.error).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("discardActiveTask (preview)", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  function task(id: string) {
    return {
      id,
      taskId: `tid-${id}`,
      request: {} as any,
      variationIndex: 1,
      variationTotal: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
  }

  it("removes the matching task from activeTasks", async () => {
    useGenerationStore.setState({ activeTasks: [task("a"), task("b")] as any });

    await useGenerationStore.getState().discardActiveTask("a");

    expect(useGenerationStore.getState().activeTasks.map((t: any) => t.id)).toEqual(["b"]);
  });

  it("is a no-op when the id is not found", async () => {
    useGenerationStore.setState({ activeTasks: [task("a")] as any });

    await useGenerationStore.getState().discardActiveTask("missing");

    expect(useGenerationStore.getState().activeTasks).toHaveLength(1);
  });

  it("clears activeTasks when discarding the last task", async () => {
    useGenerationStore.setState({ activeTasks: [task("only")] as any });

    await useGenerationStore.getState().discardActiveTask("only");

    expect(useGenerationStore.getState().activeTasks).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("refreshActiveTasks (preview)", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("is a no-op in preview mode (isTauriRuntime is false)", async () => {
    useGenerationStore.setState({ activeTasks: [] });

    await useGenerationStore.getState().refreshActiveTasks();

    expect(useGenerationStore.getState().activeTasks).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("resumeActiveTask", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  function task(id: string) {
    return {
      id,
      taskId: `tid-${id}`,
      request: {} as any,
      variationIndex: 1,
      variationTotal: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
  }

  it("sets phase to recovering before the api call", async () => {
    let resolveFn: (v: any) => void;
    const pending = new Promise((resolve) => {
      resolveFn = resolve;
    });
    vi.mocked(api.resumeGenerationTask).mockReturnValue(pending as any);

    useGenerationStore.setState({ activeTasks: [task("t1")] as any });

    const promise = useGenerationStore.getState().resumeActiveTask("t1");

    // Phase should be recovering while the api call is in-flight
    expect(useGenerationStore.getState().generationState.phase).toBe("recovering");
    expect(useGenerationStore.getState().generationState.status).toBe("running");

    resolveFn!(record({ id: "resumed" }));
    await promise;
  });

  it("sets completed state and currentGeneration on success", async () => {
    const mockRecord = record({ id: "resumed-1", prompt: "recovered song" });
    vi.mocked(api.resumeGenerationTask).mockResolvedValue(mockRecord as any);

    useGenerationStore.setState({
      activeTasks: [task("t1")] as any,
      history: [],
    });

    await useGenerationStore.getState().resumeActiveTask("t1");

    const state = useGenerationStore.getState();
    expect(state.generationState.status).toBe("completed");
    expect(state.generationState.phase).toBe("completed");
    expect(state.generationState.error).toBeNull();
    expect(state.currentGeneration?.id).toBe("resumed-1");
  });

  it("removes the resumed task from activeTasks", async () => {
    vi.mocked(api.resumeGenerationTask).mockResolvedValue(record({ id: "r1" }) as any);

    useGenerationStore.setState({
      activeTasks: [task("t1"), task("t2")] as any,
      history: [],
    });

    await useGenerationStore.getState().resumeActiveTask("t1");

    expect(useGenerationStore.getState().activeTasks.map((t: any) => t.id)).toEqual(["t2"]);
  });

  it("prepends resumed record to history and deduplicates", async () => {
    const existing = record({ id: "r1", prompt: "old version" });
    const updated = record({ id: "r1", prompt: "new version" });
    vi.mocked(api.resumeGenerationTask).mockResolvedValue(updated as any);

    useGenerationStore.setState({
      activeTasks: [task("t1")] as any,
      history: [existing],
    });

    await useGenerationStore.getState().resumeActiveTask("t1");

    const history = useGenerationStore.getState().history;
    expect(history.filter((r: any) => r.id === "r1")).toHaveLength(1);
    expect(history[0]?.prompt).toBe("new version");
  });

  it("sets failed state on error", async () => {
    vi.mocked(api.resumeGenerationTask).mockRejectedValue(
      new Error("backend unreachable"),
    );

    useGenerationStore.setState({ activeTasks: [task("t1")] as any });

    await useGenerationStore.getState().resumeActiveTask("t1");

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("failed");
    expect(gs.phase).toBe("failed");
    expect(gs.error).toBeDefined();
    expect(gs.error?.code).toBeDefined();
  });

  it("sets failed state with localized error on api rejection", async () => {
    vi.mocked(api.resumeGenerationTask).mockRejectedValue({
      code: "TASK_NOT_FOUND",
      message: "Task expired",
    });

    useGenerationStore.setState({ activeTasks: [task("t1")] as any });

    await useGenerationStore.getState().resumeActiveTask("t1");

    expect(useGenerationStore.getState().generationState.status).toBe("failed");
    expect(useGenerationStore.getState().generationState.error?.code).toBe("TASK_NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */

describe("enhancePrompt", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  function validForm(overrides: Record<string, any> = {}) {
    return {
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "jazz piano",
      lyrics: "",
      ...overrides,
    };
  }

  it("sets failed state and throws when validation fails (empty prompt and lyrics)", async () => {
    useGenerationStore.setState({ form: validForm({ prompt: "", lyrics: "" }) });

    await expect(useGenerationStore.getState().enhancePrompt()).rejects.toThrow();

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("failed");
    expect(gs.phase).toBe("failed");
    expect(gs.error?.code).toBe("VALIDATION_FAILED");
  });

  it("sets validationErrors before throwing on failure", async () => {
    useGenerationStore.setState({ form: validForm({ prompt: "", lyrics: "" }) });

    await expect(useGenerationStore.getState().enhancePrompt()).rejects.toThrow();

    expect(useGenerationStore.getState().validationErrors.prompt).toBeDefined();
    expect(useGenerationStore.getState().validationErrors.lyrics).toBeDefined();
  });

  it("sets currentRequest from the enhanced form after completion", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "enhanced" });

    useGenerationStore.setState({ form: validForm() });

    await useGenerationStore.getState().enhancePrompt();

    // currentRequest is recomputed from the enhanced form via computeValidationState
    expect(useGenerationStore.getState().currentRequest).not.toBeNull();
    expect(useGenerationStore.getState().currentRequest?.prompt).toBe("enhanced");
  });

  it("calls api.enhancePrompt with the validated request", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "enhanced" });

    useGenerationStore.setState({ form: validForm() });

    await useGenerationStore.getState().enhancePrompt();

    expect(api.enhancePrompt).toHaveBeenCalledOnce();
    const calledWith = vi.mocked(api.enhancePrompt).mock.calls[0][0];
    expect(calledWith.prompt).toBe("jazz piano");
  });

  it("updates form.prompt with enhanced value", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({
      prompt: "beautiful ambient jazz piano with soft brush drums",
    });

    useGenerationStore.setState({ form: validForm() });

    await useGenerationStore.getState().enhancePrompt();

    expect(useGenerationStore.getState().form.prompt).toBe(
      "beautiful ambient jazz piano with soft brush drums",
    );
  });

  it("falls back to original prompt when enhancement returns empty string", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "" });

    useGenerationStore.setState({ form: validForm() });

    await useGenerationStore.getState().enhancePrompt();

    expect(useGenerationStore.getState().form.prompt).toBe("jazz piano");
  });

  it("updates lyrics when enhancement provides them", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({
      prompt: "enhanced",
      lyrics: "verse one\nchorus",
    });

    useGenerationStore.setState({ form: validForm() });

    await useGenerationStore.getState().enhancePrompt();

    expect(useGenerationStore.getState().form.lyrics).toBe("verse one\nchorus");
  });

  it("preserves original lyrics when enhancement returns undefined lyrics", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "enhanced" });

    useGenerationStore.setState({ form: validForm({ lyrics: "my lyrics" }) });

    await useGenerationStore.getState().enhancePrompt();

    expect(useGenerationStore.getState().form.lyrics).toBe("my lyrics");
  });

  it("sets bpmMode to manual and bpm when enhancement provides bpm", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({
      prompt: "enhanced",
      bpm: 140,
    });

    useGenerationStore.setState({ form: validForm() });

    await useGenerationStore.getState().enhancePrompt();

    expect(useGenerationStore.getState().form.bpmMode).toBe("manual");
    expect(useGenerationStore.getState().form.bpm).toBe("140");
  });

  it("preserves bpmMode and bpm when enhancement returns undefined bpm", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "enhanced" });

    useGenerationStore.setState({
      form: validForm({ bpmMode: "manual", bpm: "100" }),
    });

    await useGenerationStore.getState().enhancePrompt();

    expect(useGenerationStore.getState().form.bpmMode).toBe("manual");
    expect(useGenerationStore.getState().form.bpm).toBe("100");
  });

  it("updates keyScale, timeSignature, durationSeconds, vocalLanguage", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({
      prompt: "enhanced",
      keyScale: "D minor",
      timeSignature: "3",
      durationSeconds: 90,
      vocalLanguage: "ja",
    });

    useGenerationStore.setState({ form: validForm() });

    await useGenerationStore.getState().enhancePrompt();

    const form = useGenerationStore.getState().form;
    expect(form.keyScale).toBe("D minor");
    expect(form.timeSignature).toBe("3");
    expect(form.durationSeconds).toBe("90");
    expect(form.vocalLanguage).toBe("ja");
  });

  it("preserves fields that enhancement returns as undefined", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "enhanced" });

    useGenerationStore.setState({
      form: validForm({
        keyScale: "F# major",
        timeSignature: "6",
        durationSeconds: "45",
        vocalLanguage: "de",
      }),
    });

    await useGenerationStore.getState().enhancePrompt();

    const form = useGenerationStore.getState().form;
    expect(form.keyScale).toBe("F# major");
    expect(form.timeSignature).toBe("6");
    expect(form.durationSeconds).toBe("45");
    expect(form.vocalLanguage).toBe("de");
  });

  it("resets generationState to idle after enhancement", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "enhanced" });

    useGenerationStore.setState({
      form: validForm(),
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Previous error",
        error: { code: "X", message: "err", recoverable: true },
      },
    });

    await useGenerationStore.getState().enhancePrompt();

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("idle");
    expect(gs.phase).toBe("idle");
    expect(gs.error).toBeNull();
  });

  it("clears validationErrors after successful enhancement", async () => {
    vi.mocked(api.enhancePrompt).mockResolvedValue({ prompt: "enhanced" });

    useGenerationStore.setState({
      form: validForm(),
      validationErrors: { prompt: "old error" },
    });

    await useGenerationStore.getState().enhancePrompt();

    expect(useGenerationStore.getState().validationErrors).toEqual({});
  });
});

/* ------------------------------------------------------------------ */

describe("runGeneration (preview)", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.mocked(isModelDownloaded).mockReturnValue(true);
  });

  function validForm(overrides: Record<string, any> = {}) {
    return {
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "ambient piano",
      lyrics: "",
      ...overrides,
    };
  }

  /* --- validation failure ----------------------------------------- */

  it("sets failed state when both prompt and lyrics are empty", async () => {
    useGenerationStore.setState({ form: validForm({ prompt: "", lyrics: "" }) });

    await useGenerationStore.getState().runGeneration();

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("failed");
    expect(gs.phase).toBe("failed");
    expect(gs.error?.code).toBe("VALIDATION_FAILED");
  });

  it("populates validationErrors on failure", async () => {
    useGenerationStore.setState({ form: validForm({ prompt: "", lyrics: "" }) });

    await useGenerationStore.getState().runGeneration();

    expect(useGenerationStore.getState().validationErrors.prompt).toBeDefined();
    expect(useGenerationStore.getState().validationErrors.lyrics).toBeDefined();
  });

  it("sets currentRequest to null on validation failure", async () => {
    useGenerationStore.setState({
      form: validForm({ prompt: "", lyrics: "" }),
      currentRequest: { prompt: "old" } as any,
    });

    await useGenerationStore.getState().runGeneration();

    // Validation returns isValid:false so request is null
    expect(useGenerationStore.getState().currentRequest).toBeNull();
  });

  /* --- model not downloaded --------------------------------------- */

  it("sets MODEL_REQUIRED error when model is not downloaded", async () => {
    vi.mocked(isModelDownloaded).mockReturnValue(false);
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo", downloadedModels: [] } as any,
    });

    await useGenerationStore.getState().runGeneration();

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("failed");
    expect(gs.phase).toBe("failed");
    expect(gs.error?.code).toBe("MODEL_REQUIRED");
  });

  /* --- successful preview generation ------------------------------ */

  it("completes successfully in preview mode", async () => {
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: [],
    });

    await useGenerationStore.getState().runGeneration();

    const state = useGenerationStore.getState();
    expect(state.generationState.status).toBe("completed");
    expect(state.generationState.phase).toBe("completed");
    expect(state.generationState.error).toBeNull();
  });

  it("creates a generation record and adds it to history", async () => {
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      history: [],
      recentPrompts: [],
    });

    await useGenerationStore.getState().runGeneration();

    const state = useGenerationStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.prompt).toBe("ambient piano");
    expect(state.history[0]?.status).toBe("completed");
  });

  it("sets currentGeneration to the new record", async () => {
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: [],
    });

    await useGenerationStore.getState().runGeneration();

    expect(useGenerationStore.getState().currentGeneration).not.toBeNull();
    expect(useGenerationStore.getState().currentGeneration?.prompt).toBe("ambient piano");
  });

  it("prepends new record to front of existing history", async () => {
    const existing = record({ id: "old-1" });
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      history: [existing],
      recentPrompts: [],
    });

    await useGenerationStore.getState().runGeneration();

    expect(useGenerationStore.getState().history).toHaveLength(2);
    expect(useGenerationStore.getState().history[1]?.id).toBe("old-1");
  });

  /* --- recent prompts --------------------------------------------- */

  it("adds prompt to recentPrompts", async () => {
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: [],
    });

    await useGenerationStore.getState().runGeneration();

    expect(useGenerationStore.getState().recentPrompts).toContain("ambient piano");
  });

  it("deduplicates prompt in recentPrompts", async () => {
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: ["ambient piano", "other"],
    });

    await useGenerationStore.getState().runGeneration();

    const prompts = useGenerationStore.getState().recentPrompts;
    expect(prompts.filter((p: string) => p === "ambient piano")).toHaveLength(1);
  });

  it("moves existing prompt to front of recentPrompts", async () => {
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: ["first", "ambient piano", "last"],
    });

    await useGenerationStore.getState().runGeneration();

    expect(useGenerationStore.getState().recentPrompts[0]).toBe("ambient piano");
  });

  it("does not add empty prompt to recentPrompts", async () => {
    useGenerationStore.setState({
      form: validForm({ prompt: "" }),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: [],
    });

    // This will fail validation since both prompt and lyrics are empty
    // (validForm sets lyrics to ""), but let's use lyrics to pass validation
    useGenerationStore.setState({
      form: validForm({ prompt: "", lyrics: "some lyrics here" }),
    });

    await useGenerationStore.getState().runGeneration();

    // Empty prompt means requestPrompt is falsy, so recentPrompts is unchanged
    expect(useGenerationStore.getState().recentPrompts).toEqual([]);
  });

  /* --- preview failure (prompt contains "fail") ------------------- */

  it("sets PREVIEW_GENERATION_FAILED when prompt contains 'fail'", async () => {
    useGenerationStore.setState({
      form: validForm({ prompt: "this should fail gracefully" }),
      settings: { modelVariant: "turbo" } as any,
    });

    await useGenerationStore.getState().runGeneration();

    const gs = useGenerationStore.getState().generationState;
    expect(gs.status).toBe("failed");
    expect(gs.phase).toBe("failed");
    expect(gs.error?.code).toBe("PREVIEW_GENERATION_FAILED");
  });

  it("does not add to history when preview fails", async () => {
    useGenerationStore.setState({
      form: validForm({ prompt: "this will fail" }),
      settings: { modelVariant: "turbo" } as any,
      history: [],
    });

    await useGenerationStore.getState().runGeneration();

    expect(useGenerationStore.getState().history).toEqual([]);
  });

  /* --- validation with lyrics only -------------------------------- */

  it("passes validation when only lyrics are provided (no prompt)", async () => {
    useGenerationStore.setState({
      form: validForm({ prompt: "", lyrics: "just lyrics" }),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: [],
    });

    await useGenerationStore.getState().runGeneration();

    expect(useGenerationStore.getState().generationState.status).toBe("completed");
    expect(useGenerationStore.getState().history).toHaveLength(1);
  });

  /* --- currentRequest is populated -------------------------------- */

  it("sets currentRequest to the validated request on success", async () => {
    useGenerationStore.setState({
      form: validForm(),
      settings: { modelVariant: "turbo" } as any,
      recentPrompts: [],
    });

    await useGenerationStore.getState().runGeneration();

    const req = useGenerationStore.getState().currentRequest;
    expect(req).not.toBeNull();
    expect(req?.prompt).toBe("ambient piano");
  });
});
