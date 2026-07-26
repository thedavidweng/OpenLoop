import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppSettings,
  ActiveGenerationTask,
  BackendProvisionStatus,
  BackendStatus,
  DeviceInfo,
  FailedRun,
  GenerationEvent,
  GenerationRunResult,
  GenerationWaveform,
  ModelCatalogItem,
  ModelStatusSnapshot,
  GenerationRecord,
  GenerationRequest,
  GenerationProfile,
  CreateProfileRequest,
  ModelVariant,
  Project,
  PromptEnhancementResult,
  WindowShellStateSnapshot,
} from "@/app/lib/types";

export type DefaultAppPaths = {
  outputDirectory: string;
  modelDirectory: string;
  logDirectory: string;
};

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export function getDeviceInfo(): Promise<DeviceInfo> {
  return invoke<DeviceInfo>("get_device_info");
}

export function getWindowShellState(): Promise<WindowShellStateSnapshot> {
  return invoke<WindowShellStateSnapshot>("get_window_shell_state");
}

export function windowReady(): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }
  return invoke<void>("window_ready");
}

export function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<AppSettings> {
  return invoke<AppSettings>("set_setting", { key, value });
}

export function resetRuntimeSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("reset_runtime_settings");
}

export function getDefaultAppPaths(): Promise<DefaultAppPaths> {
  return invoke<DefaultAppPaths>("get_default_app_paths");
}

export function addCliToPath(): Promise<string> {
  return invoke<string>("add_cli_to_path");
}

export function removeCliFromPath(): Promise<string> {
  return invoke<string>("remove_cli_from_path");
}

export function isCliInPath(): Promise<boolean> {
  return invoke<boolean>("is_cli_in_path");
}

export async function selectDirectory(defaultPath?: string | null): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath ?? undefined,
  });
  return typeof selected === "string" ? selected : null;
}

