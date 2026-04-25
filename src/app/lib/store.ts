import { create } from "zustand";
import * as api from "@/app/lib/api";
import {
  DEFAULT_GENERATION_FORM_VALUES,
  validateGenerationForm,
} from "@/app/lib/validation";
import type {
  AppError,
  AppSettings,
  DeviceInfo,
  GenerationEvent,
  GenerationFormValues,
  GenerationRecord,
  GenerationRequest,
  GenerationState,
  ModelCatalogItem,
  ModelStatusSnapshot,
  ModelVariant,
  ModelBootstrapStatus,
  ModelDownloadState,
  ValidationErrors,
} from "@/app/lib/types";
import i18next, { detectSystemLanguage } from "@/app/lib/i18n";

const PREVIEW_DELAY_MS = {
  validating: 350,
  running: 1100,
};

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 260;

const DEFAULT_APP_SETTINGS: AppSettings = {
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

const PROFILE_FORM_PRESETS = {
  "low-memory": {
    model: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: false,
    inferenceSteps: "6",
    guidanceScale: "6.0",
  },
  standard: {
    model: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: true,
    inferenceSteps: "8",
    guidanceScale: "7.0",
  },
  quality: {
    model: "acestep-v15-xl-turbo",
    lmModelPath: "acestep-5Hz-lm-1.7B",
    lmBackend: "mlx",
    thinking: true,
    inferenceSteps: "10",
    guidanceScale: "7.5",
  },
  unsupported: {
    model: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: false,
    inferenceSteps: "6",
    guidanceScale: "6.5",
  },
} satisfies Record<
  AppSettings["profile"],
  Pick<
    GenerationFormValues,
    "model" | "lmModelPath" | "lmBackend" | "thinking" | "inferenceSteps" | "guidanceScale"
  >
>;

export const MODEL_VARIANTS = {
  lite: {
    id: "lite",
    label: "Lite",
    description: "Official lower-memory profile: turbo DiT + 0.6B LM.",
    modelName: "acestep-v15-turbo",
  },
  turbo: {
    id: "turbo",
    label: "Turbo",
    description: "Recommended profile for 16 GB Apple Silicon Macs: turbo DiT + 0.6B LM.",
    modelName: "acestep-v15-turbo",
  },
  pro: {
    id: "pro",
    label: "XL Turbo",
    description: "Official XL turbo profile for larger-memory machines.",
    modelName: "acestep-v15-xl-turbo",
  },
} as const satisfies Record<
  ModelVariant,
  { id: ModelVariant; label: string; description: string; modelName: string }
>;

export const MODEL_PACKS = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "Shared ACE-Step turbo DiT + 0.6B LM pack used by Lite and Turbo profiles.",
    variants: ["lite", "turbo"] as ModelVariant[],
    primaryVariant: "turbo" as ModelVariant,
    estimatedSizeBytes: 8 * 1024 * 1024 * 1024,
  },
  xl: {
    id: "xl",
    label: "XL",
    description: "ACE-Step XL turbo DiT + 1.7B LM pack used by Pro profile.",
    variants: ["pro"] as ModelVariant[],
    primaryVariant: "pro" as ModelVariant,
    estimatedSizeBytes: 22 * 1024 * 1024 * 1024,
  },
} as const;

export type ModelPackId = keyof typeof MODEL_PACKS;

const IDLE_GENERATION_STATE: GenerationState = {
  status: "idle",
  statusMessage: i18next.t("status.ready"),
  error: null,
};

const DEFAULT_BOOTSTRAP_STATUS: ModelBootstrapStatus = {
  state: "pending",
  message: i18next.t("status.setupRequired"),
};

