import type { GenerationStore } from "@/app/lib/store/types";
import type { ModelStatusSnapshot } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import {
  MODEL_PACKS,
  aggregatePackStatus,
  expandDownloadedVariantsFromStatuses,
  packIdForVariant,
} from "@/app/lib/model-packs";
import { resolveModelBootstrapStatus } from "@/app/lib/model-bootstrap";
import { tr } from "@/app/lib/i18n";

type StoreState = Pick<
  GenerationStore,
  "modelStatuses" | "settings" | "deviceInfo" | "backendProvisionStatus"
>;

/**
 * Compute the state patch + side effects for a model status update.
 * Extracted from the model slice so the slice stays under the line limit
 * without splitting a cohesive state-update across multiple files.
 *
 * Returns a partial state patch to `set()`, plus any `setSetting` side
 * effects that should be fired (non-blocking).
 */
export function computeModelStatusPatch(
  status: ModelStatusSnapshot,
  state: StoreState,
): {
  patch: Partial<GenerationStore>;
  sideEffects: Promise<unknown>[];
} {
  const modelStatuses = [
    ...state.modelStatuses.filter((current) => current.variant !== status.variant),
    status,
  ];
  const downloadedModels = expandDownloadedVariantsFromStatuses(modelStatuses);
  const selectedPack = state.settings.modelVariant
    ? packIdForVariant(state.settings.modelVariant)
    : null;
  const eventPack = packIdForVariant(status.variant);
  const packAggregate = aggregatePackStatus(modelStatuses, eventPack);
  const nextSettings = { ...state.settings, downloadedModels };
  const sideEffects: Promise<unknown>[] = [];

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
      sideEffects.push(api.setSetting("downloadedModels", downloadedModels));
      if (nextSelected === null && currentSelected !== null) {
        sideEffects.push(api.setSetting("modelVariant", nextSelected));
      }
    }
  }

  const bootstrapStatus =
    selectedPack === eventPack
      ? packAggregate.state === "downloading"
        ? {
            state: "downloading" as const,
            message: tr("status.downloadingModel", {
              model: MODEL_PACKS[eventPack].label,
            }),
            downloadedBytes: packAggregate.downloadedBytes,
            totalBytes: packAggregate.totalBytes,
          }
        : packAggregate.state === "failed"
          ? {
              state: "failed" as const,
              message: packAggregate.error?.message ?? tr("status.stackReportedError"),
              error: packAggregate.error ?? null,
            }
          : packAggregate.state === "ready"
            ? {
                state: "ready" as const,
                message: tr("status.modelReady", {
                  model: MODEL_PACKS[eventPack].label,
                }),
              }
            : {
                state: "pending" as const,
                message: tr("status.downloadModelToStart", {
                  model: MODEL_PACKS[eventPack].label,
                }),
              }
      : resolveModelBootstrapStatus(
          nextSettings,
          state.deviceInfo,
          modelStatuses,
          state.backendProvisionStatus,
        );

  return {
    patch: { modelStatuses, settings: nextSettings, bootstrapStatus },
    sideEffects,
  };
}
