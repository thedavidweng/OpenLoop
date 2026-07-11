import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { GenerationRecord } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import { createIdleGenerationState } from "@/app/lib/store-helpers";
import { computeValidationState } from "@/app/lib/validation-helpers";
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
    currentGeneration: null,
    historyQuery: "",
    favoriteRecordIds: [] as string[],
    lastDeletedRecord: null,
    selectedHistoryIds: [] as string[],
    compareModeActive: false,
    compareGenerationId: null,

    selectGenerationRecord: (id: string) => {
      set((state) => ({
        currentGeneration:
          state.history.find((record) => record.id === id) ?? state.currentGeneration,
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
        selectedHistoryIds: [],
        compareModeActive: false,
        compareGenerationId: null,
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
          history: state.history.map((r) => (r.id === id ? { ...r, isFavorite: newState } : r)),
        }));
      } else {
        set((state) => {
          const isFav = state.favoriteRecordIds.includes(id);
          return {
            favoriteRecordIds: isFav
              ? state.favoriteRecordIds.filter((fid) => fid !== id)
              : [...state.favoriteRecordIds, id],
            history: state.history.map((r) => (r.id === id ? { ...r, isFavorite: !isFav } : r)),
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
          if (selected) {
            return {
              selectedHistoryIds: state.selectedHistoryIds.filter((sid) => sid !== id),
            };
          }
          // Cap at 2 selections for A/B compare
          const nextIds = [...state.selectedHistoryIds, id];
          if (nextIds.length > 2) nextIds.shift();
          return { selectedHistoryIds: nextIds };
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
      if (api.isTauriRuntime()) {
        await Promise.all(ids.map((id) => api.deleteGenerationFileAndRecord(id)));
      }
      set((state) => {
        const remaining = state.history.filter((r) => !ids.includes(r.id));
        const currentDeleted = ids.includes(state.currentGeneration?.id ?? "");
        const compareDeleted = ids.includes(state.compareGenerationId ?? "");
        return {
          history: remaining,
          selectedHistoryIds: [],
          currentGeneration: currentDeleted ? null : state.currentGeneration,
          compareModeActive: compareDeleted ? false : state.compareModeActive,
          compareGenerationId: compareDeleted ? null : state.compareGenerationId,
        };
      });
    },

    batchFavoriteSelected: async () => {
      const ids = get().selectedHistoryIds;
      if (ids.length === 0) return;
      const newFavorites: string[] = [];
      const removedFavorites: string[] = [];
      if (api.isTauriRuntime()) {
        const results = await Promise.all(
          ids.map(async (id) => ({ id, newState: await api.toggleGenerationFavorite(id) })),
        );
        for (const { id, newState } of results) {
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
          ids.includes(r.id) ? { ...r, isFavorite: newFavorites.includes(r.id) } : r,
        ),
        selectedHistoryIds: [],
      }));
    },

    enterCompareMode: (id: string) => {
      const currentId = get().currentGeneration?.id;
      if (!currentId || currentId === id) return;
      set({
        compareModeActive: true,
        compareGenerationId: id,
        selectedHistoryIds: [],
      });
    },

    exitCompareMode: () => {
      set({
        compareModeActive: false,
        compareGenerationId: null,
      });
    },

    toggleCompareTarget: () => {
      set((state) => {
        if (!state.compareModeActive || !state.compareGenerationId) return state;
        const currentId = state.currentGeneration?.id;
        const nextCurrent = state.history.find((r) => r.id === state.compareGenerationId);
        if (!nextCurrent) return state;
        return {
          currentGeneration: nextCurrent,
          compareGenerationId: currentId ?? state.compareGenerationId,
        };
      });
    },
  };
}
