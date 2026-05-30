import type {
  ActiveGenerationTask,
  AppSettings,
  BackendProvisionStatus,
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

export interface GenerationStore {
  hydrated: boolean;
  deviceInfo: DeviceInfo | null;
  bootstrapStatus: ModelBootstrapStatus;
  modelCatalog: ModelCatalogItem[];
  modelStatuses: ModelStatusSnapshot[];
  backendProvisionStatus: BackendProvisionStatus;
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
  recentPrompts: string[];
  favoritePrompts: string[];
  favoriteRecordIds: string[];
  lastDeletedRecord: GenerationRecord | null;
  demoMode: boolean;
  selectedHistoryIds: string[];
  compareModeActive: boolean;
  compareGenerationId: string | null;

  applyGenerationEvent: (event: GenerationEvent) => void;
  completeSetup: () => Promise<void>;
  closeSetup: () => void;
  closeSettings: () => void;
  downloadModelVariant: (variant: ModelVariant) => Promise<void>;
  deleteModelVariant: (variant: ModelVariant) => Promise<void>;
  cancelModelDownload: (variant: ModelVariant) => Promise<void>;
  clearPartialModelDownloads: (variant: ModelVariant) => Promise<void>;
  deleteAllModels: () => Promise<void>;
  refreshModelStatuses: () => Promise<void>;
  applyModelStatus: (status: ModelStatusSnapshot) => void;
  refreshBackendProvisionStatus: () => Promise<void>;
  provisionBackend: () => Promise<void>;
  updateBackend: () => Promise<void>;
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
    options?: { alreadyDeleted?: boolean; undoable?: boolean },
  ) => Promise<void>;
  clearGenerationHistory: () => Promise<void>;
  resetForm: () => void;
  addRecentPrompt: (prompt: string) => void;
  toggleFavoritePrompt: (prompt: string) => void;
  removeRecentPrompt: (prompt: string) => void;
  toggleFavoriteRecord: (id: string) => Promise<void>;
  restoreLastDeletedRecord: () => void;
  enterDemoMode: () => void;
  dismissDemoMode: () => void;
  toggleSelectHistory: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  batchDeleteSelected: () => Promise<void>;
  batchFavoriteSelected: () => Promise<void>;
  enterCompareMode: (id: string) => void;
  exitCompareMode: () => void;
  toggleCompareTarget: () => void;
}
