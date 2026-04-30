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
