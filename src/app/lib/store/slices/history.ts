import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { GenerationRecord } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import {
  computeValidationState,
  createIdleGenerationState,
} from "@/app/lib/store-helpers";
import {
  nextCurrentGenerationAfterDelete,
  recordToGenerationForm,
} from "@/app/lib/history-workflow";

export function createHistorySlice(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    history: [] as GenerationRecord[],
    currentGeneration: null as GenerationRecord | null,
    historyQuery: "",
    favoriteRecordIds: [] as string[],
    lastDeletedRecord: null as GenerationRecord | null,

    selectGenerationRecord: (id: string) => {
      set((state) => ({
        currentGeneration:
          state.history.find((record) => record.id === id) ??
          state.currentGeneration,
      }));
    },

    deleteGenerationRecord: async (
      id: string,
      options: { alreadyDeleted?: boolean; undoable?: boolean } = {},
    ) => {
      const deleted = get().history.find((r) => r.id === id) ?? null;
      if (api.isTauriRuntime() && !options.alreadyDeleted) {
        await api.deleteGenerationFileAndRecord(id);
      }
      set((state) => {
        const nextHistory = state.history.filter((record) => record.id !== id);
        return {
          history: nextHistory,
          currentGeneration: nextCurrentGenerationAfterDelete(
            state.currentGeneration,
            id,
            nextHistory,
          ),
          lastDeletedRecord: options.undoable !== false ? deleted : null,
        };
      });
    },

    clearGenerationHistory: async () => {
      if (api.isTauriRuntime()) {
        await api.clearGenerationHistory();
      }
      set({
        history: [],
        currentGeneration: null,
      });
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

    toggleFavoriteRecord: (id: string) => {
      set((state) => {
        const isFav = state.favoriteRecordIds.includes(id);
        return {
          favoriteRecordIds: isFav
            ? state.favoriteRecordIds.filter((fid) => fid !== id)
            : [...state.favoriteRecordIds, id],
        };
      });
    },

    restoreLastDeletedRecord: () => {
      set((state) => {
        if (!state.lastDeletedRecord) return state;
        const restored = state.lastDeletedRecord;
        return {
          history: [restored, ...state.history],
          lastDeletedRecord: null,
          currentGeneration: restored,
        };
      });
    },
  };
}
