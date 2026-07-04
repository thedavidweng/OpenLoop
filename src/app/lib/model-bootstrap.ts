import * as api from "@/app/lib/api";
import {
  MODEL_VARIANTS,
  aggregatePackStatus,
  isModelDownloaded,
  packIdForVariant,
} from "@/app/lib/model-packs";
import { tr } from "@/app/lib/i18n";
import type {
  AppError,
  AppSettings,
  BackendProvisionStatus,
  DeviceInfo,
  ModelBootstrapStatus,
  ModelStatusSnapshot,
} from "@/app/lib/types";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  profile: "standard",
  modelVariant: null,
  downloadedModels: [],
  outputDirectory: null,
  backendPort: 8001,
  defaultDurationSeconds: 30,
  defaultAudioFormat: "wav",
  defaultThinking: true,
  firstRunCompleted: false,
  language: null,
};

export function createDefaultBootstrapStatus(): ModelBootstrapStatus {
  return {
    state: "pending",
    message: tr("status.setupRequired"),
  };
}

export function shouldMarkBootstrapFailed(code: string): boolean {
  return (
    code === "BACKEND_START_FAILED" ||
    code === "BACKEND_HEALTH_TIMEOUT" ||
    code === "MODEL_NOT_FOUND"
  );
}

export function createBootstrapRuntimeError(error: unknown): AppError {
  return {
    code: "BOOTSTRAP_STATUS_FAILED",
    message: tr("errors.bootstrapInspectFailed"),
    details: error instanceof Error ? error.message : String(error),
    recoverable: true,
  };
}

export function resolveModelBootstrapStatus(
  settings: AppSettings,
  deviceInfo: DeviceInfo | null,
  statuses: ModelStatusSnapshot[] = [],
  backendProvision?: BackendProvisionStatus | null,
  isRuntime = api.isTauriRuntime(),
): ModelBootstrapStatus {
  if (!settings.firstRunCompleted) {
    return {
      state: "pending",
      message: tr("status.chooseModel"),
    };
  }

  // Check backend provisioning before model status
  if (isRuntime && backendProvision && backendProvision.state !== "ready") {
    if (backendProvision.state === "downloading" || backendProvision.state === "extracting") {
      return {
        state: "provisioning_backend",
        message: tr("status.downloadingBackend"),
        downloadedBytes: backendProvision.downloadedBytes,
        totalBytes: backendProvision.totalBytes ?? undefined,
      };
    }
    if (backendProvision.state === "failed") {
      return {
        state: "failed",
        message: backendProvision.error?.message ?? tr("status.backendProvisionFailed"),
        error: backendProvision.error,
      };
    }
    if (backendProvision.state === "not_installed") {
      return {
        state: "pending",
        message: tr("status.backendNotInstalled"),
      };
    }
  }

  if (!settings.modelVariant) {
    return {
      state: "pending",
      message: tr("status.chooseAndDownload"),
    };
  }

  if (statuses.length > 0) {
    const selectedPackStatus = aggregatePackStatus(
      statuses,
      packIdForVariant(settings.modelVariant),
    );
    if (selectedPackStatus.state === "failed") {
      return {
        state: "failed",
        message:
          selectedPackStatus.error?.message ?? tr("errors.codes.MODEL_DOWNLOAD_FAILED.message"),
        error: selectedPackStatus.error,
      };
    }
    if (selectedPackStatus.state === "downloading") {
      return {
        state: "downloading",
        message: tr("status.downloadingModel", {
          model: selectedPackStatus.label,
        }),
        downloadedBytes: selectedPackStatus.downloadedBytes,
        totalBytes: selectedPackStatus.totalBytes,
      };
    }
  }

  if (!isModelDownloaded(settings, settings.modelVariant)) {
    return {
      state: "pending",
      message: tr("status.downloadModelToStart", {
        model: MODEL_VARIANTS[settings.modelVariant].label,
      }),
    };
  }

  if (deviceInfo?.recommendedProfile === "unsupported" || settings.profile === "unsupported") {
    return {
      state: "experimental",
      message: tr("status.experimentalMac"),
    };
  }

  return {
    state: "ready",
    message: tr(isRuntime ? "status.modelReady" : "status.modelReadyPreview", {
      model: MODEL_VARIANTS[settings.modelVariant].label,
    }),
  };
}
