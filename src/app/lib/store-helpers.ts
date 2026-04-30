import * as api from "@/app/lib/api";
import i18next from "@/app/lib/i18n";
import {
  MODEL_VARIANTS,
  aggregatePackStatus,
  isModelDownloaded,
  modelNameForVariant,
  packIdForVariant,
} from "@/app/lib/model-packs";
import {
  DEFAULT_GENERATION_FORM_VALUES,
  validateGenerationForm,
} from "@/app/lib/validation";
import type {
  AppError,
  AppSettings,
  DeviceInfo,
  GenerationFormValues,
  GenerationRecord,
  GenerationRequest,
  GenerationState,
  ModelBootstrapStatus,
  ModelStatusSnapshot,
  ModelVariant,
} from "@/app/lib/types";

export const PREVIEW_DELAY_MS = {
  validating: 350,
  running: 1100,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  profile: "standard",
  modelVariant: null,
  downloadedModels: [],
  outputDirectory: null,
  backendPort: 8001,
  defaultDurationSeconds: 30,
  defaultAudioFormat: "wav",
  defaultThinking: true,
  firstRunCompleted: false,
  language: null,
};

export const PROFILE_FORM_PRESETS = {
  "low-memory": {
    model: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: false,
    inferenceSteps: "6",
    guidanceScale: "6.0",
  },
  standard: {
    model: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: true,
    inferenceSteps: "8",
    guidanceScale: "7.0",
  },
  quality: {
    model: "acestep-v15-xl-turbo",
    lmModelPath: "acestep-5Hz-lm-1.7B",
    lmBackend: "mlx",
    thinking: true,
    inferenceSteps: "10",
    guidanceScale: "7.5",
  },
  unsupported: {
    model: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: false,
    inferenceSteps: "6",
    guidanceScale: "6.5",
  },
} satisfies Record<
  AppSettings["profile"],
  Pick<
    GenerationFormValues,
    | "model"
    | "lmModelPath"
    | "lmBackend"
    | "thinking"
    | "inferenceSteps"
    | "guidanceScale"
  >
>;

function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
}

export function createIdleGenerationState(): GenerationState {
  return {
    status: "idle",
    phase: "idle",
    statusMessage: tr("status.ready"),
    error: null,
  };
}

