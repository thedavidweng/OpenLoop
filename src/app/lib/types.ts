export type TimeSignature = "2" | "3" | "4" | "6";

export type AudioFormat = "wav" | "mp3" | "flac" | "ogg";

export type RecommendedProfile =
  | "low-memory"
  | "standard"
  | "quality"
  | "unsupported";

export type ModelVariant = "lite" | "turbo" | "pro";
export type TaskType = "text2music" | "cover" | "repaint" | "lego" | "extract" | "complete";
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
};

export type GenerationFormValues = {
  prompt: string;
  negativePrompt: string;
  lyrics: string;
  vocalLanguage: string;
  durationSeconds: string;
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

export type GenerationStatus =
  | "idle"
  | "validating"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type GenerationState = {
  status: GenerationStatus;
  statusMessage: string;
  error: AppError | null;
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
  backendCommandPath?: string | null;
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
  | { type: "backend_starting" }
  | { type: "submitted"; taskId: string }
  | { type: "queued" }
  | { type: "running" }
  | { type: "downloading" }
  | { type: "completed"; generationId: string; outputPath: string }
  | { type: "cancelled"; generationId: string }
  | { type: "failed"; error: AppError };

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
