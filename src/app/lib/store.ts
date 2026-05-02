import { create } from "zustand";
import * as api from "@/app/lib/api";
import {
  DEFAULT_GENERATION_FORM_VALUES,
  validateGenerationForm,
} from "@/app/lib/validation";
import {
  MODEL_PACKS,
  MODEL_VARIANTS,
  aggregatePackStatus,
  expandDownloadedVariantsFromStatuses,
  isModelDownloaded,
  packIdForVariant,
  primaryVariantForPack,
  profileForVariant,
} from "@/app/lib/model-packs";
import {
  PREVIEW_DELAY_MS,
  PROFILE_FORM_PRESETS,
  applyModelVariantToForm,
  applyProfilePreset,
  computeValidationState,
  createGenerationRecord,
  createIdleGenerationState,
  createModelRequiredError,
  createPreviewRuntimeError,
  createValidationError,
  localizeAppError,
  localizeModelStatuses,
  shouldPreviewFail,
  sleep,
  stringifyUnknownError,
  variationLabel,
} from "@/app/lib/store-helpers";
import {
  DEFAULT_APP_SETTINGS,
  createBootstrapRuntimeError,
  createDefaultBootstrapStatus,
  resolveModelBootstrapStatus,
  shouldMarkBootstrapFailed,
} from "@/app/lib/model-bootstrap";
import {
  INITIAL_CURRENT_REQUEST,
  mergeGenerationRecords,
  nextCurrentGenerationAfterDelete,
  recordToGenerationForm,
} from "@/app/lib/history-workflow";
import type {
  ActiveGenerationTask,
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
  ValidationErrors,
} from "@/app/lib/types";
import i18next, { detectSystemLanguage } from "@/app/lib/i18n";

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 260;

export {
  MODEL_PACKS,
  MODEL_VARIANTS,
  isModelDownloaded,
  modelDownloadStateForVariant,
  type ModelPackId,
} from "@/app/lib/model-packs";

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
  lyricsPanelOpen: boolean;
  form: GenerationFormValues;
  validationErrors: ValidationErrors;
  generationState: GenerationState;
  currentRequest: GenerationRequest | null;
  currentGeneration: GenerationRecord | null;
  history: GenerationRecord[];
  historyQuery: string;
  activeTasks: ActiveGenerationTask[];
  playbackToggleRequest: number;
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
  toggleLyricsPanel: () => void;
  hydrateFromPersistence: () => Promise<void>;
  runGeneration: () => Promise<void>;
  cancelGeneration: () => Promise<void>;
  enhancePrompt: () => Promise<void>;
  refreshActiveTasks: () => Promise<void>;
  resumeActiveTask: (id: string) => Promise<void>;
  discardActiveTask: (id: string) => Promise<void>;
  requestPlaybackToggle: () => void;
  loadGenerationSettings: (id: string, mode: "settings" | "reproduce") => void;
  deleteGenerationRecord: (
    id: string,
    options?: { alreadyDeleted?: boolean },
  ) => Promise<void>;
  clearGenerationHistory: () => Promise<void>;
  resetForm: () => void;
}

