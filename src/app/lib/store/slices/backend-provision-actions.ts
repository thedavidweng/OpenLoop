import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import * as api from "@/app/lib/api";

/**
 * Backend provision actions — installing, updating, and checking the ACE-Step
 * backend. Extracted from the model slice to keep the slice focused on model
 * download/status management.
 */
export function createBackendProvisionActions(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
) {
  return {
    refreshBackendProvisionStatus: async () => {
      if (!api.isTauriRuntime()) return;
      try {
        const status = await api.getBackendProvisionStatus();
        set({ backendProvisionStatus: status });
      } catch (error) {
        console.warn("Failed to refresh backend provision status:", error);
      }
    },

    provisionBackend: async () => {
      if (!api.isTauriRuntime()) return;
      try {
        const status = await api.provisionBackend();
        set({ backendProvisionStatus: status });
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