export function createDefaultBootstrapStatus(): ModelBootstrapStatus {
  return {
    state: "pending",
    message: tr("status.setupRequired"),
  };
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function createValidationError(message: string): AppError {
  return {
    code: "VALIDATION_FAILED",
    message,
    details: tr("errors.validationDetails"),
    recoverable: true,
  };
}

export function createPreviewRuntimeError(): AppError {
  return {
    code: "PREVIEW_GENERATION_FAILED",
    message: tr("errors.previewFailed"),
    details: tr("errors.previewFailedDetails"),
    recoverable: true,
  };
}

export function createBootstrapRuntimeError(error: unknown): AppError {
  return {
    code: "BOOTSTRAP_STATUS_FAILED",
    message: tr("errors.bootstrapInspectFailed"),
    details: stringifyUnknownError(error),
    recoverable: true,
  };
}

export function createModelRequiredError(): AppError {
  return {
    code: "MODEL_REQUIRED",
    message: tr("errors.modelRequired"),
    details: tr("errors.modelRequiredDetails"),
    recoverable: true,
  };
}

export function variationLabel(event: {
  variationCurrent?: number;
  variationTotal?: number;
}) {
  if (
    !event.variationCurrent ||
    !event.variationTotal ||
    event.variationTotal <= 1
  ) {
    return "";
  }
  return ` ${tr("generation.variationProgress", {
    current: event.variationCurrent,
    total: event.variationTotal,
  })}`;
}

export function stringifyUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function readStringProperty(value: object, key: string): string | null {
  if (!(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : null;
}

function readBooleanProperty(value: object, key: string): boolean | null {
  if (!(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "boolean" ? property : null;
}

function coerceAppError(error: unknown, fallbackCode: string): AppError {
  if (typeof error === "object" && error !== null) {
    const code = readStringProperty(error, "code") ?? fallbackCode;
    const message = readStringProperty(error, "message");
    const details = readStringProperty(error, "details");
    return {
      code,
      message: message ?? tr("errors.generationFailed"),
      details: details ?? undefined,
      recoverable: readBooleanProperty(error, "recoverable") ?? true,
    };
  }

  return {
    code: fallbackCode,
    message: tr("errors.generationFailed"),
    details: stringifyUnknownError(error),
    recoverable: true,
  };
}

export function localizeAppError(
  error: unknown,
  fallbackCode = "GENERATION_FAILED",
): AppError {
  const coerced = coerceAppError(error, fallbackCode);
  const message = tr(`errors.codes.${coerced.code}.message`, {
    defaultValue: coerced.message,
  });
  const details =
    coerced.details && coerced.details !== coerced.message
      ? tr(`errors.codes.${coerced.code}.details`, {
          defaultValue: coerced.details,
        })
      : undefined;

  return {
    ...coerced,
    message,
    details,
  };
}

export function localizeModelStatuses(
  statuses: ModelStatusSnapshot[],
): ModelStatusSnapshot[] {
  return statuses.map((status) => ({
    ...status,
    error: status.error ? localizeAppError(status.error) : status.error,
  }));
}

export function shouldMarkBootstrapFailed(code: string): boolean {
  return (
    code === "BACKEND_START_FAILED" ||
    code === "BACKEND_HEALTH_TIMEOUT" ||
    code === "MODEL_NOT_FOUND"
  );
}

export function resolveBootstrapStatus(
  settings: AppSettings,
  deviceInfo: DeviceInfo | null,
  statuses: ModelStatusSnapshot[] = [],
): ModelBootstrapStatus {
  if (!settings.firstRunCompleted) {
    return {
      state: "pending",
      message: tr("status.chooseModel"),
    };
  }

  if (!settings.modelVariant) {
    return {
      state: "pending",
      message: tr("status.chooseAndDownload"),
    };
  }

  if (statuses.length > 0) {
    const selectedPackStatus = aggregatePackStatus(
      statuses,
      packIdForVariant(settings.modelVariant),
    );
    if (selectedPackStatus.state === "failed") {
      return {
        state: "failed",
        message:
          selectedPackStatus.error?.message ??
          tr("errors.codes.MODEL_DOWNLOAD_FAILED.message"),
        error: selectedPackStatus.error,
      };
    }
    if (selectedPackStatus.state === "downloading") {
      return {
        state: "downloading",
        message: tr("status.downloadingModel", {
          model: selectedPackStatus.label,
        }),
        downloadedBytes: selectedPackStatus.downloadedBytes,
        totalBytes: selectedPackStatus.totalBytes,
      };
    }
  }

  if (!isModelDownloaded(settings, settings.modelVariant)) {
    return {
      state: "pending",
      message: tr("status.downloadModelToStart", {
        model: MODEL_VARIANTS[settings.modelVariant].label,
      }),
    };
  }

  if (
    deviceInfo?.recommendedProfile === "unsupported" ||
    settings.profile === "unsupported"
  ) {
    return {
      state: "experimental",
      message: tr("status.experimentalMac"),
    };
  }

  if (!api.isTauriRuntime()) {
    return {
      state: "ready",
      message: tr("status.modelReadyPreview", {
        model: MODEL_VARIANTS[settings.modelVariant].label,
      }),
    };
  }

  return {
    state: "ready",
    message: tr("status.modelReady", {
      model: MODEL_VARIANTS[settings.modelVariant].label,
    }),
  };
}

export function shouldPreviewFail(request: GenerationRequest) {
  const haystack = `${request.prompt} ${request.lyrics}`.toLowerCase();
  return haystack.includes("fail");
}

export function createGenerationRecord(
  request: GenerationRequest,
  status: GenerationRecord["status"],
  errorMessage: string | null,
): GenerationRecord {
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
    outputPath:
      status === "completed"
        ? `/preview-output/${id}.${request.audioFormat}`
        : null,
    status,
    errorMessage,
    generationInfo:
      status === "completed"
        ? tr("status.previewCompleted")
        : tr("status.previewFailed"),
  };
}

export function computeValidationState(
  form: GenerationFormValues,
  options: { showErrors?: boolean } = {},
) {
  const result = validateGenerationForm(form);
  return {
    validationErrors: options.showErrors === false ? {} : result.errors,
    currentRequest: result.request,
  };
}

export function applyProfilePreset(
  form: GenerationFormValues,
  profile: AppSettings["profile"],
) {
  const preset = PROFILE_FORM_PRESETS[profile];
  return {
    ...form,
    model: preset.model,
    lmModelPath: preset.lmModelPath,
    lmBackend: preset.lmBackend,
    thinking: preset.thinking,
    inferenceSteps: preset.inferenceSteps,
    guidanceScale: preset.guidanceScale,
  };
}

export function applyModelVariantToForm(
  form: GenerationFormValues,
  variant: ModelVariant | null,
) {
  if (!variant) {
    return form;
  }
  return {
    ...form,
    model: modelNameForVariant(variant),
  };
}

export const INITIAL_CURRENT_REQUEST = validateGenerationForm(
  DEFAULT_GENERATION_FORM_VALUES,
).request;
