import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppSettings,
  BackendStatus,
  DeviceInfo,
  GenerationEvent,
  ModelCatalogItem,
  ModelStatusSnapshot,
  GenerationRecord,
  GenerationRequest,
  ModelVariant,
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

export async function selectDirectory(defaultPath?: string | null): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath ?? undefined,
  });
  return typeof selected === "string" ? selected : null;
}

export function listGenerations(query?: string): Promise<GenerationRecord[]> {
  return invoke<GenerationRecord[]>("list_generations", {
    query: query?.trim() ? query : null,
  });
}

export function getGeneration(id: string): Promise<GenerationRecord | null> {
  return invoke<GenerationRecord | null>("get_generation", { id });
}

export function insertGeneration(
  record: GenerationRecord,
): Promise<GenerationRecord> {
  return invoke<GenerationRecord>("insert_generation", { record });
}

export function generateMusic(
  request: GenerationRequest,
): Promise<GenerationRecord> {
  return invoke<GenerationRecord>("generate_music", { request });
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

export function listenToGenerationEvents(
  onEvent: (event: GenerationEvent) => void,
) {
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

export function deleteModel(variant: ModelVariant): Promise<ModelStatusSnapshot[]> {
  return invoke<ModelStatusSnapshot[]>("delete_model", { variant });
}

export function listenToModelDownloadEvents(
  onEvent: (event: ModelStatusSnapshot) => void,
) {
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

export function toFileUrl(path: string) {
  return convertFileSrc(path);
}

export function deleteGeneration(id: string): Promise<void> {
  return invoke<void>("delete_generation", { id });
}
