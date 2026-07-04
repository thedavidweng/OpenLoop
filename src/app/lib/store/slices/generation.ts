import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { GenerationEvent, GenerationRecord } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import {
  PREVIEW_DELAY_MS,
  createFailedGenerationState,
  createIdleGenerationState,
  prependRecentPrompt,
  sleep,
  variationLabel,
} from "@/app/lib/store-helpers";
import {
  createModelRequiredError,
  createPreviewRuntimeError,
  createValidationError,
  localizeAppError,
} from "@/app/lib/errors";
import { createGenerationRecord, shouldPreviewFail } from "@/app/lib/preview-record";
import { computeValidationState } from "@/app/lib/validation-helpers";
import { shouldMarkBootstrapFailed } from "@/app/lib/model-bootstrap";
import { mergeGenerationRecords } from "@/app/lib/history-workflow";
import { validateGenerationForm } from "@/app/lib/validation";
import { tr } from "@/app/lib/i18n";
import { isModelDownloaded } from "@/app/lib/model-packs";

export function createGenerationSlice(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    generationState: createIdleGenerationState(),
    currentGeneration: null as GenerationRecord | null,
    playbackToggleRequest: 0,
    activeTasks: [],

    applyGenerationEvent: (event: GenerationEvent) => {
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
    },

    runGeneration: async () => {
      const validation = validateGenerationForm(get().form);
      set({
        validationErrors: validation.errors,
        currentRequest: validation.request,
        generationState: {
          status: "validating",
          phase: "validating",
          statusMessage: tr("status.validating"),
          error: null,
        },
      });
      await sleep(PREVIEW_DELAY_MS.validating);

      if (!validation.isValid || validation.request === null) {
        set({
          generationState: createFailedGenerationState(
            tr("status.validationFailed"),
            createValidationError(tr("errors.requestNotReady")),
          ),
        });
        return;
      }

      if (!isModelDownloaded(get().settings, get().settings.modelVariant)) {
        set({
          generationState: createFailedGenerationState(
            tr("status.downloadBeforeGenerating"),
            createModelRequiredError(),
          ),
        });
        return;
      }

      if (api.isTauriRuntime()) {
        try {
          const result = await api.generateMusic(validation.request);
          const persistedRecords = result.records;
          const latestRecord = persistedRecords[persistedRecords.length - 1] ?? null;
          const requestPrompt = validation.request?.prompt ?? "";
          set((state) => ({
            currentGeneration: latestRecord ?? state.currentGeneration,
            history: mergeGenerationRecords(persistedRecords, state.history),
            recentPrompts: prependRecentPrompt(state.recentPrompts, requestPrompt),
            generationState: {
              status: persistedRecords.length === 0 ? "cancelled" : "completed",
              phase: persistedRecords.length === 0 ? "cancelled" : "completed",
              statusMessage:
                persistedRecords.length === 0 ? tr("status.cancelled") : tr("status.completed"),
              error: null,
            },
          }));
          await get().refreshBootstrapStatus();
        } catch (error) {
          const appError = localizeAppError(error);
          set({
            bootstrapStatus: shouldMarkBootstrapFailed(appError.code)
              ? { state: "failed", message: appError.message, error: appError }
              : { state: "ready", message: tr("status.localStackReady") },
            generationState: createFailedGenerationState(tr("status.failed"), appError),
          });
        }
        return;
      }

      set({
        generationState: {
          status: "running",
          phase: "running",
          statusMessage: tr("status.runningPreview"),
          error: null,
        },
      });
      await sleep(PREVIEW_DELAY_MS.running);

      if (shouldPreviewFail(validation.request)) {
        set({
          generationState: createFailedGenerationState(
            tr("status.previewFailedPrompt"),
            createPreviewRuntimeError(),
          ),
        });
        return;
      }

      const completedRecord = createGenerationRecord(validation.request);
      const persistedRecord = api.isTauriRuntime()
        ? await api.insertGeneration(completedRecord)
        : completedRecord;
      const requestPrompt = validation.request.prompt;
      set((state) => ({
        currentGeneration: persistedRecord,
        history: [persistedRecord, ...state.history],
        recentPrompts: prependRecentPrompt(state.recentPrompts, requestPrompt),
        generationState: {
          status: "completed",
          phase: "completed",
          statusMessage: tr("status.previewCompletedShort"),
          error: null,
        },
      }));
    },

    cancelGeneration: async () => {
      if (api.isTauriRuntime()) {
        await api.cancelGeneration();
      }
      set({
        generationState: {
          status: "cancelled",
          phase: "cancelled",
          statusMessage: tr("status.cancelled"),
          error: null,
        },
      });
    },

    enhancePrompt: async () => {
      const validation = validateGenerationForm(get().form);
      set({
        validationErrors: validation.errors,
        currentRequest: validation.request,
      });
      if (!validation.isValid || validation.request === null) {
        const validationError = createValidationError(tr("errors.requestNotReady"));
        set({
          generationState: createFailedGenerationState(
            tr("status.validationFailed"),
            validationError,
          ),
        });
        throw validationError;
      }
      const enhanced = await api.enhancePrompt(validation.request);
      const nextForm = {
        ...get().form,
        prompt: enhanced.prompt || get().form.prompt,
        lyrics: enhanced.lyrics ?? get().form.lyrics,
        bpmMode: enhanced.bpm === undefined ? get().form.bpmMode : "manual",
        bpm: enhanced.bpm === undefined ? get().form.bpm : String(enhanced.bpm),
        keyScale: enhanced.keyScale ?? get().form.keyScale,
        timeSignature: enhanced.timeSignature ?? get().form.timeSignature,
        durationSeconds:
          enhanced.durationSeconds === undefined
            ? get().form.durationSeconds
            : String(enhanced.durationSeconds),
        vocalLanguage: enhanced.vocalLanguage ?? get().form.vocalLanguage,
      };
      set({
        form: nextForm,
        ...computeValidationState(nextForm, { showErrors: false }),
        generationState: createIdleGenerationState(),
      });
    },

    refreshActiveTasks: async () => {
      if (!api.isTauriRuntime()) return;
      const activeTasks = await api.listActiveGenerationTasks();
      set({ activeTasks });
    },

    resumeActiveTask: async (id: string) => {
      set({
        generationState: {
          status: "running",
          phase: "recovering",
          statusMessage: tr("status.recovering"),
          error: null,
        },
      });
      try {
        const record = await api.resumeGenerationTask(id);
        set((state) => ({
          activeTasks: state.activeTasks.filter((task) => task.id !== id),
          currentGeneration: record,
          history: [record, ...state.history.filter((item) => item.id !== record.id)],
          generationState: {
            status: "completed",
            phase: "completed",
            statusMessage: tr("status.completed"),
            error: null,
          },
        }));
      } catch (error) {
        const appError = localizeAppError(error);
        set({
          generationState: createFailedGenerationState(tr("status.recoveryFailed"), appError),
        });
      }
    },

    discardActiveTask: async (id: string) => {
      if (api.isTauriRuntime()) {
        await api.discardActiveGenerationTask(id);
      }
      set((state) => ({
        activeTasks: state.activeTasks.filter((task) => task.id !== id),
      }));
    },

    requestPlaybackToggle: () => {
      set((state) => ({
        playbackToggleRequest: state.playbackToggleRequest + 1,
      }));
    },
  };
}
