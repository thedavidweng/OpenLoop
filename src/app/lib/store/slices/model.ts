import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type {
  AppSettings,
  ModelVariant,
  ModelStatusSnapshot,
  BackendProvisionStatus,
} from "@/app/lib/types";
import * as api from "@/app/lib/api";
import {
  MODEL_PACKS,
  aggregatePackStatus,
  expandDownloadedVariantsFromStatuses,
  packIdForVariant,
  primaryVariantForPack,
  profileForVariant,
} from "@/app/lib/model-packs";
import { localizeModelStatuses } from "@/app/lib/errors";
import {
  PROFILE_FORM_PRESETS,
  applyModelVariantToForm,
  applyProfilePreset,
} from "@/app/lib/profile-presets";
import { computeValidationState } from "@/app/lib/validation-helpers";
import { resolveModelBootstrapStatus } from "@/app/lib/model-bootstrap";
import i18next from "@/app/lib/i18n";

function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
}

export function createModelSlice(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    bootstrapStatus: {
      state: "pending",
      message: tr("status.chooseAndDownload"),
    } as const,
    modelCatalog: Object.values({
      lite: {
        id: "lite",
        label: "Lite",
        modelName: "acestep-v15-turbo",
        description: "",
      },
      turbo: {
        id: "turbo",
        label: "Turbo",
        modelName: "acestep-v15-turbo",
        description: "",
      },
      pro: {
        id: "pro",
        label: "XL Turbo",
        modelName: "acestep-v15-xl-turbo",
        description: "",
      },
    }).map((variant) => ({
      variant: variant.id as ModelVariant,
      label: variant.label,
      modelName: variant.modelName,
      lmModel:
        variant.id === "pro" ? "acestep-5Hz-lm-1.7B" : "acestep-5Hz-lm-0.6B",
      lmBackend: "mlx" as const,
      estimatedSizeBytes:
        variant.id === "pro" ? 22 * 1024 * 1024 * 1024 : 8 * 1024 * 1024 * 1024,
      description: variant.description,
      recommendedMemoryGb:
        variant.id === "pro" ? 20 : variant.id === "lite" ? 8 : 16,
    })),
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
          totalBytes:
            packAggregate.totalBytes ?? MODEL_PACKS[packId].estimatedSizeBytes,
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
        const nextForm = applyModelVariantToForm(
          applyProfilePreset(get().form, profile),
          variant,
        );
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
        new Set([
          ...get().settings.downloadedModels,
          ...MODEL_PACKS[packId].variants,
        ]),
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
        currentSelected &&
        MODEL_PACKS[packId].variants.includes(currentSelected)
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

    deleteAllModels: async () => {
      if (!api.isTauriRuntime()) return;
      const state = get();
      const rawModelStatuses = await api.deleteAllModels();
      const modelStatuses = localizeModelStatuses(rawModelStatuses);
      const downloadedModels =
        expandDownloadedVariantsFromStatuses(modelStatuses);
      const nextModelVariant = (
        downloadedModels.length === 0 ? "" : state.settings.modelVariant
      ) as AppSettings["modelVariant"];
      set((prev) => ({
        modelStatuses,
        settings: {
          ...prev.settings,
          downloadedModels,
          modelVariant: nextModelVariant,
        },
        bootstrapStatus: resolveModelBootstrapStatus(
          {
            ...prev.settings,
            downloadedModels,
            modelVariant: nextModelVariant,
          },
          null,
          modelStatuses,
          prev.backendProvisionStatus,
        ),
      }));
      void api.setSetting("downloadedModels", downloadedModels);
      void api.setSetting("modelVariant", nextModelVariant);
    },

    refreshModelStatuses: async () => {
      if (!api.isTauriRuntime()) return;
      const [modelCatalog, rawModelStatuses, backendProvision] =
        await Promise.all([
          api.listModelCatalog(),
          api.getModelStatus(),
          api
            .getBackendProvisionStatus()
            .catch(
              () => ({ state: "not_installed" }) as BackendProvisionStatus,
            ),
        ]);
      const modelStatuses = localizeModelStatuses(rawModelStatuses);
      const downloadedModels =
        expandDownloadedVariantsFromStatuses(modelStatuses);
      set((state) => ({
        modelCatalog,
        modelStatuses,
        backendProvisionStatus: backendProvision,
        settings: {
          ...state.settings,
          downloadedModels,
          modelVariant:
            state.settings.modelVariant &&
            downloadedModels.includes(state.settings.modelVariant)
              ? state.settings.modelVariant
              : state.settings.modelVariant,
        },
        bootstrapStatus: resolveModelBootstrapStatus(
          {
            ...state.settings,
            downloadedModels,
            modelVariant: state.settings.modelVariant,
          },
          state.deviceInfo,
          modelStatuses,
          backendProvision,
        ),
      }));
    },

    applyModelStatus: (status: ModelStatusSnapshot) => {
      set((state) => {
        const modelStatuses = [
          ...state.modelStatuses.filter(
            (current) => current.variant !== status.variant,
          ),
          status,
        ];
        const downloadedModels =
          expandDownloadedVariantsFromStatuses(modelStatuses);
        const selectedPack = state.settings.modelVariant
          ? packIdForVariant(state.settings.modelVariant)
          : null;
        const eventPack = packIdForVariant(status.variant);
        const packAggregate = aggregatePackStatus(modelStatuses, eventPack);
        const nextSettings = { ...state.settings, downloadedModels };

        if (status.state !== "downloading") {
          const currentSelected = state.settings.modelVariant;
          const nextSelected =
            currentSelected &&
            MODEL_PACKS[eventPack].variants.includes(currentSelected) &&
            !downloadedModels.includes(currentSelected)
              ? null
              : currentSelected;
          if (nextSettings.modelVariant !== nextSelected) {
            nextSettings.modelVariant = nextSelected;
          }
          if (api.isTauriRuntime()) {
            void api.setSetting("downloadedModels", downloadedModels);
            if (nextSelected === null && currentSelected !== null) {
              void api.setSetting("modelVariant", nextSelected);
            }
          }
        }

        return {
          modelStatuses,
          settings: nextSettings,
          bootstrapStatus:
            selectedPack === eventPack
              ? packAggregate.state === "downloading"
                ? {
                    state: "downloading",
                    message: tr("status.downloadingModel", {
                      model: MODEL_PACKS[eventPack].label,
                    }),
                    downloadedBytes: packAggregate.downloadedBytes,
                    totalBytes: packAggregate.totalBytes,
                  }
                : packAggregate.state === "failed"
                  ? {
                      state: "failed",
                      message:
                        packAggregate.error?.message ??
                        tr("status.stackReportedError"),
                      error: packAggregate.error ?? null,
                    }
                  : packAggregate.state === "ready"
                    ? {
                        state: "ready",
                        message: tr("status.modelReady", {
                          model: MODEL_PACKS[eventPack].label,
                        }),
                      }
                    : {
                        state: "pending",
                        message: tr("status.downloadModelToStart", {
                          model: MODEL_PACKS[eventPack].label,
                        }),
                      }
              : resolveModelBootstrapStatus(
                  nextSettings,
                  state.deviceInfo,
                  modelStatuses,
                  state.backendProvisionStatus,
                ),
        };
      });
    },

    selectModelVariant: async (variant: ModelVariant) => {
      const profile = profileForVariant(variant);
      if (api.isTauriRuntime()) {
        await Promise.all([
          api.setSetting("modelVariant", variant),
          api.setSetting("profile", profile),
          api.setSetting(
            "defaultThinking",
            PROFILE_FORM_PRESETS[profile].thinking,
          ),
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
      const nextForm = applyModelVariantToForm(
        applyProfilePreset(get().form, profile),
        variant,
      );
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

    refreshBackendProvisionStatus: async () => {
      if (!api.isTauriRuntime()) return;
      try {
        const status = await api.getBackendProvisionStatus();
        set({ backendProvisionStatus: status });
      } catch {
        // Ignore errors — provisioner may not be available
      }
    },

    provisionBackend: async () => {
      if (!api.isTauriRuntime()) return;
      try {
        const status = await api.provisionBackend();
        set({ backendProvisionStatus: status });
        // Refresh bootstrap status after provisioning
        await get().refreshBootstrapStatus();
      } catch (error) {
        set({
          backendProvisionStatus: {
            state: "failed",
            installedCommit: null,
            installedTag: null,
            latestCommit: null,
            latestTag: null,
            updateAvailable: false,
            downloadedBytes: 0,
            error:
              error instanceof Error
                ? {
                    code: "BACKEND_PROVISION_FAILED",
                    message: error.message,
                    recoverable: true,
                  }
                : undefined,
          },
        });
      }
    },

    updateBackend: async () => {
      if (!api.isTauriRuntime()) return;
      try {
        const status = await api.updateBackend();
        set({ backendProvisionStatus: status });
        await get().refreshBootstrapStatus();
      } catch (error) {
        set({
          backendProvisionStatus: {
            ...get().backendProvisionStatus,
            state: "failed",
            error:
              error instanceof Error
                ? {
                    code: "BACKEND_PROVISION_FAILED",
                    message: error.message,
                    recoverable: true,
                  }
                : undefined,
          },
        });
      }
    },
  };
}
