import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { GenerationFormValues } from "@/app/lib/types";
import { DEFAULT_GENERATION_FORM_VALUES } from "@/app/lib/validation";
import { computeValidationState } from "@/app/lib/validation-helpers";
import { INITIAL_CURRENT_REQUEST } from "@/app/lib/history-workflow";
import { createIdleGenerationState } from "@/app/lib/store-helpers";
import * as api from "@/app/lib/api";

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 260;

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function createUISlice(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    isSettingsOpen: false,
    sidebarVisible: true,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    setupOverride: false,
    lyricsPanelOpen: false,
    demoMode: false,
    highContrast: false,
    form: DEFAULT_GENERATION_FORM_VALUES,
    validationErrors: {},
    currentRequest: INITIAL_CURRENT_REQUEST,

    setField: <K extends keyof GenerationFormValues>(field: K, value: GenerationFormValues[K]) => {
      const prevForm = get().form;
      const nextForm: GenerationFormValues = {
        ...prevForm,
        [field]: value,
      };
      if (field === "thinking" && value === false) {
        nextForm.useCotCaption = false;
        nextForm.useCotLanguage = false;
        nextForm.constrainedDecoding = false;
      }
      const nextValidation = computeValidationState(nextForm);
      set((state) => ({
        form: nextForm,
        ...nextValidation,
        generationState:
          state.generationState.status === "running" ||
          state.generationState.status === "validating"
            ? state.generationState
            : createIdleGenerationState(),
      }));
    },

    toggleSettings: () => {
      set((state) => ({ isSettingsOpen: !state.isSettingsOpen }));
    },

    toggleSidebar: () => {
      set((state) => ({ sidebarVisible: !state.sidebarVisible }));
    },

    toggleLyricsPanel: () => {
      set((state) => ({ lyricsPanelOpen: !state.lyricsPanelOpen }));
    },

    setSidebarWidth: (width: number) => {
      set({ sidebarWidth: clampSidebarWidth(width) });
    },

    setHistoryQuery: (query: string) => {
      set({ historyQuery: query });
    },

    closeSettings: () => {
      set({ isSettingsOpen: false });
    },

    closeSetup: () => {
      set({ setupOverride: false });
    },

    openSettings: () => {
      set({ isSettingsOpen: true });
    },

    reopenSetup: () => {
      set({ setupOverride: true, isSettingsOpen: false });
    },

    enterDemoMode: () => {
      set({ demoMode: true });
    },

    dismissDemoMode: () => {
      set({ demoMode: false });
    },

    setHighContrast: (enabled: boolean) => {
      set({ highContrast: enabled });
      if (api.isTauriRuntime()) {
        api.setSetting("highContrast", enabled);
      }
    },

    resetForm: () => {
      set({
        form: DEFAULT_GENERATION_FORM_VALUES,
        validationErrors: {},
        currentRequest: INITIAL_CURRENT_REQUEST,
        generationState: createIdleGenerationState(),
        lyricsPanelOpen: false,
      });
    },
  };
}