interface GenerationStore {
  hydrated: boolean;
  deviceInfo: DeviceInfo | null;
  bootstrapStatus: ModelBootstrapStatus;
  modelCatalog: ModelCatalogItem[];
  modelStatuses: ModelStatusSnapshot[];
  isSettingsOpen: boolean;
  sidebarVisible: boolean;
  sidebarWidth: number;
  setupOverride: boolean;
  form: GenerationFormValues;
  validationErrors: ValidationErrors;
  generationState: GenerationState;
  currentRequest: GenerationRequest | null;
  currentGeneration: GenerationRecord | null;
  history: GenerationRecord[];
  historyQuery: string;
  settings: AppSettings;
  applyGenerationEvent: (event: GenerationEvent) => void;
  completeSetup: () => Promise<void>;
  closeSetup: () => void;
  closeSettings: () => void;
  downloadModelVariant: (variant: ModelVariant) => Promise<void>;
  deleteModelVariant: (variant: ModelVariant) => Promise<void>;
  refreshModelStatuses: () => Promise<void>;
  applyModelStatus: (status: ModelStatusSnapshot) => void;
  setLanguage: (language: string) => Promise<void>;
  openSettings: () => void;
  reopenSetup: () => void;
  refreshBootstrapStatus: () => Promise<void>;
  selectModelVariant: (variant: ModelVariant) => Promise<void>;
  selectGenerationRecord: (id: string) => void;
  setSidebarWidth: (width: number) => void;
  setField: <K extends keyof GenerationFormValues>(
    field: K,
    value: GenerationFormValues[K],
  ) => void;
  setHistoryQuery: (query: string) => void;
  toggleSettings: () => void;
  toggleSidebar: () => void;
  hydrateFromPersistence: () => Promise<void>;
  runGeneration: () => Promise<void>;
  cancelGeneration: () => Promise<void>;
  loadGenerationSettings: (id: string, mode: "settings" | "reproduce") => void;
  deleteGenerationRecord: (id: string) => Promise<void>;
  resetForm: () => void;
}

function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
}

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createValidationError(message: string): AppError {
  return {
    code: "VALIDATION_FAILED",
    message,
    details: tr("errors.validationDetails"),
    recoverable: true,
  };
}

function createPreviewRuntimeError(): AppError {
  return {
    code: "PREVIEW_GENERATION_FAILED",
    message: tr("errors.previewFailed"),
    details: tr("errors.previewFailedDetails"),
    recoverable: true,
  };
}

function createBootstrapRuntimeError(error: unknown): AppError {
  return {
    code: "BOOTSTRAP_STATUS_FAILED",
    message: tr("errors.bootstrapInspectFailed"),
    details: error instanceof Error ? error.message : String(error),
    recoverable: true,
  };
}

function createModelRequiredError(): AppError {
  return {
    code: "MODEL_REQUIRED",
    message: tr("errors.modelRequired"),
    details: tr("errors.modelRequiredDetails"),
    recoverable: true,
  };
}

function isModelDownloaded(settings: AppSettings, variant: ModelVariant | null): boolean {
  if (!variant) {
    return false;
  }
  const packId = packIdForVariant(variant);
  return MODEL_PACKS[packId].variants.some((candidate) =>
    settings.downloadedModels.includes(candidate),
  );
}

function modelNameForVariant(variant: ModelVariant): string {
  return MODEL_VARIANTS[variant].modelName;
}

function packIdForVariant(variant: ModelVariant): ModelPackId {
  return variant === "pro" ? "xl" : "standard";
}

function primaryVariantForPack(packId: ModelPackId): ModelVariant {
  return MODEL_PACKS[packId].primaryVariant;
}

function profileForVariant(variant: ModelVariant): AppSettings["profile"] {
  if (variant === "lite") return "low-memory";
  if (variant === "pro") return "quality";
  return "standard";
}

function expandDownloadedVariantsFromStatuses(statuses: ModelStatusSnapshot[]): ModelVariant[] {
  const readyPacks = new Set<ModelPackId>();
  for (const status of statuses) {
    if (status.state === "ready") {
      readyPacks.add(packIdForVariant(status.variant));
    }
  }
  const next: ModelVariant[] = [];
  for (const packId of readyPacks) {
    next.push(...MODEL_PACKS[packId].variants);
  }
  return next;
}

