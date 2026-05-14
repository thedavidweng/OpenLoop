import { invoke } from "@tauri-apps/api/core";

export interface DiagnosticsBundle {
  appVersion: string;
  os: string;
  arch: string;
  isAppleSilicon: boolean;
  totalMemoryGb: number;
  tauriVersion: string;
  backendStatus: unknown;
  recentErrors: string[] | null;
}

/**
 * Collect a diagnostics bundle from the Tauri backend.
 * Only available at runtime; no-op fallback outside Tauri.
 */
export async function collectDiagnostics(): Promise<DiagnosticsBundle | null> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return invoke<DiagnosticsBundle>("collect_diagnostics");
  }
  return null;
}

/**
 * Collect diagnostics and format as a pretty-printed JSON string.
 */
export async function formatDiagnostics(): Promise<string> {
  const data = await collectDiagnostics();
  if (!data) {
    return JSON.stringify(
      { error: "Diagnostics are only available in the Tauri runtime." },
      null,
      2,
    );
  }
  return JSON.stringify(data, null, 2);
}
