import { describe, expect, it } from "vitest";
import {
  getPromptExampleAt,
  getRandomPromptExample,
  PROMPT_CATEGORIES,
  PROMPT_EXAMPLE_CATEGORIES,
  getPromptsByCategory,
  getRandomPromptByCategory,
} from "@/app/lib/prompt-examples";

const EXAMPLES_PER_CATEGORY = 10;
const TOTAL_EXAMPLES = PROMPT_CATEGORIES.length * EXAMPLES_PER_CATEGORY;

describe("PROMPT_CATEGORIES", () => {
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

  it("exposes PROMPT_EXAMPLE_CATEGORIES as an alias", () => {
    expect(PROMPT_EXAMPLE_CATEGORIES).toBe(PROMPT_CATEGORIES);
  });
});

describe("getPromptExampleAt", () => {
  it("returns a non-empty string for index 0", () => {
    const example = getPromptExampleAt(0);
    expect(typeof example).toBe("string");
    expect(example.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same index", () => {
    expect(getPromptExampleAt(999)).toBe(getPromptExampleAt(999));
  });

  it("wraps large indices via modular arithmetic", () => {
    expect(getPromptExampleAt(0)).toBe(getPromptExampleAt(TOTAL_EXAMPLES));
    expect(getPromptExampleAt(1)).toBe(getPromptExampleAt(TOTAL_EXAMPLES + 1));
  });

  it("treats negative indices as positive via Math.abs", () => {
    expect(getPromptExampleAt(-0)).toBe(getPromptExampleAt(0));
    expect(getPromptExampleAt(-1)).toBe(getPromptExampleAt(1));
    expect(getPromptExampleAt(-(TOTAL_EXAMPLES + 5))).toBe(getPromptExampleAt(5));
  });

  it("truncates fractional indices", () => {
    expect(getPromptExampleAt(2.9)).toBe(getPromptExampleAt(2));
    expect(getPromptExampleAt(0.1)).toBe(getPromptExampleAt(0));
  });

  it("returns a prompt string for every valid index", () => {
    for (let i = 0; i < TOTAL_EXAMPLES; i++) {
      const prompt = getPromptExampleAt(i);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("getRandomPromptExample", () => {
  it("uses the provided random function to select an example", () => {
    // random() = 0 should give the first example (index 0)
    const first = getRandomPromptExample(() => 0);
    expect(first).toBe(getPromptExampleAt(0));
  });

  it("selects the last example when random is close to 1", () => {
    // random() just below 1 maps to the last index
    const fakeRandom = () => 0.9999;
    const last = getRandomPromptExample(fakeRandom);
    expect(last).toBe(getPromptExampleAt(TOTAL_EXAMPLES - 1));
  });

  it("returns a non-empty string with default Math.random", () => {
    const result = getRandomPromptExample();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getPromptsByCategory", () => {
  it("filters examples by category", () => {
    const popExamples = getPromptsByCategory("pop");
    expect(popExamples.length).toBe(10);
    expect(popExamples.every((e) => e.category === "pop")).toBe(true);
  });

  it("returns an empty array for a non-existent category", () => {
    expect(getPromptsByCategory("nonexistent")).toEqual([]);
  });

  it("returns all category prompts with correct types", () => {
    for (const category of PROMPT_CATEGORIES) {
      const examples = getPromptsByCategory(category);
      expect(examples.length).toBe(10);
      for (const ex of examples) {
        expect(ex).toHaveProperty("category", category);
        expect(ex).toHaveProperty("prompt");
        expect(typeof ex.prompt).toBe("string");
        expect(ex.prompt.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getRandomPromptByCategory", () => {
  it("selects from the given category using the provided random", () => {
    const catExamples = getPromptsByCategory("jazz");
    const prompt = getRandomPromptByCategory("jazz", () => 0);
    expect(prompt).toBe(catExamples[0].prompt);
  });

  it("selects the last item in the category when random is close to 1", () => {
    const catExamples = getPromptsByCategory("edm");
    const prompt = getRandomPromptByCategory("edm", () => 0.9999);
    expect(prompt).toBe(catExamples[catExamples.length - 1].prompt);
  });

  it("falls back to a global random example for an unknown category", () => {
    const fallback = getRandomPromptExample(() => 0);
    const result = getRandomPromptByCategory("nonexistent", () => 0);
    expect(result).toBe(fallback);
  });

  it("returns a non-empty string with default Math.random", () => {
    const result = getRandomPromptByCategory("ambient");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
