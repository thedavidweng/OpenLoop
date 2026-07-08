import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationRecord, GenerationRequest, GenerationRunResult } from "@/app/lib/types";

const generateMusic = vi.fn<(request: GenerationRequest) => Promise<GenerationRunResult>>();
const isTauriRuntime = vi.fn(() => true);
const deleteGenerationFileAndRecord = vi.fn<(id: string) => Promise<void>>();
const clearGenerationHistory = vi.fn<() => Promise<void>>();

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => isTauriRuntime(),
  generateMusic: (request: GenerationRequest) => generateMusic(request),
  cancelGeneration: vi.fn(),
  getSettings: vi.fn(),
  listGenerations: vi.fn(),
  getDeviceInfo: vi.fn(),
  listModelCatalog: vi.fn(),
  getModelStatus: vi.fn(),
  listActiveGenerationTasks: vi.fn(),
  listProjects: vi.fn(() => Promise.resolve([])),
  listenToGenerationEvents: vi.fn(),
  listenToModelDownloadEvents: vi.fn(),
  deleteGenerationFileAndRecord: (id: string) => deleteGenerationFileAndRecord(id),
  clearGenerationHistory: () => clearGenerationHistory(),
  listProfiles: vi.fn(() => Promise.resolve([])),
}));

const { DEFAULT_GENERATION_FORM_VALUES } = await import("@/app/lib/validation");
const { useGenerationStore } = await import("@/app/lib/store");

function record(id: string, seed: number): GenerationRecord {
  return {
    id,
    createdAt: `2026-04-29T00:00:0${seed}Z`,
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
    seed,
    audioFormat: "wav",
    outputPath: `/tmp/${id}.wav`,
    status: "completed",
    errorMessage: null,
    isFavorite: false,
  };
}

describe("generation store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    isTauriRuntime.mockReset();
    isTauriRuntime.mockReturnValue(true);
    generateMusic.mockReset();
    deleteGenerationFileAndRecord.mockReset();
    deleteGenerationFileAndRecord.mockResolvedValue();
    clearGenerationHistory.mockReset();
    clearGenerationHistory.mockResolvedValue();
    useGenerationStore.setState({
      form: {
        ...DEFAULT_GENERATION_FORM_VALUES,
        prompt: "ambient piano",
        variations: 2,
      },
      history: [],
      currentGeneration: null,
      settings: {
        ...useGenerationStore.getState().settings,
        firstRunCompleted: true,
        modelVariant: "turbo",
        downloadedModels: ["turbo"],
      },
      generationState: {
        status: "idle",
        phase: "idle",
        statusMessage: "Ready",
        error: null,
      },
    });
  });

  it("stores every completed variation returned by the Tauri command", async () => {
    generateMusic.mockResolvedValue({
      records: [record("variant-1", 101), record("variant-2", 102)],
    });

    const run = useGenerationStore.getState().runGeneration();
    await vi.advanceTimersByTimeAsync(350);
    await run;

    const state = useGenerationStore.getState();
    expect(state.history.map((item) => item.id)).toEqual(["variant-1", "variant-2"]);
    expect(state.currentGeneration?.id).toBe("variant-2");
    expect(state.generationState.phase).toBe("completed");
  });

  it("deletes a history output through the file-and-record command", async () => {
    useGenerationStore.setState({
      history: [record("kept", 1), record("deleted", 2)],
      currentGeneration: record("deleted", 2),
    });

    await useGenerationStore.getState().deleteGenerationRecord("deleted");

    expect(deleteGenerationFileAndRecord).toHaveBeenCalledWith("deleted");
    expect(useGenerationStore.getState().history.map((item) => item.id)).toEqual(["kept"]);
    expect(useGenerationStore.getState().currentGeneration?.id).toBe("kept");
  });

  it("clears generated output history after the backend deletes files and records", async () => {
    useGenerationStore.setState({
      history: [record("first", 1), record("second", 2)],
      currentGeneration: record("second", 2),
    });

    await useGenerationStore.getState().clearGenerationHistory();

    expect(clearGenerationHistory).toHaveBeenCalledOnce();
    expect(useGenerationStore.getState().history).toEqual([]);
    expect(useGenerationStore.getState().currentGeneration).toBeNull();
  });

  it("does not create history when browser preview generation fails", async () => {
    isTauriRuntime.mockReturnValue(false);

    useGenerationStore.setState({
      form: {
        ...DEFAULT_GENERATION_FORM_VALUES,
        prompt: "fail this preview",
      },
      history: [record("existing", 1)],
      currentGeneration: record("existing", 1),
      settings: {
        ...useGenerationStore.getState().settings,
        firstRunCompleted: true,
        modelVariant: "turbo",
        downloadedModels: ["turbo"],
      },
    });

    const run = useGenerationStore.getState().runGeneration();
    await vi.advanceTimersByTimeAsync(1450);
    await run;

    const state = useGenerationStore.getState();
    expect(state.generationState.status).toBe("failed");
    expect(state.history.map((item) => item.id)).toEqual(["existing"]);
    expect(state.currentGeneration?.id).toBe("existing");
  });
});
