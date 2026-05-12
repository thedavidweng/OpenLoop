import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  Terminal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { SettingsDialogHost } from "@/app/components/settings/SettingsDialogHost";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { useToast } from "@/app/components/overlay/Toast";
import {
  MODEL_PACKS,
  MODEL_VARIANTS,
  aggregatePackStatus,
  packIdForVariant,
  primaryVariantForPack,
  type ModelPackId,
} from "@/app/lib/model-packs";
import { useGenerationStore } from "@/app/lib/store";
import * as api from "@/app/lib/api";
import { SUPPORTED_LANGUAGES } from "@/app/lib/i18n";
import type {
  AppSettings,
  ModelDownloadState,
  ModelVariant,
} from "@/app/lib/types";

type EditableSettingKey =
  | "outputDirectory"
  | "modelDirectory"
  | "backendPort"
  | "logDirectory"
  | "defaultDurationSeconds"
  | "defaultAudioFormat"
  | "defaultThinking";

type DirectorySettingKey =
  | "outputDirectory"
  | "modelDirectory"
  | "logDirectory";

function stateKey(state: ModelDownloadState): string {
  switch (state) {
    case "downloading":
      return "downloading";
    case "ready":
      return "ready";
    case "failed":
      return "failed";
    default:
      return "notInstalled";
  }
}

function bytesToLabel(bytes: number) {
  if (!bytes) return "0 GB";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function progressPercent(downloadedBytes: number, totalBytes?: number | null) {
  if (!totalBytes) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)),
  );
}

