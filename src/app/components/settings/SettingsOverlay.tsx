import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Terminal, X } from "lucide-react";
import { SettingsDialogHost } from "@/app/components/settings/SettingsDialogHost";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { useToast } from "@/app/components/overlay/Toast";
import {
  MODEL_PACKS,
  aggregatePackStatus,
  packIdForVariant,
  primaryVariantForPack,
  type ModelPackId,
} from "@/app/lib/model-packs";
import { useGenerationStore } from "@/app/lib/store";
import * as api from "@/app/lib/api";
import { SUPPORTED_LANGUAGES } from "@/app/lib/i18n";
import type { AppSettings, ModelVariant } from "@/app/lib/types";
import { DirectoryPickerRow } from "./SettingsOverlay/DirectoryPickerRow";
import { ModelPackCard } from "./SettingsOverlay/ModelPackCard";
import { ModelVariantCard } from "./SettingsOverlay/ModelVariantCard";

type EditableSettingKey =
  | "outputDirectory"
  | "modelDirectory"
  | "backendPort"
  | "logDirectory"
  | "defaultDurationSeconds"
  | "defaultAudioFormat"
  | "defaultThinking"
  | "checkForUpdates";

type DirectorySettingKey =
  | "outputDirectory"
  | "modelDirectory"
  | "logDirectory";

