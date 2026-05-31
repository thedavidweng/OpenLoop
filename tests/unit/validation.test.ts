import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERATION_FORM_VALUES,
  validateGenerationForm,
} from "@/app/lib/validation";

describe("generation validation defaults", () => {
  it("treats BPM and key as explicit Auto values in a fresh request", () => {
    expect(DEFAULT_GENERATION_FORM_VALUES.bpmMode).toBe("auto");

    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "ambient piano",
      bpmMode: "auto",
      bpm: "120",
      keyScale: "auto",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.bpm).toBeUndefined();
    expect(result.request?.keyScale).toBeUndefined();
  });

  it("uses manual BPM only when the user switches out of Auto", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "tight house groove",
      bpmMode: "manual",
      bpm: "124",
      keyScale: "C Major",
    });

    expect(result.request?.bpm).toBe(124);
    expect(result.request?.keyScale).toBe("C Major");
  });
});

describe("prompt and lyrics validation", () => {
  it("rejects when both prompt and lyrics are empty", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "",
      lyrics: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.prompt).toBeDefined();
    expect(result.errors.lyrics).toBeDefined();
  });

  it("rejects when both prompt and lyrics are whitespace only", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "   ",
      lyrics: "  ",
    });

    expect(result.isValid).toBe(false);
  });

  it("accepts when only lyrics are provided", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "",
      lyrics: "[Verse]\nHello world",
    });

    expect(result.isValid).toBe(true);
  });

  it("accepts when only prompt is provided", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "ambient piano",
      lyrics: "",
    });

    expect(result.isValid).toBe(true);
  });
});

describe("duration validation", () => {
  it("accepts minimum duration of 10 seconds", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      durationSeconds: "10",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.durationSeconds).toBe(10);
  });

  it("accepts maximum duration of 600 seconds", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      durationSeconds: "600",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.durationSeconds).toBe(600);
  });

  it("rejects duration below 10 seconds", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      durationSeconds: "9",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.durationSeconds).toBeDefined();
  });

  it("rejects duration above 600 seconds", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      durationSeconds: "601",
    });

    expect(result.isValid).toBe(false);
  });

  it("rejects non-numeric duration", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      durationSeconds: "abc",
    });

    expect(result.isValid).toBe(false);
  });
});

describe("seed validation", () => {
  it("accepts i32 max seed", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      useRandomSeed: false,
      seed: "2147483647",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.seed).toBe(2147483647);
  });

  it("accepts i32 min seed", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      useRandomSeed: false,
      seed: "-2147483648",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.seed).toBe(-2147483648);
  });

  it("rejects seed above i32 max", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      useRandomSeed: false,
      seed: "2147483648",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.seed).toBeDefined();
  });

  it("skips seed validation when useRandomSeed is true", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      useRandomSeed: true,
      seed: "999999999999",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.seed).toBeUndefined();
  });
});

describe("variation count validation", () => {
  it("accepts 1 to 4 variations", () => {
    for (let v = 1; v <= 4; v++) {
      const result = validateGenerationForm({
        ...DEFAULT_GENERATION_FORM_VALUES,
        prompt: "test",
        variations: v,
      });
      expect(result.isValid).toBe(true);
      expect(result.request?.variationCount).toBe(v);
    }
  });

  it("rejects 0 variations", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      variations: 0,
    });

    expect(result.isValid).toBe(false);
  });

  it("rejects 5 variations", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      variations: 5,
    });

    expect(result.isValid).toBe(false);
  });
});

describe("optional field parsing", () => {
  it("passes through repaintingStart and repaintingEnd when valid", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      repaintingStart: "0.5",
      repaintingEnd: "0.8",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.repaintingStart).toBe(0.5);
    expect(result.request?.repaintingEnd).toBe(0.8);
  });

  it("passes through empty optional fields as undefined", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      repaintingStart: "",
      repaintingEnd: "",
      audioCoverStrength: "",
    });

    expect(result.isValid).toBe(true);
    expect(result.request?.repaintingStart).toBeUndefined();
    expect(result.request?.repaintingEnd).toBeUndefined();
    expect(result.request?.audioCoverStrength).toBeUndefined();
  });

  it("rejects negative repaintingStart", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      repaintingStart: "-0.1",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.repaintingStart).toBeDefined();
  });

  it("rejects audioCoverStrength above 1", () => {
    const result = validateGenerationForm({
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "test",
      audioCoverStrength: "1.5",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.audioCoverStrength).toBeDefined();
  });
});