function DirectoryPickerRow({
  label,
  value,
  defaultValue,
  disabled = false,
  onPick,
  onReset,
}: {
  label: string;
  value: string;
  defaultValue: string;
  disabled?: boolean;
  onPick: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const displayValue = value || defaultValue;
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
        {label}
      </span>
      <div className="flex flex-wrap items-stretch gap-2 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] p-1.5">
        <code
          className="min-w-0 flex-1 break-all rounded-md bg-[var(--color-surface-muted)]/60 px-3 py-2 font-mono text-[12px] leading-5 text-[var(--color-text)]"
          title={displayValue}
        >
          {displayValue || "—"}
        </code>
        <div className="flex shrink-0 items-center gap-1">
          {!value ? (
            <span className="rounded-full bg-white/6 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--color-text-dim)]">
              {t("settings.defaultPath")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onPick}
            disabled={disabled}
            className="motion-icon-button inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-2.5 text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size={12} />
            {t("settings.chooseFolder")}
          </button>
          {value ? (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              className="inline-flex h-8 items-center rounded-md px-2 text-[11px] text-[var(--color-text-dim)] hover:bg-[var(--color-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("settings.useDefault")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: ModelDownloadState }) {
  const { t } = useTranslation();
  const map: Record<
    ModelDownloadState,
    { label: string; classes: string; Icon: typeof CheckCircle2 }
  > = {
    ready: {
      label: t("model.ready"),
      classes: "bg-emerald-500/12 text-emerald-200 border-emerald-500/30",
      Icon: CheckCircle2,
    },
    downloading: {
      label: t("model.downloading"),
      classes:
        "bg-[var(--color-accent)]/12 text-[var(--color-accent)] border-[var(--color-accent)]/30",
      Icon: Loader2,
    },
    failed: {
      label: t("model.failed"),
      classes: "bg-red-500/12 text-red-200 border-red-500/30",
      Icon: AlertCircle,
    },
    not_installed: {
      label: t("model.notInstalled"),
      classes: "bg-white/4 text-[var(--color-text-dim)] border-white/8",
      Icon: Download,
    },
  };
  const { label, classes, Icon } = map[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${classes}`}
    >
      <Icon
        size={10}
        className={state === "downloading" ? "animate-spin" : ""}
      />
      {label}
    </span>
  );
}

function ModelPackCard({
  packId,
  state,
  downloadedBytes,
  totalBytes,
  errorMessage,
  errorDetails,
  busy,
  onDownload,
  onDelete,
  onCancel,
  onClearPartial,
}: {
  packId: ModelPackId;
  state: ModelDownloadState;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage?: string | null;
  errorDetails?: string | null;
  busy: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onClearPartial: () => void;
}) {
  const { t } = useTranslation();
  const meta = MODEL_PACKS[packId];
  const percent = progressPercent(downloadedBytes, totalBytes);

  return (
    <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-white">{meta.label}</p>
            <StateBadge state={state} />
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
            {t(`modelPacks.${packId}.description`)}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-[var(--color-text-dimmer)]">
            {bytesToLabel(downloadedBytes)} / {bytesToLabel(totalBytes)}
            {state === "downloading" ? ` · ${percent}%` : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {state === "ready" ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={11} />
              {t("model.delete")}
            </button>
          ) : null}
          {state === "downloading" ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle size={11} />
                {t("model.cancel")}
              </button>
              <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3 text-[11px] font-semibold text-white shadow-sm opacity-60 cursor-not-allowed">
                <Loader2 size={11} className="animate-spin" />
                {t("setup.downloadingButton", {
                  defaultValue: "Downloading…",
                })}
              </div>
            </>
          ) : null}
          {state !== "ready" && state !== "downloading" ? (
            <>
              <button
                type="button"
                onClick={onDownload}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3 text-[11px] font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "failed" ? (
                  <>
                    <Download size={11} />
                    {t("model.retry")}
                  </>
                ) : (
                  <>
                    <Download size={11} />
                    {t("model.download")}
                  </>
                )}
              </button>
              {state === "failed" ? (
                <button
                  type="button"
                  onClick={onClearPartial}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={11} />
                  {t("model.clearCache")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {state === "downloading" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-3 rounded-md border border-red-500/25 bg-red-500/8 px-3 py-2">
          <p className="text-[11px] leading-5 text-red-200">{errorMessage}</p>
          {errorDetails ? (
            <p className="mt-1 text-[10px] leading-4 text-red-300/70">
              {errorDetails}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ModelVariantCard({
  variant,
  selected,
  packReady,
  packState,
  busy,
  onSelect,
}: {
  variant: ModelVariant;
  selected: boolean;
  packReady: boolean;
  packState: ModelDownloadState;
  busy: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const meta = MODEL_VARIANTS[variant];
  const packId = packIdForVariant(variant);

  return (
    <div
      className={`rounded-lg border p-3.5 transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
          : "border-[var(--color-border-light)] bg-[var(--color-surface)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-white">{meta.label}</p>
            {selected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/16 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent)]">
                <CheckCircle2 size={10} />
                {t("model.active")}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
            {t(`modelProfiles.${variant}.description`)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-dimmer)]">
            {MODEL_PACKS[packId].label} · {t(`model.${stateKey(packState)}`)}
          </p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={busy || (!packReady && !selected)}
          className={`inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            selected
              ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 text-white"
              : "border-[var(--color-border-light)] bg-[var(--color-surface-muted)] text-[var(--color-text)] hover:bg-[var(--color-hover)] hover:text-white"
          }`}
        >
          {selected ? t("model.selected") : t("model.select")}
        </button>
      </div>
    </div>
  );
}

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
  });

  useEffect(() => {
    setDraft({
      outputDirectory: settings.outputDirectory ?? "",
      modelDirectory: settings.modelDirectory ?? "",
      backendPort: String(settings.backendPort),
      logDirectory: settings.logDirectory ?? "",
      defaultDurationSeconds: String(settings.defaultDurationSeconds),
      defaultAudioFormat: settings.defaultAudioFormat,
      defaultThinking: settings.defaultThinking,
    });
  }, [
    settings.outputDirectory,
    settings.modelDirectory,
    settings.backendPort,
    settings.logDirectory,
    settings.defaultDurationSeconds,
    settings.defaultAudioFormat,
    settings.defaultThinking,
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
              {saveNotice ? (
                <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-[12px] text-white">
                  {saveNotice}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
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
                      ]);
                      await hydrateFromPersistence();
                      setSaveNotice(t("settings.saved"));
                      addToast("success", t("toast.settingsSaved"));
                    })();
                  }}
                  disabled={!backendPortValid}
                  className="inline-flex h-9 items-center rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("settings.save")}
                </button>
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
