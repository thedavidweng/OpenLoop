import { describe, expect, it } from "vitest";
import type { GenerationRecord } from "@/app/lib/types";
import {
  mergeGenerationRecords,
  nextCurrentGenerationAfterDelete,
  recordToGenerationForm,
} from "@/app/lib/history-workflow";
import { DEFAULT_GENERATION_FORM_VALUES } from "@/app/lib/validation";

function record(
  id: string,
  overrides: Partial<GenerationRecord> = {},
): GenerationRecord {
  return {
    id,
    createdAt: `2026-04-29T00:00:00Z`,
    prompt: "ambient piano",
    lyrics: "",
    vocalLanguage: "en",
    durationSeconds: 30,
    bpm: undefined,
    keyScale: undefined,
    timeSignature: "4",
    model: "acestep-v15-turbo",
    taskType: "text2music",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: true,
    inferenceSteps: 8,
    guidanceScale: 7,
    useFormat: false,
    useCotCaption: true,
    useCotLanguage: true,
    constrainedDecoding: true,
    useRandomSeed: true,
    seed: undefined,
    audioFormat: "wav",
    isFavorite: false,
    outputPath: `/tmp/${id}.wav`,
    status: "completed",
    errorMessage: null,
    ...overrides,
  };
}

describe("history workflow", () => {
  it("maps a history record to reproduce settings with a fixed seed", () => {
    const form = recordToGenerationForm(
      DEFAULT_GENERATION_FORM_VALUES,
      record("seeded", {
        bpm: 124,
        keyScale: "C Major",
        seed: 7788,
        useRandomSeed: true,
      }),
      "reproduce",
    );

    expect(form.bpmMode).toBe("manual");
    expect(form.bpm).toBe("124");
    expect(form.keyScale).toBe("C Major");
    expect(form.useRandomSeed).toBe(false);
    expect(form.seed).toBe("7788");
  });

  it("merges returned generation records without duplicating existing history", () => {
    const merged = mergeGenerationRecords(
      [record("new-1"), record("new-2")],
      [record("old"), record("new-1")],
    );

    expect(merged.map((item) => item.id)).toEqual(["new-1", "new-2", "old"]);
  });

  it("selects the next current generation after deleting the active record", () => {
    const remaining = [record("next"), record("later")];

    expect(
      nextCurrentGenerationAfterDelete(record("deleted"), "deleted", remaining)
        ?.id,
    ).toBe("next");
    expect(
      nextCurrentGenerationAfterDelete(record("current"), "other", remaining)
        ?.id,
    ).toBe("current");
  });
});