function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
}

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  hydrated: false,
  deviceInfo: null,
  bootstrapStatus: createDefaultBootstrapStatus(),
  modelCatalog: Object.values(MODEL_VARIANTS).map((variant) => ({
    variant: variant.id,
    label: variant.label,
    modelName: variant.modelName,
    lmModel:
      variant.id === "pro" ? "acestep-5Hz-lm-1.7B" : "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    estimatedSizeBytes:
      variant.id === "pro" ? 22 * 1024 * 1024 * 1024 : 8 * 1024 * 1024 * 1024,
    description: variant.description,
    recommendedMemoryGb:
      variant.id === "pro" ? 20 : variant.id === "lite" ? 8 : 16,
  })),
  modelStatuses: [],
  isSettingsOpen: false,
  sidebarVisible: true,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  setupOverride: false,
  lyricsPanelOpen: false,
  form: DEFAULT_GENERATION_FORM_VALUES,
  validationErrors: {},
  generationState: createIdleGenerationState(),
  currentRequest: INITIAL_CURRENT_REQUEST,
  currentGeneration: null,
  history: [],
  historyQuery: "",
  activeTasks: [],
  playbackToggleRequest: 0,
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
            phase: "backend_starting",
            statusMessage: `${tr("status.startingBackend")}${variationLabel(event)}`,
            error: null,
            variationCurrent: event.variationCurrent,
            variationTotal: event.variationTotal,
          },
        });
        break;
      case "submitted":
        set({
          generationState: {
            status: "running",
            phase: "submitted",
            statusMessage: `${tr("status.submittedTask", { taskId: event.taskId })}${variationLabel(event)}`,
            error: null,
            taskId: event.taskId,
            variationCurrent: event.variationCurrent,
            variationTotal: event.variationTotal,
          },
        });
        break;
      case "queued":
        set({
          generationState: {
            status: "running",
            phase: "queued",
            statusMessage: `${tr("status.queued")}${variationLabel(event)}`,
            error: null,
            variationCurrent: event.variationCurrent,
            variationTotal: event.variationTotal,
          },
        });
        break;
      case "running":
        set({
          generationState: {
            status: "running",
            phase: "running",
            statusMessage: `${tr("status.running")}${variationLabel(event)}`,
            error: null,
            variationCurrent: event.variationCurrent,
            variationTotal: event.variationTotal,
            progressPercent: event.progressPercent,
          },
        });
        break;
      case "downloading":
        set({
          generationState: {
            status: "running",
            phase: "downloading",
            statusMessage: `${tr("status.downloadingAudio")}${variationLabel(event)}`,
            error: null,
            variationCurrent: event.variationCurrent,
            variationTotal: event.variationTotal,
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
            phase: "completed",
            statusMessage: tr("status.completed"),
            error: null,
            variationCurrent: event.variationCurrent,
            variationTotal: event.variationTotal,
          },
        });
        break;
      case "cancelled":
        set({
          generationState: {
            status: "cancelled",
            phase: "cancelled",
            statusMessage: tr("status.cancelled"),
            error: null,
            variationCurrent: event.variationCurrent,
            variationTotal: event.variationTotal,
          },
        });
        break;
      case "failed":
        {
          const error = localizeAppError(event.error);
          set({
            bootstrapStatus: shouldMarkBootstrapFailed(error.code)
              ? {
                  state: "failed",
                  message: error.message,
                  error,
                }
              : {
                  state: "ready",
                  message: tr("status.localStackReady"),
                },
            generationState: {
              status: "failed",
              phase: "failed",
              statusMessage: tr("status.failed"),
              error,
            },
          });
        }
        break;
    }
  },
  completeSetup: async () => {
    const profile =
      get().deviceInfo?.recommendedProfile ?? get().settings.profile;
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
        message: tr("status.modelReady", { model: MODEL_PACKS[packId].label }),
      },
    });
  },
  deleteModelVariant: async (variant) => {
    const packId = packIdForVariant(variant);
    const deleteTarget = primaryVariantForPack(packId);
    if (api.isTauriRuntime()) {
      const statuses = await api.deleteModel(deleteTarget);
      const nextDownloadedModels =
        expandDownloadedVariantsFromStatuses(statuses);
      const currentSelected = get().settings.modelVariant;
      const nextSelected =
        currentSelected &&
        MODEL_PACKS[packId].variants.includes(currentSelected)
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
    const [modelCatalog, rawModelStatuses] = await Promise.all([
      api.listModelCatalog(),
      api.getModelStatus(),
    ]);
    const modelStatuses = localizeModelStatuses(rawModelStatuses);
    const downloadedModels =
      expandDownloadedVariantsFromStatuses(modelStatuses);
    set((state) => ({
      modelCatalog,
      modelStatuses,
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
          modelVariant:
            state.settings.modelVariant &&
            downloadedModels.includes(state.settings.modelVariant)
              ? state.settings.modelVariant
              : state.settings.modelVariant,
        },
        state.deviceInfo,
        modelStatuses,
      ),
    }));
  },
  applyModelStatus: (status) => {
    set((state) => {
      const modelStatuses = [
        ...state.modelStatuses.filter(
          (current) => current.variant !== status.variant,
        ),
        {
          ...status,
          error: status.error ? localizeAppError(status.error) : status.error,
        },
      ];
      const downloadedModels =
        expandDownloadedVariantsFromStatuses(modelStatuses);
      const selectedPack = state.settings.modelVariant
        ? packIdForVariant(state.settings.modelVariant)
        : null;
      const eventPack = packIdForVariant(status.variant);
      const packAggregate = aggregatePackStatus(modelStatuses, eventPack);
      const nextSettings = {
        ...state.settings,
        downloadedModels,
      };
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
              ),
      };
    });
  },
  setLanguage: async (language) => {
    await i18next.changeLanguage(language);
    if (api.isTauriRuntime()) {
      await api.setSetting("language", language);
    }
    set((state) => {
      const settings = {
        ...state.settings,
        language,
      };
      const modelStatuses = localizeModelStatuses(state.modelStatuses);
      return {
        settings,
        modelStatuses,
        generationState:
          state.generationState.status === "idle"
            ? createIdleGenerationState()
            : state.generationState,
        bootstrapStatus: resolveModelBootstrapStatus(
          settings,
          state.deviceInfo,
          modelStatuses,
        ),
      };
    });
  },
  openSettings: () => {
    set({ isSettingsOpen: true });
  },
  reopenSetup: () => {
    set({ setupOverride: true, isSettingsOpen: false });
  },
  refreshBootstrapStatus: async () => {
    const bootstrapStatus = await resolveModelBootstrapStatus(
      get().settings,
      get().deviceInfo,
      get().modelStatuses,
    );
    set({ bootstrapStatus });
  },
  selectModelVariant: async (variant) => {
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
  setField: (field, value) => {
    const nextForm: GenerationFormValues = {
      ...get().form,
      [field]: value,
    };
    if (field === "thinking" && value === false) {
      nextForm.useCotCaption = false;
      nextForm.useCotLanguage = false;
      nextForm.constrainedDecoding = false;
    }
    const nextValidation = computeValidationState(nextForm);
    set({
      form: nextForm,
      ...nextValidation,
      generationState:
        get().generationState.status === "running" ||
        get().generationState.status === "validating"
          ? get().generationState
          : createIdleGenerationState(),
    });
  },
  selectGenerationRecord: (id) => {
    set((state) => ({
      currentGeneration:
        state.history.find((record) => record.id === id) ??
        state.currentGeneration,
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
  toggleLyricsPanel: () => {
    set({ lyricsPanelOpen: !get().lyricsPanelOpen });
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
      ] = await Promise.all([
        api.getSettings(),
        api.listGenerations(),
        api.getDeviceInfo(),
        api.listModelCatalog(),
        api.getModelStatus(),
        api.listActiveGenerationTasks(),
      ]);

      const profile = persistedSettings.firstRunCompleted
        ? persistedSettings.profile
        : deviceInfo.recommendedProfile;
      const mergedSettings = {
        ...get().settings,
        ...persistedSettings,
        profile,
        defaultThinking: PROFILE_FORM_PRESETS[profile].thinking,
        downloadedModels:
          expandDownloadedVariantsFromStatuses(rawModelStatuses),
      };
      const language = mergedSettings.language ?? detectSystemLanguage();
      await i18next.changeLanguage(language);
      const modelStatuses = localizeModelStatuses(rawModelStatuses);
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
        ...computeValidationState(nextForm, { showErrors: false }),
        generationState: createIdleGenerationState(),
        history: persistedHistory,
        activeTasks,
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
          phase: "failed",
          statusMessage: tr("status.persistenceHydrationFailed"),
          error: {
            code: "PERSISTENCE_HYDRATION_FAILED",
            message: tr("errors.persistenceHydrationFailed"),
            details: stringifyUnknownError(error),
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
        phase: "validating",
        statusMessage: tr("status.validating"),
        error: null,
      },
    });

    await sleep(PREVIEW_DELAY_MS.validating);

    if (!validation.isValid || validation.request === null) {
      set({
        generationState: {
          status: "failed",
          phase: "failed",
          statusMessage: tr("status.validationFailed"),
          error: createValidationError(tr("errors.requestNotReady")),
        },
      });
      return;
    }

    if (!isModelDownloaded(get().settings, get().settings.modelVariant)) {
      set({
        generationState: {
          status: "failed",
          phase: "failed",
          statusMessage: tr("status.downloadBeforeGenerating"),
          error: createModelRequiredError(),
        },
      });
      return;
    }

    if (api.isTauriRuntime()) {
      try {
        const result = await api.generateMusic(validation.request);
        const persistedRecords = result.records;
        const latestRecord =
          persistedRecords[persistedRecords.length - 1] ?? null;
        set((state) => ({
          currentGeneration: latestRecord ?? state.currentGeneration,
          history: mergeGenerationRecords(persistedRecords, state.history),
          generationState: {
            status: persistedRecords.length === 0 ? "cancelled" : "completed",
            phase: persistedRecords.length === 0 ? "cancelled" : "completed",
            statusMessage:
              persistedRecords.length === 0
                ? tr("status.cancelled")
                : tr("status.completed"),
            error: null,
          },
        }));
        await get().refreshBootstrapStatus();
      } catch (error) {
        const appError = localizeAppError(error);
        set({
          bootstrapStatus: shouldMarkBootstrapFailed(appError.code)
            ? {
                state: "failed",
                message: appError.message,
                error: appError,
              }
            : {
                state: "ready",
                message: tr("status.localStackReady"),
              },
          generationState: {
            status: "failed",
            phase: "failed",
            statusMessage: tr("status.failed"),
            error: appError,
          },
        });
      }
      return;
    }

    set({
      generationState: {
        status: "running",
        phase: "running",
        statusMessage: tr("status.runningPreview"),
        error: null,
      },
    });

    await sleep(PREVIEW_DELAY_MS.running);

    if (shouldPreviewFail(validation.request)) {
      set({
        generationState: {
          status: "failed",
          phase: "failed",
          statusMessage: tr("status.previewFailedPrompt"),
          error: createPreviewRuntimeError(),
        },
      });
      return;
    }

    const completedRecord = createGenerationRecord(validation.request);
    const persistedRecord = api.isTauriRuntime()
      ? await api.insertGeneration(completedRecord)
      : completedRecord;
    set((state) => ({
      currentGeneration: persistedRecord,
      history: [persistedRecord, ...state.history],
      generationState: {
        status: "completed",
        phase: "completed",
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
        phase: "cancelled",
        statusMessage: tr("status.cancelled"),
        error: null,
      },
    });
  },
  enhancePrompt: async () => {
    const validation = validateGenerationForm(get().form);
    set({
      validationErrors: validation.errors,
      currentRequest: validation.request,
    });
    if (!validation.isValid || validation.request === null) {
      set({
        generationState: {
          status: "failed",
          phase: "failed",
          statusMessage: tr("status.validationFailed"),
          error: createValidationError(tr("errors.requestNotReady")),
        },
      });
      throw createValidationError(tr("errors.requestNotReady"));
    }
    const enhanced = await api.enhancePrompt(validation.request);
    const nextForm = {
      ...get().form,
      prompt: enhanced.prompt || get().form.prompt,
      lyrics: enhanced.lyrics ?? get().form.lyrics,
      bpmMode: enhanced.bpm === undefined ? get().form.bpmMode : "manual",
      bpm: enhanced.bpm === undefined ? get().form.bpm : String(enhanced.bpm),
      keyScale: enhanced.keyScale ?? get().form.keyScale,
      timeSignature: enhanced.timeSignature ?? get().form.timeSignature,
      durationSeconds:
        enhanced.durationSeconds === undefined
          ? get().form.durationSeconds
          : String(enhanced.durationSeconds),
      vocalLanguage: enhanced.vocalLanguage ?? get().form.vocalLanguage,
    } satisfies GenerationFormValues;
    set({
      form: nextForm,
      ...computeValidationState(nextForm, { showErrors: false }),
      generationState: createIdleGenerationState(),
    });
  },
  refreshActiveTasks: async () => {
    if (!api.isTauriRuntime()) {
      return;
    }
    const activeTasks = await api.listActiveGenerationTasks();
    set({ activeTasks });
  },
  resumeActiveTask: async (id) => {
    set({
      generationState: {
        status: "running",
        phase: "recovering",
        statusMessage: tr("status.recovering"),
        error: null,
      },
    });
    try {
      const record = await api.resumeGenerationTask(id);
      set((state) => ({
        activeTasks: state.activeTasks.filter((task) => task.id !== id),
        currentGeneration: record,
        history: [
          record,
          ...state.history.filter((item) => item.id !== record.id),
        ],
        generationState: {
          status: "completed",
          phase: "completed",
          statusMessage: tr("status.completed"),
          error: null,
        },
      }));
    } catch (error) {
      const appError = localizeAppError(error);
      set({
        generationState: {
          status: "failed",
          phase: "failed",
          statusMessage: tr("status.recoveryFailed"),
          error: appError,
        },
      });
    }
  },
  discardActiveTask: async (id) => {
    if (api.isTauriRuntime()) {
      await api.discardActiveGenerationTask(id);
    }
    set((state) => ({
      activeTasks: state.activeTasks.filter((task) => task.id !== id),
    }));
  },
  requestPlaybackToggle: () => {
    set((state) => ({
      playbackToggleRequest: state.playbackToggleRequest + 1,
    }));
  },
  loadGenerationSettings: (id, mode) => {
    const record = get().history.find((item) => item.id === id);
    if (!record) {
      return;
    }

    const nextForm = recordToGenerationForm(get().form, record, mode);

    set({
      form: nextForm,
      currentGeneration: record,
      ...computeValidationState(nextForm),
      generationState: createIdleGenerationState(),
    });
  },
  deleteGenerationRecord: async (id, options = {}) => {
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
    });
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
}));
