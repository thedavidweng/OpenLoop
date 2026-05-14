import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { GenerationEvent, GenerationRecord } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import {
  PREVIEW_DELAY_MS,
  computeValidationState,
  createGenerationRecord,
  createIdleGenerationState,
  createModelRequiredError,
  createPreviewRuntimeError,
  createValidationError,
  localizeAppError,
  shouldPreviewFail,
  sleep,
  variationLabel,
} from "@/app/lib/store-helpers";
import {
  shouldMarkBootstrapFailed,
} from "@/app/lib/model-bootstrap";
import {
  mergeGenerationRecords,
  recordToGenerationForm,
} from "@/app/lib/history-workflow";
import { validateGenerationForm } from "@/app/lib/validation";
import i18next from "@/app/lib/i18n";
import { isModelDownloaded } from "@/app/lib/model-packs";

function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
}

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
            bootstrapStatus: { state: "downloading", message: tr("status.preparingBackend") },
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
            bootstrapStatus: { state: "ready", message: tr("status.localStackReady") },
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
            generationState: {
              status: "failed",
              phase: "failed",
              statusMessage: tr("status.failed"),
              error,
            },
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
          generationState: {
            status: "failed",
            phase: "failed",
            statusMessage: tr("status.validationFailed"),
            error: createValidationError(tr("errors.requestNotReady")),
          },
        });
        return;
      }

      if (!isModelDownloaded(get().settings, get().settings.modelVariant)) {
        set({
          generationState: {
            status: "failed",
            phase: "failed",
            statusMessage: tr("status.downloadBeforeGenerating"),
            error: createModelRequiredError(),
          },
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
            recentPrompts: requestPrompt
              ? [requestPrompt, ...state.recentPrompts.filter((p) => p !== requestPrompt)].slice(0, 20)
              : state.recentPrompts,
            generationState: {
              status: persistedRecords.length === 0 ? "cancelled" : "completed",
              phase: persistedRecords.length === 0 ? "cancelled" : "completed",
              statusMessage: persistedRecords.length === 0 ? tr("status.cancelled") : tr("status.completed"),
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
            generationState: {
              status: "failed",
              phase: "failed",
              statusMessage: tr("status.failed"),
              error: appError,
            },
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
          generationState: {
            status: "failed",
            phase: "failed",
            statusMessage: tr("status.previewFailedPrompt"),
            error: createPreviewRuntimeError(),
          },
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
        recentPrompts: requestPrompt
          ? [requestPrompt, ...state.recentPrompts.filter((p) => p !== requestPrompt)].slice(0, 20)
          : state.recentPrompts,
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
        set({
          generationState: {
            status: "failed",
            phase: "failed",
            statusMessage: tr("status.validationFailed"),
            error: createValidationError(tr("errors.requestNotReady")),
          },
        });
        throw createValidationError(tr("errors.requestNotReady"));
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
        durationSeconds: enhanced.durationSeconds === undefined ? get().form.durationSeconds : String(enhanced.durationSeconds),
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
          generationState: {
            status: "failed",
            phase: "failed",
            statusMessage: tr("status.recoveryFailed"),
            error: appError,
          },
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

    loadGenerationSettings: (id: string, mode: "settings" | "reproduce") => {
      const record = get().history.find((item) => item.id === id);
      if (!record) return;
      const nextForm = recordToGenerationForm(get().form, record, mode);
      set({
        form: nextForm,
        currentGeneration: record,
        ...computeValidationState(nextForm),
        generationState: createIdleGenerationState(),
      });
    },
  };
}
