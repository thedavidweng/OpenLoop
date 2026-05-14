import { describe, expect, it } from "vitest";
import {
  getPromptExampleAt,
  PROMPT_CATEGORIES,
  getPromptsByCategory,
} from "@/app/lib/prompt-examples";

describe("local prompt examples", () => {
  it("covers the required music categories without network access", () => {
    expect(PROMPT_CATEGORIES).toEqual([
      "pop",
      "cinematic",
      "edm",
      "acoustic",
      "ambient",
      "trailer",
      "lo-fi",
      "jazz",
      "orchestral",
      "game-bgm",
      "rnb",
    ]);
  });

  it("returns deterministic examples by index", () => {
    const example = getPromptExampleAt(0);
    expect(typeof example).toBe("string");
    expect(example.length).toBeGreaterThan(0);
    expect(getPromptExampleAt(999)).toBe(getPromptExampleAt(999));
  });

  it("filters examples by category", () => {
    const popExamples = getPromptsByCategory("pop");
    expect(popExamples.length).toBeGreaterThan(0);
    expect(popExamples.every((e) => e.category === "pop")).toBe(true);
  });
});
