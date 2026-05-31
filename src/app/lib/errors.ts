import i18next from "@/app/lib/i18n";
import type { AppError, ModelStatusSnapshot } from "@/app/lib/types";

function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
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

export function createModelRequiredError(): AppError {
  return {
    code: "MODEL_REQUIRED",
    message: tr("errors.modelRequired"),
    details: tr("errors.modelRequiredDetails"),
    recoverable: true,
  };
}