export function SettingsOverlay() {
  const { i18n, t } = useTranslation();
  const { addToast } = useToast();
  const settings = useGenerationStore((state) => state.settings);
  const modelStatuses = useGenerationStore((state) => state.modelStatuses);
  const closeSettings = useGenerationStore((state) => state.closeSettings);
  const hydrateFromPersistence = useGenerationStore(
    (state) => state.hydrateFromPersistence,
  );
  const history = useGenerationStore((state) => state.history);
  const clearGenerationHistory = useGenerationStore(
    (state) => state.clearGenerationHistory,
  );
  const downloadModelVariant = useGenerationStore(
    (state) => state.downloadModelVariant,
  );
  const deleteModelVariant = useGenerationStore(
    (state) => state.deleteModelVariant,
  );
  const cancelModelDownload = useGenerationStore(
    (state) => state.cancelModelDownload,
  );
  const clearPartialModelDownloads = useGenerationStore(
    (state) => state.clearPartialModelDownloads,
  );
  const deleteAllModels = useGenerationStore((state) => state.deleteAllModels);
  const refreshModelStatuses = useGenerationStore(
    (state) => state.refreshModelStatuses,
  );
  const reopenSetup = useGenerationStore((state) => state.reopenSetup);
  const selectModelVariant = useGenerationStore(
    (state) => state.selectModelVariant,
  );
  const setLanguage = useGenerationStore((state) => state.setLanguage);
  const [busyVariant, setBusyVariant] = useState<ModelVariant | null>(null);
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);
  const [clearCacheConfirmOpen, setClearCacheConfirmOpen] = useState(false);
  const [deleteAllModelsConfirmOpen, setDeleteAllModelsConfirmOpen] =
    useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [cliPathStatus, setCliPathStatus] = useState<
    "loading" | "added" | "not_added" | "error"
  >("loading");
  const [cliPathError, setCliPathError] = useState<string | null>(null);
  const [defaultPaths, setDefaultPaths] = useState<api.DefaultAppPaths | null>(
    null,
  );
  const [draft, setDraft] = useState({
    outputDirectory: settings.outputDirectory ?? "",
    modelDirectory: settings.modelDirectory ?? "",
    backendPort: String(settings.backendPort),
    logDirectory: settings.logDirectory ?? "",
    defaultDurationSeconds: String(settings.defaultDurationSeconds),
    defaultAudioFormat: settings.defaultAudioFormat,
    defaultThinking: settings.defaultThinking,
    checkForUpdates: settings.checkForUpdates ?? true,
  });

  const hasUnsavedChanges = useMemo(() => {
    return (
      draft.outputDirectory !== (settings.outputDirectory ?? "") ||
      draft.modelDirectory !== (settings.modelDirectory ?? "") ||
      draft.backendPort !== String(settings.backendPort) ||
      draft.logDirectory !== (settings.logDirectory ?? "") ||
      draft.defaultDurationSeconds !== String(settings.defaultDurationSeconds) ||
      draft.defaultAudioFormat !== settings.defaultAudioFormat ||
      draft.defaultThinking !== settings.defaultThinking ||
      draft.checkForUpdates !== (settings.checkForUpdates ?? true)
    );
  }, [draft, settings]);

  useEffect(() => {
    setDraft({
      outputDirectory: settings.outputDirectory ?? "",
      modelDirectory: settings.modelDirectory ?? "",
      backendPort: String(settings.backendPort),
      logDirectory: settings.logDirectory ?? "",
      defaultDurationSeconds: String(settings.defaultDurationSeconds),
      defaultAudioFormat: settings.defaultAudioFormat,
      defaultThinking: settings.defaultThinking,
      checkForUpdates: settings.checkForUpdates ?? true,
    });
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

  useEffect(() => {
    void refreshModelStatuses();
  }, [refreshModelStatuses]);

  useEffect(() => {
    api
      .isCliInPath()
      .then((added) => setCliPathStatus(added ? "added" : "not_added"))
      .catch(() => setCliPathStatus("error"));
  }, []);

  useEffect(() => {
    if (!api.isTauriRuntime()) {
      setDefaultPaths({
        outputDirectory: "~/Music/OpenLoop",
        modelDirectory:
          "~/Library/Application Support/OpenLoop/models/checkpoints",
        logDirectory: "~/Library/Application Support/OpenLoop/logs/backend",
      });
      return;
    }
    void api.getDefaultAppPaths().then(setDefaultPaths);
  }, []);

  const persistSetting = async <K extends EditableSettingKey>(
    key: K,
    value: AppSettings[K],
  ) => {
    await api.setSetting(key, value);
  };
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
  const pickDirectory = async (key: DirectorySettingKey) => {
    const selected = await api.selectDirectory(
      draft[key] ||
        (key === "outputDirectory"
          ? defaultPaths?.outputDirectory
          : key === "modelDirectory"
            ? defaultPaths?.modelDirectory
            : defaultPaths?.logDirectory),
    );
    if (!selected) {
      return;
    }
    setDraft((current) => ({
      ...current,
      [key]: selected,
    }));
  };

  const handleCliPathToggle = async () => {
    setCliPathStatus("loading");
    setCliPathError(null);
    try {
      if (cliPathStatus === "added") {
        await api.removeCliFromPath();
        setCliPathStatus("not_added");
      } else {
        await api.addCliToPath();
        setCliPathStatus("added");
      }
    } catch (err) {
      setCliPathStatus("error");
      setCliPathError(String(err));
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-1 flex-col overflow-y-auto bg-[var(--color-surface-muted)]/98 p-6 backdrop-blur-sm md:p-10">
      <div className="pointer-events-auto mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white">
              {t("settings.title")}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
              {t("settings.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="motion-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-dim)] hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
            aria-label={t("setup.close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Section navigation */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--color-border-light)] pb-3">
          {[
            { id: "models", label: t("settings.models") },
            { id: "defaults", label: t("settings.defaults") },
            { id: "general", label: t("settings.general") },
            { id: "backend", label: t("settings.backend") },
            { id: "danger", label: t("settings.danger") },
          ].map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                const el = document.getElementById(
                  `settings-section-${section.id}`,
                );
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            <SettingsSectionCard
              id="settings-section-models"
              title={t("settings.models")}
              description={t("settings.modelsDescription")}
            >
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                  {t("settings.modelPacks")}
                </p>
                {(Object.keys(MODEL_PACKS) as ModelPackId[]).map((packId) => {
                  const packStatus = aggregatePackStatus(modelStatuses, packId);
                  const primary = primaryVariantForPack(packId);
                  return (
                    <ModelPackCard
                      key={packId}
                      packId={packId}
                      state={packStatus.state}
                      downloadedBytes={packStatus.downloadedBytes}
                      totalBytes={packStatus.totalBytes}
                      errorMessage={packStatus.error?.message ?? null}
                      errorDetails={packStatus.error?.details ?? null}
                      busy={
                        busyVariant !== null &&
                        MODEL_PACKS[packId].variants.includes(busyVariant)
                      }
                      onDownload={() => {
                        setBusyVariant(primary);
                        void downloadModelVariant(primary).finally(() => {
                          setBusyVariant(null);
                        });
                      }}
                      onDelete={() => {
                        setBusyVariant(primary);
                        void deleteModelVariant(primary).finally(() => {
                          setBusyVariant(null);
                        });
                      }}
                      onCancel={() => {
                        void cancelModelDownload(primary);
                      }}
                      onClearPartial={() => {
                        setBusyVariant(primary);
                        void clearPartialModelDownloads(primary).finally(() => {
                          setBusyVariant(null);
                        });
                      }}
                    />
                  );
                })}
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                  {t("settings.runProfiles")}
                </p>
                {(["lite", "turbo", "pro"] as const).map((variant) => {
                  const packId = packIdForVariant(variant);
                  const packStatus = aggregatePackStatus(modelStatuses, packId);
                  return (
                    <ModelVariantCard
                      key={variant}
                      variant={variant}
                      selected={settings.modelVariant === variant}
                      packReady={packStatus.state === "ready"}
                      packState={packStatus.state}
                      busy={busyVariant === variant}
                      onSelect={() => {
                        setBusyVariant(variant);
                        void selectModelVariant(variant).finally(() => {
                          setBusyVariant(null);
                        });
                      }}
                    />
                  );
                })}
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              id="settings-section-path"
              title={t("settings.cliPath")}
              description={t("settings.cliPathDescription")}
            >
              <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
                {t("settings.cliPathHint", {
                  link: "/usr/local/bin/openloop",
                })}
              </p>
              {cliPathError && (
                <p className="text-[11px] text-red-400">{cliPathError}</p>
              )}
              <button
                type="button"
                onClick={handleCliPathToggle}
                disabled={cliPathStatus === "loading"}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-hover)] disabled:cursor-wait disabled:opacity-60"
              >
                {cliPathStatus === "loading" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{t("settings.cliPathChecking")}</span>
                  </>
                ) : cliPathStatus === "added" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span>{t("settings.cliPathRemove")}</span>
                  </>
                ) : (
                  <>
                    <Terminal className="h-3 w-3" />
                    <span>
                      {cliPathStatus === "error"
                        ? t("settings.cliPathRetry")
                        : t("settings.cliPathAdd")}
                    </span>
                  </>
                )}
              </button>
            </SettingsSectionCard>

            <SettingsSectionCard
              id="settings-section-defaults"
              title={t("settings.defaults")}
              description={t("settings.defaultsDescription")}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                    {t("settings.defaultDuration")}
                  </span>
                  <input
                    className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                    type="number"
                    value={draft.defaultDurationSeconds}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        defaultDurationSeconds: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                    {t("settings.audioFormat")}
                  </span>
                  <select
                    className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                    value={draft.defaultAudioFormat}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        defaultAudioFormat: event.target
                          .value as AppSettings["defaultAudioFormat"],
                      }))
                    }
                  >
                    <option value="wav">WAV</option>
                    <option value="mp3">MP3</option>
                    <option value="flac">FLAC</option>
                    <option value="ogg">OGG</option>
                  </select>
                </label>
              </div>

              <DirectoryPickerRow
                label={t("settings.outputDirectory")}
                value={draft.outputDirectory}
                defaultValue={defaultPaths?.outputDirectory ?? ""}
                onPick={() => {
                  void pickDirectory("outputDirectory");
                }}
                onReset={() =>
                  setDraft((current) => ({ ...current, outputDirectory: "" }))
                }
              />

              <DirectoryPickerRow
                label={t("settings.modelDirectory")}
                value={draft.modelDirectory}
                defaultValue={defaultPaths?.modelDirectory ?? ""}
                disabled={modelDirectoryLocked}
                onPick={() => {
                  void pickDirectory("modelDirectory");
                }}
                onReset={() =>
                  setDraft((current) => ({ ...current, modelDirectory: "" }))
                }
              />

              {showModelDirRestartHint ? (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  <span className="flex-1">
                    {t("settings.restartForModelDir")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void api.restartBackend().then(() => {
                        addToast("success", t("settings.backendRestarted"));
                      });
                    }}
                    className="inline-flex h-7 shrink-0 items-center rounded-md border border-amber-500/30 bg-amber-500/15 px-2.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/25"
                  >
                    {t("settings.restartNow")}
                  </button>
                </div>
              ) : null}

              <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.defaultThinking}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      defaultThinking: event.target.checked,
                    }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white">
                    {t("settings.defaultThinking")}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
                    {t("settings.defaultThinkingDescription")}
                  </p>
                </div>
              </label>
            </SettingsSectionCard>
          </div>

          <div className="space-y-6">
            <SettingsSectionCard
              id="settings-section-general"
              title={t("settings.general")}
              description={t("settings.generalDescription")}
            >
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                  {t("settings.language")}
                </span>
                <select
                  className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                  value={settings.language ?? i18n.resolvedLanguage ?? "en"}
                  onChange={(event) => {
                    void setLanguage(event.target.value);
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.checkForUpdates}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      checkForUpdates: event.target.checked,
                    }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white">
                    {t("settings.checkForUpdates")}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
                    {t("settings.checkForUpdatesDescription")}
                  </p>
                </div>
              </label>

              {saveNotice ? (
                <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-[12px] text-white">
                  {saveNotice}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    reopenSetup();
                    closeSettings();
                  }}
                  className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
                >
                  {t("settings.reopenSetup")}
                </button>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              id="settings-section-backend"
              title={t("settings.backend")}
              description={t("settings.backendDescription")}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5 block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                    {t("settings.backendPort")}
                  </span>
                  <input
                    className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                    type="number"
                    min="1024"
                    max="65535"
                    value={draft.backendPort}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        backendPort: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <DirectoryPickerRow
                label={t("settings.logDirectory")}
                value={draft.logDirectory}
                defaultValue={defaultPaths?.logDirectory ?? ""}
                onPick={() => {
                  void pickDirectory("logDirectory");
                }}
                onReset={() =>
                  setDraft((current) => ({ ...current, logDirectory: "" }))
                }
              />
              {!backendPortValid ? (
                <p className="text-[11px] text-amber-300">
                  {t("settings.backendPortInvalid", {
                    defaultValue:
                      "Backend port must be between 1024 and 65535.",
                  })}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void api
                      .restartBackend()
                      .then(() =>
                        setSaveNotice(t("settings.backendRestarted")),
                      );
                  }}
                  className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
                >
                  {t("settings.restartBackend")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void api.getBackendLogsPath().then((path) => {
                      if (path) {
                        void api.revealInFinder(path);
                      } else {
                        setSaveNotice(t("settings.noBackendLog"));
                      }
                    });
                  }}
                  className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
                >
                  {t("settings.openBackendLog")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void api.setSetting("backendPort", 8001).then(async () => {
                      await hydrateFromPersistence();
                      setSaveNotice(
                        t("settings.backendPortReset", {
                          defaultValue: "Backend port reset to 8001.",
                        }),
                      );
                    });
                  }}
                  className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
                >
                  {t("settings.resetDefaultPort", {
                    defaultValue: "Reset default port",
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void api.resetRuntimeSettings().then(async () => {
                      await hydrateFromPersistence();
                      setSaveNotice(
                        t("settings.runtimeSettingsRepaired", {
                          defaultValue: "Runtime configuration repaired.",
                        }),
                      );
                    });
                  }}
                  className="inline-flex h-8 items-center rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/15 px-3 text-[11px] text-white transition-colors hover:bg-[var(--color-accent)]/25"
                >
                  {t("settings.repairRuntime", {
                    defaultValue: "Repair runtime config",
                  })}
                </button>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              id="settings-section-danger"
              title={t("settings.danger")}
              description={t("settings.dangerDescription")}
              tone="danger"
            >
              <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
                {t("settings.clearHistoryDescription")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setClearHistoryConfirmOpen(true)}
                  disabled={history.length === 0}
                  className="inline-flex h-8 items-center rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("settings.clearHistory")}
                </button>
                <button
                  type="button"
                  onClick={() => setClearCacheConfirmOpen(true)}
                  className="inline-flex h-8 items-center rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16"
                >
                  {t("settings.clearBackendCache")}
                </button>
              </div>

              <hr className="border-t border-red-500/20" />

              <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
                {t("settings.deleteAllModelsDescription")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteAllModelsConfirmOpen(true)}
                  disabled={settings.downloadedModels.length === 0}
                  className="inline-flex h-8 items-center rounded-md border border-red-500/40 bg-red-600/10 px-3 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-600/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("settings.deleteAllModels")}
                </button>
              </div>
            </SettingsSectionCard>
          </div>
        </div>

        <SettingsDialogHost
          open={clearHistoryConfirmOpen}
          title={t("settings.clearHistoryTitle")}
          message={t("settings.clearHistoryMessage", {
            count: history.length,
          })}
          confirmLabel={t("settings.clearHistory")}
          onCancel={() => setClearHistoryConfirmOpen(false)}
          onConfirm={() => {
            setClearHistoryConfirmOpen(false);
            void (async () => {
              await clearGenerationHistory();
              setSaveNotice(t("settings.historyCleared"));
            })();
          }}
        />
        <SettingsDialogHost
          open={clearCacheConfirmOpen}
          title={t("settings.clearBackendCacheTitle")}
          message={t("settings.clearBackendCacheMessage")}
          confirmLabel={t("settings.clearBackendCache")}
          onCancel={() => setClearCacheConfirmOpen(false)}
          onConfirm={() => {
            setClearCacheConfirmOpen(false);
            void api.clearBackendCache().then(() => {
              setSaveNotice(t("settings.backendCacheCleared"));
            });
          }}
        />
        {/* Sticky bottom save bar */}
        <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-muted)]/95 px-6 py-4 backdrop-blur-sm md:-mx-10 md:-mb-10 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                  {t("settings.unsavedChanges")}
                </span>
              ) : saveNotice ? (
                <span className="text-[12px] text-[var(--color-text-dim)]">
                  {saveNotice}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft({
                    outputDirectory: settings.outputDirectory ?? "",
                    modelDirectory: settings.modelDirectory ?? "",
                    backendPort: String(settings.backendPort),
                    logDirectory: settings.logDirectory ?? "",
                    defaultDurationSeconds: String(settings.defaultDurationSeconds),
                    defaultAudioFormat: settings.defaultAudioFormat,
                    defaultThinking: settings.defaultThinking,
                    checkForUpdates: settings.checkForUpdates ?? true,
                  });
                  setSaveNotice(null);
                }}
                disabled={!hasUnsavedChanges}
                className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("settings.discardChanges")}
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    if (!backendPortValid) {
                      setSaveNotice(
                        t("settings.backendPortInvalid", {
                          defaultValue:
                            "Backend port must be between 1024 and 65535.",
                        }),
                      );
                      return;
                    }
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
                      persistSetting(
                        "backendPort",
                        Number(draft.backendPort),
                      ),
                      persistSetting(
                        "logDirectory",
                        draft.logDirectory || null,
                      ),
                      persistSetting(
                        "defaultDurationSeconds",
                        Number(draft.defaultDurationSeconds),
                      ),
                      persistSetting(
                        "defaultAudioFormat",
                        draft.defaultAudioFormat,
                      ),
                      persistSetting(
                        "defaultThinking",
                        draft.defaultThinking,
                      ),
                      persistSetting(
                        "checkForUpdates",
                        draft.checkForUpdates,
                      ),
                    ]);
                    await hydrateFromPersistence();
                    setSaveNotice(t("settings.saved"));
                    addToast("success", t("toast.settingsSaved"));
                  })();
                }}
                disabled={!backendPortValid || !hasUnsavedChanges}
                className="inline-flex h-9 items-center rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("settings.save")}
              </button>
            </div>
          </div>
        </div>

        <SettingsDialogHost
          open={deleteAllModelsConfirmOpen}
          title={t("settings.deleteAllModelsTitle")}
          message={t("settings.deleteAllModelsMessage", {
            count: settings.downloadedModels.length,
          })}
          confirmLabel={t("settings.deleteAllModels")}
          onCancel={() => setDeleteAllModelsConfirmOpen(false)}
          onConfirm={() => {
            setDeleteAllModelsConfirmOpen(false);
            void (async () => {
              await deleteAllModels();
              setSaveNotice(t("settings.modelsDeleted"));
            })();
          }}
        />
      </div>
    </div>
  );
}
