import promptExamples from "@/app/data/prompt_examples.json";

export type PromptExample = {
  category: string;
  prompt: string;
};

const examples = promptExamples as PromptExample[];

export const PROMPT_CATEGORIES = [
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
] as const;

export const PROMPT_EXAMPLE_CATEGORIES = PROMPT_CATEGORIES;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export function getPromptExampleAt(index: number): string {
  if (examples.length === 0) {
    return "";
  }
  const normalized = Math.abs(Math.trunc(index)) % examples.length;
  return examples[normalized].prompt;
}

export function getRandomPromptExample(random = Math.random): string {
  return getPromptExampleAt(Math.floor(random() * examples.length));
}

export function getPromptsByCategory(category: string): PromptExample[] {
  return examples.filter((e) => e.category === category);
}

export function getRandomPromptByCategory(category: string, random = Math.random): string {
  const catExamples = getPromptsByCategory(category);
  if (catExamples.length === 0) {
    return getRandomPromptExample(random);
  }
  const index = Math.floor(random() * catExamples.length);
  return catExamples[index].prompt;
}
