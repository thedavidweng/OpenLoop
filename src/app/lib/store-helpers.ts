import { tr } from "@/app/lib/i18n";
import type { AppError, GenerationState } from "@/app/lib/types";

export const PREVIEW_DELAY_MS = {
  validating: 350,
  running: 1100,
};

export function createIdleGenerationState(): GenerationState {
  return {
    status: "idle",
    phase: "idle",
    statusMessage: tr("status.ready"),
    error: null,
  };
}

export function createFailedGenerationState(statusMessage: string, error: AppError): GenerationState {
  return {
    status: "failed",
    phase: "failed",
    statusMessage,
    error,
  };
}

export function prependRecentPrompt(list: string[], prompt: string, max = 20): string[] {
  if (!prompt) return list;
  return [prompt, ...list.filter((p) => p !== prompt)].slice(0, max);
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function variationLabel(event: { variationCurrent?: number; variationTotal?: number }) {
  if (!event.variationCurrent || !event.variationTotal || event.variationTotal <= 1) {
    return "";
  }
  return ` ${tr("generation.variationProgress", {
    current: event.variationCurrent,
    total: event.variationTotal,
  })}`;
}
