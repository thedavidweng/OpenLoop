export type TimeSignature = "2" | "3" | "4" | "6";

export type AudioFormat = "wav" | "mp3" | "flac" | "ogg";
export type BpmMode = "auto" | "manual";

export type RecommendedProfile =
  | "low-memory"
  | "standard"
  | "quality"
  | "unsupported";

export type ModelVariant = "lite" | "turbo" | "pro";
export type TaskType =
  | "text2music"
  | "cover"
  | "repaint"
  | "lego"
  | "extract"
  | "complete";
export type LmBackend = "pt" | "vllm" | "mlx";

export type GenerationRequest = {
  prompt: string;
  negativePrompt?: string;
  lyrics: string;
  vocalLanguage: string;
  durationSeconds: number;
  bpm?: number;
  keyScale?: string;
  timeSignature: TimeSignature;
  audioFormat: AudioFormat;
  model?: string;
  taskType: TaskType;
  lmModelPath?: string;
  lmBackend?: LmBackend;
  thinking: boolean;
  inferenceSteps: number;
  guidanceScale: number;
  useFormat: boolean;
  useCotCaption: boolean;
  useCotLanguage: boolean;
  constrainedDecoding: boolean;
  referenceAudioPath?: string;
  srcAudioPath?: string;
  instruction?: string;
  repaintingStart?: number;
  repaintingEnd?: number;
  audioCoverStrength?: number;
  useRandomSeed: boolean;
  seed?: number;
  variationCount: number;
};

export type GenerationFormValues = {
  prompt: string;
  negativePrompt: string;
  lyrics: string;
  vocalLanguage: string;
  durationSeconds: string;
  bpmMode: BpmMode;
  bpm: string;
  keyScale: string;
  timeSignature: TimeSignature;
  audioFormat: AudioFormat;
  model: string;
  taskType: TaskType;
  lmModelPath: string;
  lmBackend: LmBackend;
  thinking: boolean;
  inferenceSteps: string;
  guidanceScale: string;
  useFormat: boolean;
  useCotCaption: boolean;
  useCotLanguage: boolean;
  constrainedDecoding: boolean;
  referenceAudioPath: string;
  srcAudioPath: string;
  instruction: string;
  repaintingStart: string;
  repaintingEnd: string;
  audioCoverStrength: string;
  useRandomSeed: boolean;
  seed: string;
  instrumental: boolean;
  variations: number;
};

export type ValidationField =
  | "prompt"
  | "negativePrompt"
  | "lyrics"
  | "durationSeconds"
  | "bpm"
  | "inferenceSteps"
  | "guidanceScale"
  | "repaintingStart"
  | "repaintingEnd"
  | "audioCoverStrength"
  | "seed";

export type ValidationErrors = Partial<Record<ValidationField, string>>;

export type AppError = {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
};

export type GenerationRecordStatus = "completed" | "failed" | "cancelled";

export type GenerationRecord = {
  id: string;
  createdAt: string;
  prompt: string;
  negativePrompt?: string;
  lyrics: string;
  vocalLanguage: string;
  durationSeconds: number;
  bpm?: number;
  keyScale?: string;
  timeSignature: TimeSignature;
  model?: string;
  taskType: TaskType;
  lmModelPath?: string;
  lmBackend?: LmBackend;
  thinking: boolean;
  inferenceSteps: number;
  guidanceScale: number;
  useFormat: boolean;
  useCotCaption: boolean;
  useCotLanguage: boolean;
  constrainedDecoding: boolean;
  referenceAudioPath?: string;
  srcAudioPath?: string;
  instruction?: string;
  repaintingStart?: number;
  repaintingEnd?: number;
  audioCoverStrength?: number;
  useRandomSeed: boolean;
  seed?: number;
  audioFormat: AudioFormat;
  outputPath: string | null;
  status: GenerationRecordStatus;
  errorMessage: string | null;
  generationInfo?: string;
};

export type GenerationRunResult = {
  records: GenerationRecord[];
};