export async function openFileDialog(options?: {
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | string[] | null> {
  return open({
    multiple: options?.multiple ?? false,
    filters: options?.filters,
  });
}

export function listGenerations(query?: string): Promise<GenerationRecord[]> {
  return invoke<GenerationRecord[]>("list_generations", {
    query: query?.trim() ? query : null,
  });
}

export function getGeneration(id: string): Promise<GenerationRecord | null> {
  return invoke<GenerationRecord | null>("get_generation", { id });
}

export function insertGeneration(record: GenerationRecord): Promise<GenerationRecord> {
  return invoke<GenerationRecord>("insert_generation", { record });
}

export function generateMusic(request: GenerationRequest): Promise<GenerationRunResult> {
  return invoke<GenerationRunResult>("generate_music", { request });
}

export function cancelGeneration(): Promise<void> {
  return invoke<void>("cancel_generation");
}

export function backendStatus(): Promise<BackendStatus> {
  return invoke<BackendStatus>("backend_status");
}

export function startBackend(): Promise<BackendStatus> {
  return invoke<BackendStatus>("start_backend");
}

export function stopBackend(): Promise<BackendStatus> {
  return invoke<BackendStatus>("stop_backend");
}

export function restartBackend(): Promise<BackendStatus> {
  return invoke<BackendStatus>("restart_backend");
}

export function getBackendLogsPath(): Promise<string | null> {
  return invoke<string | null>("get_backend_logs_path");
}

export function clearBackendCache(): Promise<void> {
  return invoke<void>("clear_backend_cache");
}

export function getBackendProvisionStatus(): Promise<BackendProvisionStatus> {
  return invoke<BackendProvisionStatus>("get_backend_provision_status");
}

export function provisionBackend(): Promise<BackendProvisionStatus> {
  return invoke<BackendProvisionStatus>("provision_backend");
}

export function checkBackendUpdates(): Promise<BackendProvisionStatus> {
  return invoke<BackendProvisionStatus>("check_backend_updates");
}

export function updateBackend(): Promise<BackendProvisionStatus> {
  return invoke<BackendProvisionStatus>("update_backend");
}

export function listenToBackendProvisionEvents(onEvent: (event: BackendProvisionStatus) => void) {
  return listen<BackendProvisionStatus>("backend-provision-progress", (event) => {
    onEvent(event.payload);
  });
}

export function listenToGenerationEvents(onEvent: (event: GenerationEvent) => void) {
  return listen<GenerationEvent>("generation-event", (event) => {
    onEvent(event.payload);
  });
}

export function listModelCatalog(): Promise<ModelCatalogItem[]> {
  return invoke<ModelCatalogItem[]>("list_model_catalog");
}

export function getModelStatus(): Promise<ModelStatusSnapshot[]> {
  return invoke<ModelStatusSnapshot[]>("get_model_status");
}

export function downloadModel(variant: ModelVariant): Promise<ModelStatusSnapshot> {
  return invoke<ModelStatusSnapshot>("download_model", { variant });
}

export function deleteModel(variant: ModelVariant): Promise<ModelStatusSnapshot> {
  return invoke<ModelStatusSnapshot>("delete_model", { variant });
}

export function clearPartialDownloads(variant: ModelVariant): Promise<ModelStatusSnapshot> {
  return invoke<ModelStatusSnapshot>("clear_partial_downloads", { variant });
}

export function cancelDownload(variant: ModelVariant): Promise<void> {
  return invoke<void>("cancel_download", { variant });
}

export function deleteAllModels(): Promise<ModelStatusSnapshot[]> {
  return invoke<ModelStatusSnapshot[]>("delete_all_models");
}

export function listenToModelDownloadEvents(onEvent: (event: ModelStatusSnapshot) => void) {
  return listen<ModelStatusSnapshot>("model-download-progress", (event) => {
    onEvent(event.payload);
  });
}

export function revealInFinder(path: string): Promise<void> {
  return invoke<void>("reveal_in_finder", { path });
}

export function copyAudioTo(path: string, destination: string): Promise<string> {
  return invoke<string>("copy_audio_to", { path, destination });
}

export function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>("file_exists", { path });
}

export function deleteGenerationFile(path: string): Promise<void> {
  return invoke<void>("delete_generation_file", { path });
}

export function deleteGenerationFileAndRecord(id: string): Promise<void> {
  return invoke<void>("delete_generation_file_and_record", { id });
}

export function readGenerationAudio(id: string): Promise<ArrayBuffer | number[]> {
  return invoke<ArrayBuffer | number[]>("read_generation_audio", { id });
}

export function deleteGeneration(id: string): Promise<void> {
  return invoke<void>("delete_generation", { id });
}

export function clearGenerationHistory(): Promise<void> {
  return invoke<void>("clear_generation_history");
}

export function enhancePrompt(request: GenerationRequest): Promise<PromptEnhancementResult> {
  return invoke<PromptEnhancementResult>("enhance_prompt", { request });
}

export function listActiveGenerationTasks(): Promise<ActiveGenerationTask[]> {
  return invoke<ActiveGenerationTask[]>("list_active_generation_tasks");
}

export function resumeGenerationTask(id: string): Promise<GenerationRecord> {
  return invoke<GenerationRecord>("resume_generation_task", { id });
}

export function discardActiveGenerationTask(id: string): Promise<void> {
  return invoke<void>("discard_active_generation_task", { id });
}

export function toggleGenerationFavorite(id: string): Promise<boolean> {
  return invoke<boolean>("toggle_generation_favorite", { id });
}

export function readGenerationWaveform(id: string): Promise<GenerationWaveform> {
  return invoke<GenerationWaveform>("read_generation_waveform", { id });
}

export function listFailedRuns(limit: number): Promise<FailedRun[]> {
  return invoke<FailedRun[]>("list_failed_runs", { limit });
}

export function clearFailedRuns(): Promise<void> {
  return invoke<void>("clear_failed_runs");
}

export function deleteFailedRun(id: string): Promise<void> {
  return invoke<void>("delete_failed_run", { id });
}

export function listProjects(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

export function createProject(name: string): Promise<Project> {
  return invoke<Project>("create_project", { request: { name } });
}

export function renameProject(id: string, name: string): Promise<Project> {
  return invoke<Project>("rename_project", { id, request: { name } });
}

export function deleteProject(id: string): Promise<void> {
  return invoke<void>("delete_project", { id });
}

export function assignGenerationToProject(
  generationId: string,
  projectId: string | null,
): Promise<void> {
  return invoke<void>("assign_generation_to_project", {
    generationId,
    projectId,
  });
}

export function listProfiles(): Promise<GenerationProfile[]> {
  return invoke<GenerationProfile[]>("list_profiles");
}

export function createProfile(request: CreateProfileRequest): Promise<GenerationProfile> {
  return invoke<GenerationProfile>("create_profile", { request });
}

export function renameProfile(id: string, name: string): Promise<GenerationProfile> {
  return invoke<GenerationProfile>("rename_profile", { id, request: { name } });
}

export function deleteProfile(id: string): Promise<void> {
  return invoke<void>("delete_profile", { id });
}

export function exportGenerationsToFolder(ids: string[], destination: string): Promise<string[]> {
  return invoke<string[]>("export_generations_to_folder", { ids, destination });
}

export function prepareDragPayload(id: string): Promise<string> {
  return invoke<string>("prepare_drag_payload", { id });
}

export type NetworkEntry = {
  timestamp: string;
  url: string;
  method: string;
  status: number;
};

export function getNetworkLog(limit = 100): Promise<NetworkEntry[]> {
  return invoke<NetworkEntry[]>("get_network_log", { limit });
}

export type AppLogEntry = {
  timestamp: string;
  level: string;
  target: string;
  fields: unknown;
  raw: string;
};

export function getAppLogs(minLevel?: string, limit = 200): Promise<AppLogEntry[]> {
  return invoke<AppLogEntry[]>("get_app_logs", { minLevel, limit });
}
