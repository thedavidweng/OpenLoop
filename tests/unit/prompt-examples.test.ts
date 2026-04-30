import { describe, expect, it } from "vitest";
import { getPromptExampleAt, PROMPT_EXAMPLE_CATEGORIES } from "@/app/lib/prompt-examples";

describe("local prompt examples", () => {
  it("covers the required music categories without network access", () => {
    expect(PROMPT_EXAMPLE_CATEGORIES).toEqual([
      "pop",
      "cinematic",
      "edm",
      "acoustic",
      "ambient",
      "trailer",
    ]);
  });

  it("returns deterministic examples by index", () => {
    expect(getPromptExampleAt(0)).toContain("pop");
    expect(getPromptExampleAt(999)).toBe(getPromptExampleAt(999));
  });
});