export type GenerationStatus =
  | "idle"
  | "validating"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type GenerationPhase =
  | "idle"
  | "validating"
  | "backend_starting"
  | "submitted"
  | "queued"
  | "running"
  | "downloading"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovering";

export type GenerationState = {
  status: GenerationStatus;
  phase: GenerationPhase;
  statusMessage: string;
  error: AppError | null;
  taskId?: string;
  variationCurrent?: number;
  variationTotal?: number;
  progressPercent?: number;
};

export type AppSettings = {
  profile: RecommendedProfile;
  modelVariant: ModelVariant | null;
  downloadedModels: ModelVariant[];
  outputDirectory: string | null;
  backendPort: number;
  defaultDurationSeconds: number;
  defaultAudioFormat: AudioFormat;
  defaultThinking: boolean;
  firstRunCompleted: boolean;
  language?: string | null;
  modelDirectory?: string | null;
  backendWorkingDirectory?: string | null;
  logDirectory?: string | null;
};

export type DeviceInfo = {
  os: string;
  arch: string;
  isAppleSilicon: boolean;
  totalMemoryGb: number;
  recommendedProfile: RecommendedProfile;
  cpuBrand?: string | null;
};

export type GenerationEvent =
  | {
      type: "backend_starting";
      variationCurrent?: number;
      variationTotal?: number;
    }
  | {
      type: "submitted";
      taskId: string;
      variationCurrent?: number;
      variationTotal?: number;
    }
  | { type: "queued"; variationCurrent?: number; variationTotal?: number }
  | {
      type: "running";
      variationCurrent?: number;
      variationTotal?: number;
      progressPercent?: number;
    }
  | { type: "downloading"; variationCurrent?: number; variationTotal?: number }
  | {
      type: "completed";
      generationId: string;
      outputPath: string;
      variationCurrent?: number;
      variationTotal?: number;
    }
  | {
      type: "cancelled";
      generationId: string;
      variationCurrent?: number;
      variationTotal?: number;
    }
  | { type: "failed"; error: AppError };

export type ActiveGenerationTask = {
  id: string;
  taskId: string;
  request: GenerationRequest;
  variationIndex: number;
  variationTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type PromptEnhancementResult = {
  prompt: string;
  lyrics?: string;
  bpm?: number;
  keyScale?: string;
  timeSignature?: TimeSignature;
  durationSeconds?: number;
  vocalLanguage?: string;
};

export type GenerationWaveform = {
  peaks: number[];
};

export type BackendStatus =
  | { state: "stopped" }
  | { state: "starting" }
  | { state: "healthy"; port: number }
  | { state: "failed"; error: AppError };

export type ModelBootstrapStatus =
  | { state: "pending"; message: string }
  | {
      state: "downloading";
      message: string;
      downloadedBytes?: number;
      totalBytes?: number;
    }
  | { state: "ready"; message: string }
  | { state: "experimental"; message: string }
  | { state: "failed"; message: string; error?: AppError | null };

export type ModelDownloadState =
  | "not_installed"
  | "downloading"
  | "ready"
  | "failed";

export type ModelStatusSnapshot = {
  variant: ModelVariant;
  state: ModelDownloadState;
  modelName: string;
  label: string;
  description: string;
  downloadedBytes: number;
  totalBytes?: number | null;
  installedAt?: string | null;
  error?: AppError | null;
};

export type ModelCatalogItem = {
  variant: ModelVariant;
  label: string;
  modelName: string;
  lmModel?: string | null;
  lmBackend: LmBackend;
  estimatedSizeBytes: number;
  description: string;
  recommendedMemoryGb: number;
};

export type WindowShellChromeVariant = "desktop" | "mac";
export type WindowShellTier = "desktop" | "mac";

export type WindowShellStateSnapshot = {
  chrome_variant: WindowShellChromeVariant;
  tier: WindowShellTier;
  toolbar_height: number;
  traffic_light_inset_leading: number;
  sidebar_header_height: number;
  sidebar_width: number;
};

export type ValidationResult = {
  isValid: boolean;
  request: GenerationRequest | null;
  errors: ValidationErrors;
};