function aggregatePackStatus(
  statuses: ModelStatusSnapshot[],
  packId: ModelPackId,
): {
  state: ModelDownloadState;
  downloadedBytes: number;
  totalBytes?: number;
  label: string;
  error: ModelStatusSnapshot["error"];
} {
  const entries = statuses.filter((status) =>
    MODEL_PACKS[packId].variants.includes(status.variant),
  );
  if (entries.length === 0) {
    return {
      state: "not_installed",
      downloadedBytes: 0,
      totalBytes: MODEL_PACKS[packId].estimatedSizeBytes,
      label: MODEL_PACKS[packId].label,
      error: null,
    };
  }

  const rank: Record<ModelDownloadState, number> = {
    failed: 4,
    downloading: 3,
    ready: 2,
    not_installed: 1,
  };
  const winner = entries.reduce((acc, cur) =>
    rank[cur.state] > rank[acc.state] ? cur : acc,
  );
  const downloadedBytes = Math.max(...entries.map((entry) => entry.downloadedBytes));
  const totalBytes = entries.find((entry) => entry.totalBytes)?.totalBytes ??
    MODEL_PACKS[packId].estimatedSizeBytes;

  return {
    state: winner.state,
    downloadedBytes,
    totalBytes: totalBytes ?? undefined,
    label: MODEL_PACKS[packId].label,
    error: winner.error ?? null,
  };
}

async function resolveBootstrapStatus(
  settings: AppSettings,
  deviceInfo: DeviceInfo | null,
): Promise<ModelBootstrapStatus> {
  if (!settings.firstRunCompleted) {
    return {
      state: "pending",
      message: tr("status.chooseModel"),
    };
  }

  if (!settings.modelVariant) {
    return {
      state: "pending",
      message: tr("status.chooseAndDownload"),
    };
  }

  if (!isModelDownloaded(settings, settings.modelVariant)) {
    return {
      state: "pending",
      message: tr("status.downloadModelToStart", {
        model: MODEL_VARIANTS[settings.modelVariant].label,
      }),
    };
  }

  if (
    deviceInfo?.recommendedProfile === "unsupported" ||
    settings.profile === "unsupported"
  ) {
    return {
      state: "experimental",
      message: tr("status.experimentalMac"),
    };
  }

  if (!api.isTauriRuntime()) {
    return {
      state: "ready",
      message: tr("status.modelReadyPreview", {
        model: MODEL_VARIANTS[settings.modelVariant].label,
      }),
    };
  }

  return {
    state: "ready",
    message: tr("status.modelReady", {
      model: MODEL_VARIANTS[settings.modelVariant].label,
    }),
  };
}

function shouldPreviewFail(request: GenerationRequest) {
  const haystack = `${request.prompt} ${request.lyrics}`.toLowerCase();
  return haystack.includes("fail");
}

function createGenerationRecord(
  request: GenerationRequest,
  status: GenerationRecord["status"],
  errorMessage: string | null,
): GenerationRecord {
  const id = globalThis.crypto.randomUUID();
  const createdAt = new Date().toISOString();
  return {
    id,
    createdAt,
    prompt: request.prompt,
    lyrics: request.lyrics,
    vocalLanguage: request.vocalLanguage,
    durationSeconds: request.durationSeconds,
    bpm: request.bpm,
    keyScale: request.keyScale,
    timeSignature: request.timeSignature,
    model: request.model,
    thinking: request.thinking,
    inferenceSteps: request.inferenceSteps,
    guidanceScale: request.guidanceScale,
    useRandomSeed: request.useRandomSeed,
    seed: request.seed,
    audioFormat: request.audioFormat,
    outputPath:
      status === "completed" ? `/preview-output/${id}.${request.audioFormat}` : null,
    status,
    errorMessage,
    generationInfo:
      status === "completed"
        ? tr("status.previewCompleted")
        : tr("status.previewFailed"),
  };
}

function computeValidationState(form: GenerationFormValues) {
  const result = validateGenerationForm(form);
  return {
    validationErrors: result.errors,
    currentRequest: result.request,
  };
}

