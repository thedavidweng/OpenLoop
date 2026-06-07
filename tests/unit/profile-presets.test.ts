import { describe, expect, it } from "vitest";
import type { GenerationFormValues } from "@/app/lib/types";
import {
  PROFILE_FORM_PRESETS,
  applyProfilePreset,
  applyModelVariantToForm,
} from "@/app/lib/profile-presets";

const BASE_FORM: GenerationFormValues = {
  prompt: "test prompt",
  negativePrompt: "",
  lyrics: "",
  vocalLanguage: "en",
  durationSeconds: "60",
  bpmMode: "auto",
  bpm: "120",
  keyScale: "auto",
  timeSignature: "4",
  audioFormat: "wav",
  model: "",
  taskType: "text2music",
  lmModelPath: "",
  lmBackend: "mlx",
  thinking: false,
  inferenceSteps: "8",
  guidanceScale: "7.0",
  useFormat: false,
  useCotCaption: false,
  useCotLanguage: false,
  constrainedDecoding: false,
  referenceAudioPath: "",
  srcAudioPath: "",
  instruction: "",
  repaintingStart: "",
  repaintingEnd: "",
  audioCoverStrength: "",
  useRandomSeed: true,
  seed: "",
  instrumental: false,
  variations: 1,
};

describe("PROFILE_FORM_PRESETS", () => {
  it("contains entries for all four profiles", () => {
    expect(PROFILE_FORM_PRESETS).toHaveProperty("low-memory");
    expect(PROFILE_FORM_PRESETS).toHaveProperty("standard");
    expect(PROFILE_FORM_PRESETS).toHaveProperty("quality");
    expect(PROFILE_FORM_PRESETS).toHaveProperty("unsupported");
  });

  it("sets correct model for each profile", () => {
    expect(PROFILE_FORM_PRESETS["low-memory"].model).toBe("acestep-v15-turbo");
    expect(PROFILE_FORM_PRESETS["standard"].model).toBe("acestep-v15-turbo");
    expect(PROFILE_FORM_PRESETS["quality"].model).toBe("acestep-v15-xl-turbo");
  });

  it("sets thinking=false for low-memory and unsupported", () => {
    expect(PROFILE_FORM_PRESETS["low-memory"].thinking).toBe(false);
    expect(PROFILE_FORM_PRESETS["unsupported"].thinking).toBe(false);
  });

  it("sets thinking=true for standard and quality", () => {
    expect(PROFILE_FORM_PRESETS["standard"].thinking).toBe(true);
    expect(PROFILE_FORM_PRESETS["quality"].thinking).toBe(true);
  });

  it("uses higher inferenceSteps for quality than low-memory", () => {
    const quality = Number(PROFILE_FORM_PRESETS["quality"].inferenceSteps);
    const lowMem = Number(PROFILE_FORM_PRESETS["low-memory"].inferenceSteps);
    expect(quality).toBeGreaterThan(lowMem);
  });
});

describe("applyProfilePreset", () => {
  it("overrides preset fields while preserving non-preset fields", () => {
    const result = applyProfilePreset(BASE_FORM, "standard");
    expect(result.prompt).toBe("test prompt");
    expect(result.model).toBe("acestep-v15-turbo");
    expect(result.thinking).toBe(true);
    expect(result.constrainedDecoding).toBe(true);
  });

  it("applies low-memory preset values", () => {
    const result = applyProfilePreset(BASE_FORM, "low-memory");
    expect(result.model).toBe("acestep-v15-turbo");
    expect(result.lmModelPath).toBe("acestep-5Hz-lm-0.6B");
    expect(result.thinking).toBe(false);
    expect(result.inferenceSteps).toBe("6");
  });

  it("applies quality preset values", () => {
    const result = applyProfilePreset(BASE_FORM, "quality");
    expect(result.model).toBe("acestep-v15-xl-turbo");
    expect(result.lmModelPath).toBe("acestep-5Hz-lm-1.7B");
    expect(result.guidanceScale).toBe("7.5");
  });

  it("returns a new object, not mutating the original", () => {
    const original = { ...BASE_FORM };
    applyProfilePreset(BASE_FORM, "quality");
    expect(BASE_FORM).toEqual(original);
  });
});

describe("applyModelVariantToForm", () => {
  it("returns form unchanged when variant is null", () => {
    const result = applyModelVariantToForm(BASE_FORM, null);
    expect(result).toBe(BASE_FORM);
  });

  it("sets model name for turbo variant", () => {
    const result = applyModelVariantToForm(BASE_FORM, "turbo");
    expect(result.model).toBe("acestep-v15-turbo");
    expect(result.prompt).toBe("test prompt");
  });

  it("sets model name for pro variant", () => {
    const result = applyModelVariantToForm(BASE_FORM, "pro");
    expect(result.model).toBe("acestep-v15-xl-turbo");
  });

  it("sets model name for lite variant", () => {
    const result = applyModelVariantToForm(BASE_FORM, "lite");
    expect(result.model).toBe("acestep-v15-turbo");
  });

  it("returns a new object when variant is provided", () => {
    const result = applyModelVariantToForm(BASE_FORM, "turbo");
    expect(result).not.toBe(BASE_FORM);
  });
});
