import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import * as api from "@/app/lib/api";
import { createFailedGenerationState } from "@/app/lib/store-helpers";
import { localizeAppError } from "@/app/lib/errors";
import { tr } from "@/app/lib/i18n";

/**
 * Active generation task management — recovering, discarding, and refreshing
 * tasks that survived a restart. Extracted from the generation slice to keep
 * the slice focused on the primary generation lifecycle.
 */
export function createGenerationTaskActions(
  set: StoreApi<GenerationStore>["setState"],
  _get: StoreApi<GenerationStore>["getState"],
) {
  return {
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
  };
}
