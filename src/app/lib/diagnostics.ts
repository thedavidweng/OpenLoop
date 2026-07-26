import { invoke } from "@tauri-apps/api/core";
import { writeText as writeClipboardText } from "@tauri-apps/plugin-clipboard-manager";

export interface DiagnosticsBundle {
  appVersion: string;
  os: string;
  arch: string;
  isAppleSilicon: boolean;
  totalMemoryGb: number;
  buildSha?: string;
  appLogDir?: string;
  // Present only on older backends; removed once the camelCase migration lands.
  tauriVersion?: string;
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

/**
 * Render the backend status enum as a short human-readable string.
 * The Rust side tags the enum with a snake_case `state` field.
 */
export function formatBackendStatus(status: unknown): string {
  if (status && typeof status === "object" && "state" in status) {
    const value = status as { state?: unknown; port?: unknown };
    const state = String(value.state);
    return typeof value.port === "number" ? `${state} (port ${value.port})` : state;
  }
  return typeof status === "string" ? status : "unknown";
}

/**
 * Render a diagnostics bundle as fixed-English plain text suitable for pasting
 * into a bug report.
 *
 * The text is intentionally NOT localized: a maintainer triaging an issue should
 * read the same labels regardless of the reporter's app language. The
 * Settings → About section localizes its own on-screen labels separately.
 */
export function formatDiagnosticsText(
  bundle: DiagnosticsBundle | null,
  packageVersion: string,
): string {
  if (!bundle) {
    return [
      "OpenLoop debug info",
      `Version: ${packageVersion}`,
      "Diagnostics are only available in the desktop app.",
    ].join("\n");
  }

  return [
    "OpenLoop debug info",
    `Version: ${bundle.appVersion} (package ${packageVersion})`,
    `Build: ${bundle.buildSha ?? "unknown"}`,
    `OS: ${bundle.os} ${bundle.arch}${bundle.isAppleSilicon ? " (Apple Silicon)" : ""}`,
    `Memory: ${bundle.totalMemoryGb} GB`,
    `Backend: ${formatBackendStatus(bundle.backendStatus)}`,
    `Log directory: ${bundle.appLogDir ?? "unknown"}`,
  ].join("\n");
}

interface CopyDebugInfoDependencies {
  fetchDiagnostics?: () => Promise<DiagnosticsBundle | null>;
  writeText?: (text: string) => Promise<void>;
  packageVersion?: string;
}

/**
 * Fetch the current diagnostics and copy their plain-text form to the clipboard.
 *
 * Shared by the Settings → About button and the app menu's "Copy Debug Info" so
 * both surfaces produce byte-identical output from one code path.
 */
export async function copyDebugInfo({
  // The clipboard-manager plugin writes from the Rust side, so the copy also
  // works when triggered from a native menu event — a path with no transient
  // user activation, where navigator.clipboard can silently refuse.
  fetchDiagnostics = collectDiagnostics,
  writeText = writeClipboardText,
  packageVersion = import.meta.env.PACKAGE_VERSION,
}: CopyDebugInfoDependencies = {}): Promise<void> {
  const bundle = await fetchDiagnostics();
  await writeText(formatDiagnosticsText(bundle, packageVersion));
}
