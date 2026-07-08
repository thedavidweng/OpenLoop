import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { GenerationEvent } from "@/app/lib/types";
import { createFailedGenerationState, variationLabel } from "@/app/lib/store-helpers";
import { localizeAppError } from "@/app/lib/errors";
import { shouldMarkBootstrapFailed } from "@/app/lib/model-bootstrap";
import { tr } from "@/app/lib/i18n";

/**
 * Apply a generation lifecycle event to the store. Extracted from the
 * generation slice so the slice file stays focused on action orchestration
 * (run, cancel, enhance) rather than event-to-state mapping.
 */
export function applyGenerationEvent(
  event: GenerationEvent,
  set: StoreApi<GenerationStore>["setState"],
) {
  switch (event.type) {
    case "backend_starting":
      set({
        bootstrapStatus: {
          state: "downloading",
          message: tr("status.preparingBackend"),
        },
        generationState: {
          status: "running",
          phase: "backend_starting",
          statusMessage: `${tr("status.startingBackend")}${variationLabel(event)}`,
          error: null,
          variationCurrent: event.variationCurrent,
          variationTotal: event.variationTotal,
        },
      });
      break;
    case "submitted":
      set({
        generationState: {
          status: "running",
          phase: "submitted",
          statusMessage: `${tr("status.submittedTask", { taskId: event.taskId })}${variationLabel(event)}`,
          error: null,
          taskId: event.taskId,
          variationCurrent: event.variationCurrent,
          variationTotal: event.variationTotal,
        },
      });
      break;
    case "queued":
      set({
        generationState: {
          status: "running",
          phase: "queued",
          statusMessage: `${tr("status.queued")}${variationLabel(event)}`,
          error: null,
          variationCurrent: event.variationCurrent,
          variationTotal: event.variationTotal,
        },
      });
      break;
    case "running":
      set({
        generationState: {
          status: "running",
          phase: "running",
          statusMessage: `${tr("status.running")}${variationLabel(event)}`,
          error: null,
          variationCurrent: event.variationCurrent,
          variationTotal: event.variationTotal,
          progressPercent: event.progressPercent,
        },
      });
      break;
    case "downloading":
      set({
        generationState: {
          status: "running",
          phase: "downloading",
          statusMessage: `${tr("status.downloadingAudio")}${variationLabel(event)}`,
          error: null,
          variationCurrent: event.variationCurrent,
          variationTotal: event.variationTotal,
        },
      });
      break;
    case "completed":
      set({
        bootstrapStatus: {
          state: "ready",
          message: tr("status.localStackReady"),
        },
        generationState: {
          status: "completed",
          phase: "completed",
          statusMessage: tr("status.completed"),
          error: null,
          variationCurrent: event.variationCurrent,
          variationTotal: event.variationTotal,
        },
      });
      break;
    case "cancelled":
      set({
        generationState: {
          status: "cancelled",
          phase: "cancelled",
          statusMessage: tr("status.cancelled"),
          error: null,
          variationCurrent: event.variationCurrent,
          variationTotal: event.variationTotal,
        },
      });
      break;
    case "failed": {
      const error = localizeAppError(event.error);
      set({
        bootstrapStatus: shouldMarkBootstrapFailed(error.code)
          ? { state: "failed", message: error.message, error }
          : { state: "ready", message: tr("status.localStackReady") },
        generationState: createFailedGenerationState(tr("status.failed"), error),
      });
      break;
    }
  }
}
