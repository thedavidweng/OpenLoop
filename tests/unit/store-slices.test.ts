import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, GenerationEvent, GenerationRecord } from "@/app/lib/types";

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: false,
}));

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
