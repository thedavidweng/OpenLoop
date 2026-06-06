import { DEFAULT_GENERATION_FORM_VALUES, validateGenerationForm } from "@/app/lib/validation";
import type { GenerationFormValues, GenerationRecord, GenerationRequest } from "@/app/lib/types";

export function mergeGenerationRecords(
  incoming: GenerationRecord[],
  existing: GenerationRecord[],
): GenerationRecord[] {
  return [
    ...incoming,
    ...existing.filter((record) => !incoming.some((persisted) => persisted.id === record.id)),
  ];
}

export function nextCurrentGenerationAfterDelete(
  currentGeneration: GenerationRecord | null,
  deletedId: string,
  remainingHistory: GenerationRecord[],
): GenerationRecord | null {
  return currentGeneration?.id === deletedId ? (remainingHistory[0] ?? null) : currentGeneration;
}

export function recordToGenerationForm(
  currentForm: GenerationFormValues,
  record: GenerationRecord,
  mode: "settings" | "reproduce",
): GenerationFormValues {
  return {
    ...currentForm,
    prompt: record.prompt,
    negativePrompt: record.negativePrompt ?? "",
    lyrics: record.lyrics,
    vocalLanguage: record.vocalLanguage,
    durationSeconds: String(Math.round(record.durationSeconds)),
    bpmMode: record.bpm === undefined ? "auto" : "manual",
    bpm: record.bpm === undefined ? "" : String(record.bpm),
    keyScale: record.keyScale ?? "auto",
    timeSignature: record.timeSignature,
    audioFormat: record.audioFormat,
    model: record.model ?? currentForm.model,
    taskType: record.taskType ?? "text2music",
    lmModelPath: record.lmModelPath ?? "",
    lmBackend: record.lmBackend ?? "mlx",
    thinking: record.thinking,
    inferenceSteps: String(record.inferenceSteps),
    guidanceScale: String(record.guidanceScale),
    useFormat: record.useFormat ?? false,
    useCotCaption: record.useCotCaption ?? true,
    useCotLanguage: record.useCotLanguage ?? true,
    constrainedDecoding: record.constrainedDecoding ?? true,
    referenceAudioPath: record.referenceAudioPath ?? "",
    srcAudioPath: record.srcAudioPath ?? "",
    instruction: record.instruction ?? "",
    repaintingStart: record.repaintingStart === undefined ? "" : String(record.repaintingStart),
    repaintingEnd: record.repaintingEnd === undefined ? "" : String(record.repaintingEnd),
    audioCoverStrength:
      record.audioCoverStrength === undefined ? "1.0" : String(record.audioCoverStrength),
    useRandomSeed: mode === "reproduce" ? false : record.useRandomSeed,
    seed:
      mode === "reproduce" && record.seed !== undefined
        ? String(record.seed)
        : record.useRandomSeed
          ? ""
          : (record.seed?.toString() ?? ""),
  };
}

export const INITIAL_CURRENT_REQUEST: GenerationRequest | null = validateGenerationForm(
  DEFAULT_GENERATION_FORM_VALUES,
).request;
