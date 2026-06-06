import i18next from "@/app/lib/i18n";
import type { GenerationRecord, GenerationRequest } from "@/app/lib/types";

function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
}

export function shouldPreviewFail(request: GenerationRequest) {
  const haystack = `${request.prompt} ${request.lyrics}`.toLowerCase();
  return haystack.includes("fail");
}

export function createGenerationRecord(request: GenerationRequest): GenerationRecord {
  const id = globalThis.crypto.randomUUID();
  const createdAt = new Date().toISOString();
  return {
    id,
    createdAt,
    prompt: request.prompt,
    negativePrompt: request.negativePrompt,
    lyrics: request.lyrics,
    vocalLanguage: request.vocalLanguage,
    durationSeconds: request.durationSeconds,
    bpm: request.bpm,
    keyScale: request.keyScale,
    timeSignature: request.timeSignature,
    model: request.model,
    taskType: request.taskType,
    lmModelPath: request.lmModelPath,
    lmBackend: request.lmBackend,
    thinking: request.thinking,
    inferenceSteps: request.inferenceSteps,
    guidanceScale: request.guidanceScale,
    useFormat: request.useFormat,
    useCotCaption: request.useCotCaption,
    useCotLanguage: request.useCotLanguage,
    constrainedDecoding: request.constrainedDecoding,
    referenceAudioPath: request.referenceAudioPath,
    srcAudioPath: request.srcAudioPath,
    instruction: request.instruction,
    repaintingStart: request.repaintingStart,
    repaintingEnd: request.repaintingEnd,
    audioCoverStrength: request.audioCoverStrength,
    useRandomSeed: request.useRandomSeed,
    seed: request.seed,
    audioFormat: request.audioFormat,
    isFavorite: false,
    outputPath: `/preview-output/${id}.${request.audioFormat}`,
    status: "completed",
    errorMessage: null,
    generationInfo: tr("status.previewCompleted"),
  };
}
