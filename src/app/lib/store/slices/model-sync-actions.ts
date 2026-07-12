import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { AppSettings, BackendProvisionStatus } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import { expandDownloadedVariantsFromStatuses } from "@/app/lib/model-packs";
import { localizeModelStatuses } from "@/app/lib/errors";
import { resolveModelBootstrapStatus } from "@/app/lib/model-bootstrap";

/**
 * Model sync actions — refreshing model statuses from the backend and
 * deleting all models. Extracted from the model slice to keep it focused.
 */
export function createModelSyncActions(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    deleteAllModels: async () => {
      if (!api.isTauriRuntime()) return;
      const state = get();
      const rawModelStatuses = await api.deleteAllModels();
      const modelStatuses = localizeModelStatuses(rawModelStatuses);
      const downloadedModels = expandDownloadedVariantsFromStatuses(modelStatuses);
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
      void api.setSetting("downloadedModels", downloadedModels).catch(() => {});
      void api.setSetting("modelVariant", nextModelVariant).catch(() => {});
    },

    refreshModelStatuses: async () => {
      if (!api.isTauriRuntime()) return;
      const [modelCatalog, rawModelStatuses, backendProvision] = await Promise.all([
        api.listModelCatalog(),
        api.getModelStatus(),
        api
          .getBackendProvisionStatus()
          .catch(() => ({ state: "not_installed" }) as BackendProvisionStatus),
      ]);
      const modelStatuses = localizeModelStatuses(rawModelStatuses);
      const downloadedModels = expandDownloadedVariantsFromStatuses(modelStatuses);
      set((state) => ({
        modelCatalog,
        modelStatuses,
        backendProvisionStatus: backendProvision,
        settings: {
          ...state.settings,
          downloadedModels,
          modelVariant:
            state.settings.modelVariant && downloadedModels.includes(state.settings.modelVariant)
              ? state.settings.modelVariant
              : null,
        },
        bootstrapStatus: resolveModelBootstrapStatus(
          {
            ...state.settings,
            downloadedModels,
            modelVariant:
              state.settings.modelVariant && downloadedModels.includes(state.settings.modelVariant)
                ? state.settings.modelVariant
                : null,
          },
          state.deviceInfo,
          modelStatuses,
          backendProvision,
        ),
      }));
    },
  };
}
