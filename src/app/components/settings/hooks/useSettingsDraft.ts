import { useEffect, useMemo, useState } from "react";
import * as api from "@/app/lib/api";
import type { AppSettings, AudioFormat, ModelStatusSnapshot } from "@/app/lib/types";

export type EditableSettingKey =
  | "outputDirectory"
  | "modelDirectory"
  | "backendPort"
  | "logDirectory"
  | "defaultDurationSeconds"
  | "defaultAudioFormat"
  | "defaultThinking"
  | "checkForUpdates";

export type DirectorySettingKey =
  | "outputDirectory"
  | "modelDirectory"
  | "logDirectory";

export interface SettingsDraft {
  outputDirectory: string;
  modelDirectory: string;
  backendPort: string;
  logDirectory: string;
  defaultDurationSeconds: string;
  defaultAudioFormat: AudioFormat;
  defaultThinking: boolean;
  checkForUpdates: boolean;
}

function draftFromSettings(settings: AppSettings): SettingsDraft {
  return {
    outputDirectory: settings.outputDirectory ?? "",
    modelDirectory: settings.modelDirectory ?? "",
    backendPort: String(settings.backendPort),
    logDirectory: settings.logDirectory ?? "",
    defaultDurationSeconds: String(settings.defaultDurationSeconds),
    defaultAudioFormat: settings.defaultAudioFormat,
    defaultThinking: settings.defaultThinking,
    checkForUpdates: settings.checkForUpdates ?? true,
  };
}

export function useSettingsDraft(
  settings: AppSettings,
  modelStatuses: ModelStatusSnapshot[],
  defaultPaths: api.DefaultAppPaths | null,
) {
  const [draft, setDraft] = useState<SettingsDraft>(() =>
    draftFromSettings(settings),
  );

  // Sync draft when settings change externally
  useEffect(() => {
    setDraft(draftFromSettings(settings));
  }, [
    settings.outputDirectory,
    settings.modelDirectory,
    settings.backendPort,
    settings.logDirectory,
    settings.defaultDurationSeconds,
    settings.defaultAudioFormat,
    settings.defaultThinking,
    settings.checkForUpdates,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    const s = settings;
    return (
      draft.outputDirectory !== (s.outputDirectory ?? "") ||
      draft.modelDirectory !== (s.modelDirectory ?? "") ||
      draft.backendPort !== String(s.backendPort) ||
      draft.logDirectory !== (s.logDirectory ?? "") ||
      draft.defaultDurationSeconds !== String(s.defaultDurationSeconds) ||
      draft.defaultAudioFormat !== s.defaultAudioFormat ||
      draft.defaultThinking !== s.defaultThinking ||
      draft.checkForUpdates !== (s.checkForUpdates ?? true)
    );
  }, [draft, settings]);

  const backendPortNumber = Number(draft.backendPort);
  const backendPortValid =
    Number.isInteger(backendPortNumber) &&
    backendPortNumber >= 1024 &&
    backendPortNumber <= 65535;

  const modelDirectoryLocked = modelStatuses.some(
    (status) => status.state === "downloading",
  );
  const modelDirectoryChanged =
    draft.modelDirectory !== (settings.modelDirectory ?? "");
  const showModelDirRestartHint = modelDirectoryLocked || modelDirectoryChanged;

  const configDir = useMemo(() => {
    if (!defaultPaths?.logDirectory) return null;
    const parts = defaultPaths.logDirectory.replace(/\/+$/, "").split("/");
    if (parts.length < 3) return null;
    return parts.slice(0, -2).join("/");
  }, [defaultPaths?.logDirectory]);

  const persistSetting = async <K extends EditableSettingKey>(
    key: K,
    value: AppSettings[K],
  ) => {
    await api.setSetting(key, value);
  };

  const pickDirectory = async (key: DirectorySettingKey) => {
    const selected = await api.selectDirectory(
      draft[key] ||
        (key === "outputDirectory"
          ? defaultPaths?.outputDirectory
          : key === "modelDirectory"
            ? defaultPaths?.modelDirectory
            : defaultPaths?.logDirectory) ||
        "",
    );
    if (!selected) return;
    setDraft((current) => ({ ...current, [key]: selected }));
  };

  const discardChanges = () => {
    setDraft(draftFromSettings(settings));
  };

  const saveChanges = async (): Promise<boolean> => {
    if (!backendPortValid) return false;

    await Promise.all([
      persistSetting(
        "outputDirectory",
        draft.outputDirectory || null,
      ),
      persistSetting(
        "modelDirectory",
        modelDirectoryLocked
          ? (settings.modelDirectory ?? null)
          : draft.modelDirectory || null,
      ),
      persistSetting("backendPort", Number(draft.backendPort)),
      persistSetting("logDirectory", draft.logDirectory || null),
      persistSetting(
        "defaultDurationSeconds",
        Number(draft.defaultDurationSeconds),
      ),
      persistSetting("defaultAudioFormat", draft.defaultAudioFormat),
      persistSetting("defaultThinking", draft.defaultThinking),
      persistSetting("checkForUpdates", draft.checkForUpdates),
    ]);

    return true;
  };

  return {
    draft,
    setDraft,
    hasUnsavedChanges,
    backendPortValid,
    modelDirectoryLocked,
    showModelDirRestartHint,
    configDir,
    pickDirectory,
    discardChanges,
    saveChanges,
  };
}
