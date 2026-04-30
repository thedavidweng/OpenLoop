import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GenerationRecord,
  GenerationRequest,
  GenerationRunResult,
} from "@/app/lib/types";

const generateMusic =
  vi.fn<(request: GenerationRequest) => Promise<GenerationRunResult>>();

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => true,
  generateMusic: (request: GenerationRequest) => generateMusic(request),
  cancelGeneration: vi.fn(),
  getSettings: vi.fn(),
  listGenerations: vi.fn(),
  getDeviceInfo: vi.fn(),
  listModelCatalog: vi.fn(),
  getModelStatus: vi.fn(),
  listenToGenerationEvents: vi.fn(),
  listenToModelDownloadEvents: vi.fn(),
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
  };
}

describe("generation store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    generateMusic.mockReset();
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
    expect(state.history.map((item) => item.id)).toEqual([
      "variant-1",
      "variant-2",
    ]);
    expect(state.currentGeneration?.id).toBe("variant-2");
    expect(state.generationState.phase).toBe("completed");
  });
});
