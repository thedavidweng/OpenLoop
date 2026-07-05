import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { ModelVariant, ModelStatusSnapshot, BackendProvisionStatus } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import {
  MODEL_PACKS,
  aggregatePackStatus,
  packIdForVariant,
  primaryVariantForPack,
  profileForVariant,
} from "@/app/lib/model-packs";
import {
  PROFILE_FORM_PRESETS,
  applyModelVariantToForm,
  applyProfilePreset,
} from "@/app/lib/profile-presets";
import { computeValidationState } from "@/app/lib/validation-helpers";
import { resolveModelBootstrapStatus } from "@/app/lib/model-bootstrap";
import { tr } from "@/app/lib/i18n";
import { MODEL_CATALOG } from "./model-catalog";
import { createBackendProvisionActions } from "./backend-provision-actions";
import { computeModelStatusPatch } from "./model-status-apply";
import { createModelSyncActions } from "./model-sync-actions";

export function createModelSlice(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    bootstrapStatus: {
      state: "pending",
      message: tr("status.chooseAndDownload"),
    } as const,
    modelCatalog: MODEL_CATALOG,
    modelStatuses: [],
    backendProvisionStatus: {
      state: "not_installed",
    } as BackendProvisionStatus,

    downloadModelVariant: async (variant: ModelVariant) => {
      const packId = packIdForVariant(variant);
      const downloadTarget = primaryVariantForPack(packId);
      const packAggregate = aggregatePackStatus(get().modelStatuses, packId);
      set({
        bootstrapStatus: {
          state: "downloading",
          message: tr("status.preparingModel", {
            model: MODEL_PACKS[packId].label,
          }),
          downloadedBytes: packAggregate.downloadedBytes,
          totalBytes: packAggregate.totalBytes ?? MODEL_PACKS[packId].estimatedSizeBytes,
        },
      });

      if (api.isTauriRuntime()) {
        const initialStatus = await api.downloadModel(downloadTarget);
        get().applyModelStatus(initialStatus);
        await Promise.all([
          api.setSetting("modelVariant", variant),
          api.setSetting("profile", profileForVariant(variant)),
          api.setSetting(
            "defaultThinking",
            PROFILE_FORM_PRESETS[profileForVariant(variant)].thinking,
          ),
        ]);
        const profile = profileForVariant(variant);
        const nextForm = applyModelVariantToForm(applyProfilePreset(get().form, profile), variant);
        set((state) => ({
          settings: {
            ...state.settings,
            profile,
            modelVariant: variant,
            defaultThinking: PROFILE_FORM_PRESETS[profile].thinking,
          },
          form: nextForm,
          ...computeValidationState(nextForm, { showErrors: false }),
        }));
        return;
      }

      const nextDownloadedModels = Array.from(
        new Set([...get().settings.downloadedModels, ...MODEL_PACKS[packId].variants]),
      );
      const nextSettings = {
        ...get().settings,
        profile: profileForVariant(variant),
        modelVariant: variant,
        downloadedModels: nextDownloadedModels,
      };
      const nextForm = applyModelVariantToForm(
        applyProfilePreset(get().form, nextSettings.profile),
        variant,
      );
      set({
        settings: nextSettings,
        form: nextForm,
        ...computeValidationState(nextForm, { showErrors: false }),
        bootstrapStatus: {
          state: "ready",
          message: tr("status.modelReady", {
            model: MODEL_PACKS[packId].label,
          }),
        },
      });
    },

    deleteModelVariant: async (variant: ModelVariant) => {
      const packId = packIdForVariant(variant);
      const deleteTarget = primaryVariantForPack(packId);
      if (api.isTauriRuntime()) {
        const status = await api.deleteModel(deleteTarget);
        get().applyModelStatus(status);
        return;
      }
      const nextDownloadedModels = get().settings.downloadedModels.filter(
        (downloaded) => !MODEL_PACKS[packId].variants.includes(downloaded),
      );
      const currentSelected = get().settings.modelVariant;
      const nextSelected =
        currentSelected && MODEL_PACKS[packId].variants.includes(currentSelected)
          ? null
          : currentSelected;
      set((state) => ({
        settings: {
          ...state.settings,
          downloadedModels: nextDownloadedModels,
          modelVariant: nextSelected,
        },
        bootstrapStatus: nextSelected
          ? state.bootstrapStatus
          : { state: "pending", message: tr("status.chooseAndDownload") },
      }));
    },

    cancelModelDownload: async (variant: ModelVariant) => {
      if (api.isTauriRuntime()) {
        await api.cancelDownload(variant);
      }
    },

    clearPartialModelDownloads: async (variant: ModelVariant) => {
      if (api.isTauriRuntime()) {
        const status = await api.clearPartialDownloads(variant);
        get().applyModelStatus(status);
      }
    },

    applyModelStatus: (status: ModelStatusSnapshot) => {
      set((state) => {
        const { patch, sideEffects } = computeModelStatusPatch(status, state);
        for (const effect of sideEffects) void effect;
        return patch;
      });
    },

    selectModelVariant: async (variant: ModelVariant) => {
      const profile = profileForVariant(variant);
      if (api.isTauriRuntime()) {
        await Promise.all([
          api.setSetting("modelVariant", variant),
          api.setSetting("profile", profile),
          api.setSetting("defaultThinking", PROFILE_FORM_PRESETS[profile].thinking),
        ]);
        await get().hydrateFromPersistence();
        await get().refreshBootstrapStatus();
        return;
      }
      const nextSettings = {
        ...get().settings,
        profile,
        defaultThinking: PROFILE_FORM_PRESETS[profile].thinking,
        modelVariant: variant,
      };
      const nextForm = applyModelVariantToForm(applyProfilePreset(get().form, profile), variant);
      set({
        settings: nextSettings,
        form: nextForm,
        ...computeValidationState(nextForm, { showErrors: false }),
      });
      await get().refreshBootstrapStatus();
    },

    refreshBootstrapStatus: async () => {
      const bootstrapStatus = resolveModelBootstrapStatus(
        get().settings,
        get().deviceInfo,
        get().modelStatuses,
        get().backendProvisionStatus,
      );
      set({ bootstrapStatus });
    },

    ...createBackendProvisionActions(set, get),
    ...createModelSyncActions(set, get),
  };
}