function applyProfilePreset(
  form: GenerationFormValues,
  profile: AppSettings["profile"],
) {
  const preset = PROFILE_FORM_PRESETS[profile];
  return {
    ...form,
    model: preset.model,
    lmModelPath: preset.lmModelPath,
    lmBackend: preset.lmBackend,
    thinking: preset.thinking,
    inferenceSteps: preset.inferenceSteps,
    guidanceScale: preset.guidanceScale,
  };
}

function applyModelVariantToForm(
  form: GenerationFormValues,
  variant: ModelVariant | null,
) {
  if (!variant) {
    return form;
  }
  return {
    ...form,
    model: modelNameForVariant(variant),
  };
}

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  hydrated: false,
  deviceInfo: null,
  bootstrapStatus: DEFAULT_BOOTSTRAP_STATUS,
  modelCatalog: Object.values(MODEL_VARIANTS).map((variant) => ({
    variant: variant.id,
    label: variant.label,
    modelName: variant.modelName,
    lmModel: variant.id === "pro" ? "acestep-5Hz-lm-1.7B" : "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    estimatedSizeBytes:
      variant.id === "pro"
        ? 22 * 1024 * 1024 * 1024
        : 8 * 1024 * 1024 * 1024,
    description: variant.description,
    recommendedMemoryGb: variant.id === "pro" ? 20 : variant.id === "lite" ? 8 : 16,
  })),
  modelStatuses: [],
  isSettingsOpen: false,
  sidebarVisible: true,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  setupOverride: false,
  form: DEFAULT_GENERATION_FORM_VALUES,
  validationErrors: {},
  generationState: IDLE_GENERATION_STATE,
  currentRequest: validateGenerationForm(DEFAULT_GENERATION_FORM_VALUES).request,
  currentGeneration: null,
  history: [],
  historyQuery: "",
  settings: DEFAULT_APP_SETTINGS,
  applyGenerationEvent: (event) => {
    switch (event.type) {
      case "backend_starting":
        set({
          bootstrapStatus: {
            state: "downloading",
            message: tr("status.preparingBackend"),
          },
          generationState: {
            status: "running",
            statusMessage: tr("status.startingBackend"),
            error: null,
          },
        });
        break;
      case "submitted":
        set({
          generationState: {
            status: "running",
            statusMessage: tr("status.submittedTask", { taskId: event.taskId }),
            error: null,
          },
        });
        break;
      case "queued":
        set({
          generationState: {
            status: "running",
            statusMessage: tr("status.queued"),
            error: null,
          },
        });
        break;
      case "running":
        set({
          generationState: {
            status: "running",
            statusMessage: tr("status.running"),
            error: null,
          },
        });
        break;
      case "downloading":
        set({
          generationState: {
            status: "running",
            statusMessage: tr("status.downloadingAudio"),
            error: null,
          },
        });
        break;
      case "completed":
        set({
          bootstrapStatus: {
            state: "ready",
            message: tr("status.localStackReady"),
          },
          generationState: {
            status: "completed",
            statusMessage: tr("status.completed"),
            error: null,
          },
        });
        break;
      case "cancelled":
        set({
          generationState: {
            status: "cancelled",
            statusMessage: tr("status.cancelled"),
            error: null,
          },
        });
        break;
      case "failed":
        set({
          bootstrapStatus: {
            state: "failed",
            message: tr("status.stackReportedError"),
            error: event.error,
          },
          generationState: {
            status: "failed",
            statusMessage: tr("status.failed"),
            error: event.error,
          },
        });
        break;
    }
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
      ...computeValidationState(nextForm),
    });
    await get().refreshBootstrapStatus();
  },
  closeSetup: () => {
    set({ setupOverride: false });
  },
	  closeSettings: () => {
	    set({ isSettingsOpen: false });
	  },
	  downloadModelVariant: async (variant) => {
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
          ...computeValidationState(nextForm),
        }));
	      return;
	    }

	    const nextDownloadedModels = Array.from(new Set([
      ...get().settings.downloadedModels,
      ...MODEL_PACKS[packId].variants,
    ]));

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
      ...computeValidationState(nextForm),
      bootstrapStatus: {
        state: "ready",
        message: tr("status.modelReady", { model: MODEL_PACKS[packId].label }),
      },
	    });
	  },
	  deleteModelVariant: async (variant) => {
    const packId = packIdForVariant(variant);
    const deleteTarget = primaryVariantForPack(packId);
	    if (api.isTauriRuntime()) {
	      const statuses = await api.deleteModel(deleteTarget);
	      const nextDownloadedModels = expandDownloadedVariantsFromStatuses(statuses);
	      const currentSelected = get().settings.modelVariant;
	      const nextSelected =
        currentSelected && MODEL_PACKS[packId].variants.includes(currentSelected)
	          ? null
	          : currentSelected;
	      await Promise.all([
	        api.setSetting("downloadedModels", nextDownloadedModels),
	        api.setSetting("modelVariant", nextSelected),
	      ]);
	      await get().hydrateFromPersistence();
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
	        : {
	            state: "pending",
	            message: tr("status.chooseAndDownload"),
	          },
	    }));
	  },
	  refreshModelStatuses: async () => {
	    if (!api.isTauriRuntime()) {
	      return;
	    }
	    const [modelCatalog, modelStatuses] = await Promise.all([
	      api.listModelCatalog(),
	      api.getModelStatus(),
	    ]);
	    const downloadedModels = expandDownloadedVariantsFromStatuses(modelStatuses);
	    set((state) => ({
	      modelCatalog,
	      modelStatuses,
	      settings: {
	        ...state.settings,
	        downloadedModels,
	        modelVariant:
	          state.settings.modelVariant && downloadedModels.includes(state.settings.modelVariant)
	            ? state.settings.modelVariant
	            : state.settings.modelVariant,
	      },
	    }));
	  },
	  applyModelStatus: (status) => {
	    set((state) => {
	      const modelStatuses = [
	        ...state.modelStatuses.filter((current) => current.variant !== status.variant),
	        status,
	      ];
	      const downloadedModels = expandDownloadedVariantsFromStatuses(modelStatuses);
        const selectedPack =
          state.settings.modelVariant
            ? packIdForVariant(state.settings.modelVariant)
            : null;
        const eventPack = packIdForVariant(status.variant);
        const packAggregate = aggregatePackStatus(modelStatuses, eventPack);
	      return {
	        modelStatuses,
	        settings: {
	          ...state.settings,
	          downloadedModels,
	        },
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
                      message: tr("status.stackReportedError"),
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
              : state.bootstrapStatus,
	      };
	    });
	  },
	  setLanguage: async (language) => {
	    await i18next.changeLanguage(language);
	    if (api.isTauriRuntime()) {
	      await api.setSetting("language", language);
	    }
	    set((state) => ({
	      settings: {
	        ...state.settings,
	        language,
	      },
	    }));
	  },
  openSettings: () => {
    set({ isSettingsOpen: true });
  },
  reopenSetup: () => {
    set({ setupOverride: true, isSettingsOpen: false });
  },
  refreshBootstrapStatus: async () => {
    const bootstrapStatus = await resolveBootstrapStatus(
      get().settings,
      get().deviceInfo,
    );
    set({ bootstrapStatus });
  },
  selectModelVariant: async (variant) => {
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
    const nextForm = applyModelVariantToForm(
      applyProfilePreset(get().form, profile),
      variant,
    );
    set({
      settings: nextSettings,
      form: nextForm,
      ...computeValidationState(nextForm),
    });
    await get().refreshBootstrapStatus();
  },
  setField: (field, value) => {
    const nextForm = {
      ...get().form,
      [field]: value,
    };
    const nextValidation = computeValidationState(nextForm);
    set({
      form: nextForm,
      ...nextValidation,
      generationState:
        get().generationState.status === "running" ||
        get().generationState.status === "validating"
          ? get().generationState
          : IDLE_GENERATION_STATE,
    });
  },
  selectGenerationRecord: (id) => {
    set((state) => ({
      currentGeneration:
        state.history.find((record) => record.id === id) ?? state.currentGeneration,
    }));
  },
  setHistoryQuery: (query) => {
    set({ historyQuery: query });
  },
  setSidebarWidth: (width) => {
    set({ sidebarWidth: clampSidebarWidth(width) });
  },
  toggleSettings: () => {
    set({ isSettingsOpen: !get().isSettingsOpen });
  },
  toggleSidebar: () => {
    set({ sidebarVisible: !get().sidebarVisible });
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
	      const [persistedSettings, persistedHistory, deviceInfo, modelCatalog, modelStatuses] = await Promise.all([
	        api.getSettings(),
	        api.listGenerations(),
	        api.getDeviceInfo(),
	        api.listModelCatalog(),
	        api.getModelStatus(),
	      ]);

      const profile = persistedSettings.firstRunCompleted
        ? persistedSettings.profile
        : deviceInfo.recommendedProfile;
	      const mergedSettings = {
	        ...get().settings,
	        ...persistedSettings,
	        profile,
	        defaultThinking: PROFILE_FORM_PRESETS[profile].thinking,
	        downloadedModels: expandDownloadedVariantsFromStatuses(modelStatuses),
	      };
	      const language = mergedSettings.language ?? detectSystemLanguage();
	      await i18next.changeLanguage(language);
	      const nextForm = applyModelVariantToForm(
	        applyProfilePreset(get().form, profile),
	        mergedSettings.modelVariant,
	      );

      set({
        hydrated: true,
	        deviceInfo,
	        modelCatalog,
	        modelStatuses,
	        settings: mergedSettings,
        form: nextForm,
        ...computeValidationState(nextForm),
        history: persistedHistory,
        currentGeneration: persistedHistory[0] ?? null,
      });
      await get().refreshBootstrapStatus();
    } catch (error) {
      set({
        hydrated: true,
        bootstrapStatus: {
          state: "failed",
          message: tr("status.hydrationFailed"),
          error: createBootstrapRuntimeError(error),
        },
        generationState: {
          status: "failed",
          statusMessage: tr("status.persistenceHydrationFailed"),
          error: {
            code: "PERSISTENCE_HYDRATION_FAILED",
            message: tr("errors.persistenceHydrationFailed"),
            details: error instanceof Error ? error.message : String(error),
            recoverable: true,
          },
        },
      });
    }
  },
  runGeneration: async () => {
    const validation = validateGenerationForm(get().form);

    set({
      validationErrors: validation.errors,
      currentRequest: validation.request,
      generationState: {
        status: "validating",
        statusMessage: tr("status.validating"),
        error: null,
      },
    });

    await sleep(PREVIEW_DELAY_MS.validating);

    if (!validation.isValid || validation.request === null) {
      set({
        generationState: {
          status: "failed",
          statusMessage: tr("status.validationFailed"),
          error: createValidationError(
            tr("errors.requestNotReady"),
          ),
        },
      });
      return;
    }

    if (!isModelDownloaded(get().settings, get().settings.modelVariant)) {
      set({
        generationState: {
          status: "failed",
          statusMessage: tr("status.downloadBeforeGenerating"),
          error: createModelRequiredError(),
        },
      });
      return;
    }

    if (api.isTauriRuntime()) {
      try {
        const persistedRecord = await api.generateMusic(validation.request);
        set((state) => ({
          currentGeneration: persistedRecord,
          history: [persistedRecord, ...state.history.filter((record) => record.id !== persistedRecord.id)],
          generationState: {
            status: persistedRecord.status === "cancelled" ? "cancelled" : "completed",
            statusMessage:
              persistedRecord.status === "cancelled"
                ? tr("status.cancelled")
                : tr("status.completed"),
            error: null,
          },
        }));
        await get().refreshBootstrapStatus();
      } catch (error) {
        set({
          bootstrapStatus: {
            state: "failed",
            message: tr("status.submissionFailed"),
            error: createBootstrapRuntimeError(error),
          },
          generationState: {
            status: "failed",
            statusMessage: tr("status.failed"),
            error: {
              code:
                typeof error === "object" && error !== null && "code" in error
                  ? String((error as { code: unknown }).code)
                  : "GENERATION_FAILED",
              message:
                typeof error === "object" && error !== null && "message" in error
                  ? String((error as { message: unknown }).message)
                  : tr("errors.generationFailed"),
              details: error instanceof Error ? error.message : String(error),
              recoverable: true,
            },
          },
        });
      }
      return;
    }

    set({
      generationState: {
        status: "running",
        statusMessage: tr("status.runningPreview"),
        error: null,
      },
    });

    await sleep(PREVIEW_DELAY_MS.running);

    if (shouldPreviewFail(validation.request)) {
      const failedRecord = createGenerationRecord(
        validation.request,
        "failed",
        createPreviewRuntimeError().message,
      );
      const persistedRecord = api.isTauriRuntime()
        ? await api.insertGeneration(failedRecord)
        : failedRecord;
      set((state) => ({
        currentGeneration: persistedRecord,
        history: [persistedRecord, ...state.history],
        generationState: {
          status: "failed",
          statusMessage: tr("status.previewFailedPrompt"),
          error: createPreviewRuntimeError(),
        },
      }));
      return;
    }

    const completedRecord = createGenerationRecord(
      validation.request,
      "completed",
      null,
    );
    const persistedRecord = api.isTauriRuntime()
      ? await api.insertGeneration(completedRecord)
      : completedRecord;
    set((state) => ({
      currentGeneration: persistedRecord,
      history: [persistedRecord, ...state.history],
      generationState: {
        status: "completed",
        statusMessage: tr("status.previewCompletedShort"),
        error: null,
      },
    }));
  },
  cancelGeneration: async () => {
    if (api.isTauriRuntime()) {
      await api.cancelGeneration();
    }

    set({
      generationState: {
        status: "cancelled",
        statusMessage: tr("status.cancelled"),
        error: null,
      },
    });
  },
  loadGenerationSettings: (id, mode) => {
    const record = get().history.find((item) => item.id === id);
    if (!record) {
      return;
    }

    const nextForm: GenerationFormValues = {
      ...get().form,
      prompt: record.prompt,
      lyrics: record.lyrics,
      vocalLanguage: record.vocalLanguage,
      durationSeconds: String(Math.round(record.durationSeconds)),
      bpm: record.bpm === undefined ? "" : String(record.bpm),
      keyScale: record.keyScale ?? "",
      timeSignature: record.timeSignature,
      audioFormat: record.audioFormat,
      model: record.model ?? get().form.model,
      thinking: record.thinking,
      inferenceSteps: String(record.inferenceSteps),
      guidanceScale: String(record.guidanceScale),
      useRandomSeed: mode === "reproduce" ? false : record.useRandomSeed,
      seed:
        mode === "reproduce" && record.seed !== undefined
          ? String(record.seed)
          : record.useRandomSeed
            ? ""
            : (record.seed?.toString() ?? ""),
    };

    set({
      form: nextForm,
      currentGeneration: record,
      ...computeValidationState(nextForm),
      generationState: IDLE_GENERATION_STATE,
    });
  },
  deleteGenerationRecord: async (id) => {
    if (api.isTauriRuntime()) {
      await api.deleteGeneration(id);
    }

    set((state) => {
      const nextHistory = state.history.filter((record) => record.id !== id);
      return {
        history: nextHistory,
        currentGeneration:
          state.currentGeneration?.id === id
            ? (nextHistory[0] ?? null)
            : state.currentGeneration,
      };
    });
  },
  resetForm: () => {
    set({
      form: DEFAULT_GENERATION_FORM_VALUES,
      validationErrors: {},
      currentRequest: validateGenerationForm(DEFAULT_GENERATION_FORM_VALUES).request,
      generationState: IDLE_GENERATION_STATE,
    });
  },
}));
