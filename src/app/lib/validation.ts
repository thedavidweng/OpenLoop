import type {
  GenerationFormValues,
  GenerationRequest,
  ValidationErrors,
  ValidationResult,
} from "@/app/lib/types";
import i18next from "@/app/lib/i18n";

const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 600;
const MIN_BPM = 30;
const MAX_BPM = 300;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const MIN_VARIATIONS = 1;
const MAX_VARIATIONS = 4;

export const DEFAULT_GENERATION_FORM_VALUES: GenerationFormValues = {
  prompt: "",
  negativePrompt: "",
  lyrics: "",
  vocalLanguage: "en",
  durationSeconds: "30",
  bpmMode: "auto",
  bpm: "",
  keyScale: "auto",
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
  instrumental: false,
  variations: 1,
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

function validationMessage(key: string) {
  return i18next.t(`validation.${key}`);
}

export function validateGenerationForm(
  form: GenerationFormValues,
): ValidationResult {
  const errors: ValidationErrors = {};

  const prompt = form.prompt.trim();
  const lyrics = form.lyrics.trim();

  if (!prompt && !lyrics) {
    const message = validationMessage("promptOrLyrics");
    errors.prompt = message;
    errors.lyrics = message;
  }

  const durationSeconds = parseRequiredNumber(form.durationSeconds);
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < MIN_DURATION_SECONDS ||
    durationSeconds > MAX_DURATION_SECONDS
  ) {
    errors.durationSeconds = validationMessage("duration");
  }

  const bpm = form.bpmMode === "manual" ? parseOptionalInteger(form.bpm) : null;
  if (
    form.bpmMode === "manual" &&
    bpm !== null &&
    (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM)
  ) {
    errors.bpm = validationMessage("bpm");
  }

  const parsedInferenceSteps = parseOptionalInteger(form.inferenceSteps);
  if (
    parsedInferenceSteps === null ||
    !Number.isFinite(parsedInferenceSteps) ||
    parsedInferenceSteps <= 0
  ) {
    errors.inferenceSteps = validationMessage("inferenceSteps");
  }

  const guidanceScale = parseRequiredNumber(form.guidanceScale);
  if (!Number.isFinite(guidanceScale) || guidanceScale <= 0) {
    errors.guidanceScale = validationMessage("guidanceScale");
  }

  const repaintingStart = parseOptionalNumber(form.repaintingStart);
  if (
    Number.isNaN(repaintingStart) ||
    (repaintingStart !== null && repaintingStart < 0)
  ) {
    errors.repaintingStart = validationMessage("repaintingStart");
  }

  const repaintingEnd = parseOptionalNumber(form.repaintingEnd);
  if (
    Number.isNaN(repaintingEnd) ||
    (repaintingEnd !== null && repaintingEnd < -1)
  ) {
    errors.repaintingEnd = validationMessage("repaintingEnd");
  }

  const audioCoverStrength = parseOptionalNumber(form.audioCoverStrength);
  if (
    Number.isNaN(audioCoverStrength) ||
    (audioCoverStrength !== null &&
      (audioCoverStrength < 0 || audioCoverStrength > 1))
  ) {
    errors.audioCoverStrength = validationMessage("audioCoverStrength");
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
      errors.seed = validationMessage("seed");
    } else if (parsedSeed !== null) {
      seed = parsedSeed;
    }
  }

  if (
    !Number.isInteger(form.variations) ||
    form.variations < MIN_VARIATIONS ||
    form.variations > MAX_VARIATIONS
  ) {
    errors.prompt = validationMessage("variations");
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
    keyScale:
      form.keyScale === "auto" ? undefined : trimOptional(form.keyScale),
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
    variationCount: form.variations,
  };

  return {
    isValid: true,
    request,
    errors: {},
  };
}
