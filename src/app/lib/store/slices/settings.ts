import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";

import * as api from "@/app/lib/api";
import { localizeModelStatuses } from "@/app/lib/errors";
import {
  PROFILE_FORM_PRESETS,
  applyModelVariantToForm,
  applyProfilePreset,
} from "@/app/lib/profile-presets";
import { computeValidationState } from "@/app/lib/validation-helpers";
import { DEFAULT_APP_SETTINGS, resolveModelBootstrapStatus } from "@/app/lib/model-bootstrap";
import { expandDownloadedVariantsFromStatuses } from "@/app/lib/model-packs";

import i18next, { detectSystemLanguage, tr } from "@/app/lib/i18n";
import {
  createFailedGenerationState,
  createIdleGenerationState,
  prependRecentPrompt,
} from "@/app/lib/store-helpers";

export function createSettingsSlice(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    settings: DEFAULT_APP_SETTINGS,
    recentPrompts: [],
    favoritePrompts: [],
    deviceInfo: null,
    hydrated: false,

    setLanguage: async (language: string) => {
      await i18next.changeLanguage(language);
      if (api.isTauriRuntime()) {
        await api.setSetting("language", language);
      }
      set((state) => {
        const settings = { ...state.settings, language };
        const modelStatuses = localizeModelStatuses(state.modelStatuses);
        return {
          settings,
          modelStatuses,
          generationState:
            state.generationState.status === "idle"
              ? createIdleGenerationState()
              : state.generationState,
          bootstrapStatus: resolveModelBootstrapStatus(settings, state.deviceInfo, modelStatuses),
        };
      });
    },

    completeSetup: async () => {
      const profile = get().deviceInfo?.recommendedProfile ?? get().settings.profile;
      const nextSettings = {
        ...get().settings,
        profile,
        firstRunCompleted: true,
        defaultThinking: PROFILE_FORM_PRESETS[profile].thinking,
      };

      if (api.isTauriRuntime()) {
        await Promise.all([
          api.setSetting("profile", profile),
          api.setSetting("firstRunCompleted", true),
          api.setSetting("defaultThinking", nextSettings.defaultThinking),
        ]);
        await get().hydrateFromPersistence();
        set({ setupOverride: false });
        await get().refreshBootstrapStatus();
        return;
      }

      const nextForm = applyModelVariantToForm(
        applyProfilePreset(get().form, profile),
        nextSettings.modelVariant,
      );
      set({
        setupOverride: false,
        settings: nextSettings,
        form: nextForm,
        ...computeValidationState(nextForm, { showErrors: false }),
      });
      await get().refreshBootstrapStatus();
    },

    addRecentPrompt: (prompt: string) => {
      set((state) => ({
        recentPrompts: prependRecentPrompt(state.recentPrompts, prompt.trim()),
      }));
    },

    toggleFavoritePrompt: (prompt: string) => {
      set((state) => {
        const trimmed = prompt.trim();
        if (!trimmed) return state;
        const isFav = state.favoritePrompts.includes(trimmed);
        const nextFavs = isFav
          ? state.favoritePrompts.filter((p) => p !== trimmed)
          : [trimmed, ...state.favoritePrompts].slice(0, 50);
        return { favoritePrompts: nextFavs };
      });
    },

    removeRecentPrompt: (prompt: string) => {
      set((state) => ({
        recentPrompts: state.recentPrompts.filter((p) => p !== prompt),
      }));
    },

    hydrateFromPersistence: async () => {
      if (!api.isTauriRuntime()) {
        await i18next.changeLanguage(detectSystemLanguage());
        set({
          hydrated: true,
          bootstrapStatus: {
            state: "ready",
            message: tr("status.previewShellMode"),
          },
        });
        return;
      }

      try {
        const [
          persistedSettings,
          persistedHistory,
          deviceInfo,
          modelCatalog,
          rawModelStatuses,
          activeTasks,
          projects,
        ] = await Promise.all([
          api.getSettings(),
          api.listGenerations(),
          api.getDeviceInfo(),
          api.listModelCatalog(),
          api.getModelStatus(),
          api.listActiveGenerationTasks(),
          api.listProjects(),
        ]);

        const profile = persistedSettings.firstRunCompleted
          ? persistedSettings.profile
          : deviceInfo.recommendedProfile;
        const mergedSettings = {
          ...get().settings,
          ...persistedSettings,
          profile,
          defaultThinking: PROFILE_FORM_PRESETS[profile].thinking,
          downloadedModels: expandDownloadedVariantsFromStatuses(rawModelStatuses),
        };
        const language = mergedSettings.language ?? detectSystemLanguage();
        await i18next.changeLanguage(language);
        const modelStatuses = localizeModelStatuses(rawModelStatuses);
        const nextForm = applyModelVariantToForm(
          applyProfilePreset(get().form, profile),
          mergedSettings.modelVariant,
        );

        const favoriteRecordIds = persistedHistory.filter((r) => r.isFavorite).map((r) => r.id);

        set({
          hydrated: true,
          deviceInfo,
          modelCatalog,
          modelStatuses,
          settings: mergedSettings,
          form: nextForm,
          ...computeValidationState(nextForm, { showErrors: false }),
          generationState: createIdleGenerationState(),
          history: persistedHistory,
          favoriteRecordIds,
          activeTasks,
          projects,
          currentGeneration: persistedHistory[0] ?? null,
        });
        await get().refreshBootstrapStatus();
      } catch (error) {
        set({
          hydrated: true,
          bootstrapStatus: {
            state: "failed",
            message: tr("status.hydrationFailed"),
            error: {
              code: "BOOTSTRAP_RUNTIME_ERROR",
              message: tr("errors.persistenceHydrationFailed"),
              details: String(error),
              recoverable: true,
            },
          },
          generationState: createFailedGenerationState(tr("status.persistenceHydrationFailed"), {
            code: "PERSISTENCE_HYDRATION_FAILED",
            message: tr("errors.persistenceHydrationFailed"),
            details: String(error),
            recoverable: true,
          }),
        });
      }
    },
  };
}
