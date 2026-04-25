import type {
  GenerationFormValues,
  GenerationRequest,
  ValidationErrors,
  ValidationResult,
} from "@/app/lib/types";

const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 600;
const MIN_BPM = 30;
const MAX_BPM = 300;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

export const DEFAULT_GENERATION_FORM_VALUES: GenerationFormValues = {
  prompt: "",
  negativePrompt: "",
  lyrics: "",
  vocalLanguage: "en",
  durationSeconds: "30",
  bpm: "",
  keyScale: "",
  timeSignature: "4",
  audioFormat: "wav",
  model: "acestep-v15-turbo",
  taskType: "text2music",
  lmModelPath: "acestep-5Hz-lm-0.6B",
  lmBackend: "mlx",
  thinking: true,
  inferenceSteps: "8",
  guidanceScale: "7.0",
  useFormat: false,
  useCotCaption: true,
  useCotLanguage: true,
  constrainedDecoding: true,
  referenceAudioPath: "",
  srcAudioPath: "",
  instruction: "",
  repaintingStart: "",
  repaintingEnd: "",
  audioCoverStrength: "1.0",
  useRandomSeed: true,
  seed: "",
};

function parseOptionalInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return Number.NaN;
  }

  return Number.parseInt(trimmed, 10);
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseRequiredNumber(value: string): number {
  return Number.parseFloat(value.trim());
}

function trimOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function validateGenerationForm(
  form: GenerationFormValues,
): ValidationResult {
  const errors: ValidationErrors = {};

  const prompt = form.prompt.trim();
  const lyrics = form.lyrics.trim();

  if (!prompt && !lyrics) {
    const message = "Enter a prompt, lyrics, or both.";
    errors.prompt = message;
    errors.lyrics = message;
  }

  const durationSeconds = parseRequiredNumber(form.durationSeconds);
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < MIN_DURATION_SECONDS ||
    durationSeconds > MAX_DURATION_SECONDS
  ) {
    errors.durationSeconds = "Duration must be between 10 and 600 seconds.";
  }

  const bpm = parseOptionalInteger(form.bpm);
  if (
    bpm !== null &&
    (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM)
  ) {
    errors.bpm = "BPM must be empty or between 30 and 300.";
  }

  const parsedInferenceSteps = parseOptionalInteger(form.inferenceSteps);
  if (
    parsedInferenceSteps === null ||
    !Number.isFinite(parsedInferenceSteps) ||
    parsedInferenceSteps <= 0
  ) {
    errors.inferenceSteps = "Inference steps must be a positive integer.";
  }

  const guidanceScale = parseRequiredNumber(form.guidanceScale);
  if (!Number.isFinite(guidanceScale) || guidanceScale <= 0) {
    errors.guidanceScale = "Guidance scale must be a positive number.";
  }

  const repaintingStart = parseOptionalNumber(form.repaintingStart);
  if (Number.isNaN(repaintingStart) || (repaintingStart !== null && repaintingStart < 0)) {
    errors.repaintingStart = "Repaint start must be empty or zero and above.";
  }

  const repaintingEnd = parseOptionalNumber(form.repaintingEnd);
  if (Number.isNaN(repaintingEnd) || (repaintingEnd !== null && repaintingEnd < -1)) {
    errors.repaintingEnd = "Repaint end must be empty, -1, or zero and above.";
  }

  const audioCoverStrength = parseOptionalNumber(form.audioCoverStrength);
  if (
    Number.isNaN(audioCoverStrength) ||
    (audioCoverStrength !== null && (audioCoverStrength < 0 || audioCoverStrength > 1))
  ) {
    errors.audioCoverStrength = "Cover strength must be empty or between 0 and 1.";
  }

  let seed: number | undefined;
  if (!form.useRandomSeed) {
    const parsedSeed = parseOptionalInteger(form.seed);
    if (
      parsedSeed !== null &&
      (!Number.isFinite(parsedSeed) ||
        parsedSeed < INT32_MIN ||
        parsedSeed > INT32_MAX)
    ) {
      errors.seed = "Seed must be a valid 32-bit integer.";
    } else if (parsedSeed !== null) {
      seed = parsedSeed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      request: null,
      errors,
    };
  }

  const inferenceSteps = parsedInferenceSteps ?? 1;

  const request: GenerationRequest = {
    prompt,
    negativePrompt: trimOptional(form.negativePrompt),
    lyrics,
    vocalLanguage: form.vocalLanguage.trim() || "en",
    durationSeconds,
    bpm: bpm ?? undefined,
    keyScale: trimOptional(form.keyScale),
    timeSignature: form.timeSignature,
    audioFormat: form.audioFormat,
    model: trimOptional(form.model),
    taskType: form.taskType,
    lmModelPath: trimOptional(form.lmModelPath),
    lmBackend: form.lmBackend,
    thinking: form.thinking,
    inferenceSteps,
    guidanceScale,
    useFormat: form.useFormat,
    useCotCaption: form.useCotCaption,
    useCotLanguage: form.useCotLanguage,
    constrainedDecoding: form.constrainedDecoding,
    referenceAudioPath: trimOptional(form.referenceAudioPath),
    srcAudioPath: trimOptional(form.srcAudioPath),
    instruction: trimOptional(form.instruction),
    repaintingStart: repaintingStart ?? undefined,
    repaintingEnd: repaintingEnd ?? undefined,
    audioCoverStrength: audioCoverStrength ?? undefined,
    useRandomSeed: form.useRandomSeed,
    seed,
  };

  return {
    isValid: true,
    request,
    errors: {},
  };
}
