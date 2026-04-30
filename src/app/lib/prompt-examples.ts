import promptExamples from "@/app/data/prompt_examples.json";

type PromptExample = {
  category: string;
  prompt: string;
};

const examples = promptExamples as PromptExample[];

export const PROMPT_EXAMPLE_CATEGORIES = [
  "pop",
  "cinematic",
  "edm",
  "acoustic",
  "ambient",
  "trailer",
] as const;

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
