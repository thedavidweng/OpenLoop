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
    selectedHistoryIds: [] as string[],

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
        favoriteRecordIds: [],
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

    toggleFavoriteRecord: async (id: string) => {
      if (api.isTauriRuntime()) {
        const newState = await api.toggleGenerationFavorite(id);
        set((state) => ({
          favoriteRecordIds: newState
            ? state.favoriteRecordIds.includes(id)
              ? state.favoriteRecordIds
              : [...state.favoriteRecordIds, id]
            : state.favoriteRecordIds.filter((fid) => fid !== id),
          history: state.history.map((r) =>
            r.id === id ? { ...r, isFavorite: newState } : r,
          ),
        }));
      } else {
        set((state) => {
          const isFav = state.favoriteRecordIds.includes(id);
          return {
            favoriteRecordIds: isFav
              ? state.favoriteRecordIds.filter((fid) => fid !== id)
              : [...state.favoriteRecordIds, id],
            history: state.history.map((r) =>
              r.id === id ? { ...r, isFavorite: !isFav } : r,
            ),
          };
        });
      }
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

    toggleSelectHistory: (id: string, multi = false) => {
      set((state) => {
        if (multi) {
          const selected = state.selectedHistoryIds.includes(id);
          return {
            selectedHistoryIds: selected
              ? state.selectedHistoryIds.filter((sid) => sid !== id)
              : [...state.selectedHistoryIds, id],
          };
        }
        return {
          selectedHistoryIds: state.selectedHistoryIds.includes(id) ? [] : [id],
        };
      });
    },

    clearSelection: () => {
      set({ selectedHistoryIds: [] });
    },

    batchDeleteSelected: async () => {
      const ids = get().selectedHistoryIds;
      if (ids.length === 0) return;
      for (const id of ids) {
        if (api.isTauriRuntime()) {
          await api.deleteGenerationFileAndRecord(id);
        }
      }
      set((state) => {
        const remaining = state.history.filter((r) => !ids.includes(r.id));
        return {
          history: remaining,
          selectedHistoryIds: [],
          currentGeneration:
            ids.includes(state.currentGeneration?.id ?? "")
              ? null
              : state.currentGeneration,
        };
      });
    },

    batchFavoriteSelected: async () => {
      const ids = get().selectedHistoryIds;
      if (ids.length === 0) return;
      const newFavorites: string[] = [];
      const removedFavorites: string[] = [];
      if (api.isTauriRuntime()) {
        for (const id of ids) {
          const newState = await api.toggleGenerationFavorite(id);
          if (newState) newFavorites.push(id);
          else removedFavorites.push(id);
        }
      }
      set((state) => ({
        favoriteRecordIds: Array.from(
          new Set([
            ...state.favoriteRecordIds.filter((fid) => !removedFavorites.includes(fid)),
            ...newFavorites,
          ]),
        ),
        history: state.history.map((r) =>
          ids.includes(r.id)
            ? { ...r, isFavorite: newFavorites.includes(r.id) }
            : r,
        ),
        selectedHistoryIds: [],
      }));
    },
  };
}
