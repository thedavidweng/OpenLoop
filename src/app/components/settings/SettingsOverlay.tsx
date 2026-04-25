import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsDialogHost } from "@/app/components/settings/SettingsDialogHost";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { MODEL_VARIANTS, useGenerationStore } from "@/app/lib/store";
import * as api from "@/app/lib/api";
import { SUPPORTED_LANGUAGES } from "@/app/lib/i18n";
import type { AppSettings, ModelVariant } from "@/app/lib/types";

type EditableSettingKey =
  | "outputDirectory"
  | "modelDirectory"
  | "backendPort"
  | "logDirectory"
  | "defaultDurationSeconds"
  | "defaultAudioFormat"
  | "defaultThinking";

function stateKey(state: string) {
  switch (state) {
    case "downloading":
      return "downloading";
    case "ready":
      return "ready";
    case "outdated":
      return "outdated";
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

function formatBytes(downloadedBytes: number, totalBytes?: number | null) {
  if (!totalBytes) return bytesToLabel(downloadedBytes);
  return `${bytesToLabel(downloadedBytes)} / ${bytesToLabel(totalBytes)}`;
}

function formatProgress(downloadedBytes: number, totalBytes?: number | null) {
  if (!totalBytes || downloadedBytes <= 0) return null;
  const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
  return `${percent}%`;
}

function ModelVariantCard({
  variant,
  selected,
  downloaded,
  state,
  stateRaw,
  sizeLabel,
  busy,
  progressLabel,
  onSelect,
  onDownload,
  onDelete,
}: {
  variant: ModelVariant;
  selected: boolean;
  downloaded: boolean;
  state: string;
  stateRaw: string;
  sizeLabel: string;
  busy: boolean;
  progressLabel?: string | null;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const meta = MODEL_VARIANTS[variant];

  return (
    <div
      className={`rounded-md border px-3 py-3 transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12"
          : "border-[var(--color-border-light)] bg-[var(--color-surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-white">{meta.label}</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-dim)]">
            {meta.description}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-wide text-[var(--color-text-dimmer)]">
            {state} · {sizeLabel}
          </p>
          {progressLabel ? (
            <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">{progressLabel}</p>
          ) : null}
        </div>
        {downloaded ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onSelect}
              disabled={busy}
              className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white disabled:opacity-50"
            >
              {selected ? t("model.selected") : t("model.select")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded-md border border-red-500/40 bg-red-600/10 px-3 py-1.5 text-[11px] text-red-300 transition-colors hover:bg-red-600/20 disabled:opacity-50"
            >
              {t("model.delete")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {busy ? t("model.downloading") : stateRaw === "outdated" ? t("model.reinstall") : t("model.download")}
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsOverlay() {
  const { i18n, t } = useTranslation();
  const settings = useGenerationStore((state) => state.settings);
  const modelStatuses = useGenerationStore((state) => state.modelStatuses);
  const history = useGenerationStore((state) => state.history);
  const closeSettings = useGenerationStore((state) => state.closeSettings);
  const deleteGenerationRecord = useGenerationStore(
    (state) => state.deleteGenerationRecord,
  );
  const downloadModelVariant = useGenerationStore(
    (state) => state.downloadModelVariant,
  );
  const deleteModelVariant = useGenerationStore((state) => state.deleteModelVariant);
  const hydrateFromPersistence = useGenerationStore(
    (state) => state.hydrateFromPersistence,
  );
  const refreshModelStatuses = useGenerationStore((state) => state.refreshModelStatuses);
  const reopenSetup = useGenerationStore((state) => state.reopenSetup);
  const selectModelVariant = useGenerationStore(
    (state) => state.selectModelVariant,
  );
  const setLanguage = useGenerationStore((state) => state.setLanguage);
  const [busyVariant, setBusyVariant] = useState<ModelVariant | null>(null);
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);
  const [clearCacheConfirmOpen, setClearCacheConfirmOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
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
  }, [settings]);

  useEffect(() => {
    void refreshModelStatuses();
  }, [refreshModelStatuses]);

  const persistSetting = async <K extends EditableSettingKey>(
    key: K,
    value: AppSettings[K],
  ) => {
    await api.setSetting(key, value);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-1 flex-col overflow-y-auto bg-[var(--color-surface-muted)]/98 p-10 backdrop-blur-sm">
      <div className="pointer-events-auto mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t("settings.title")}</h2>
            <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
              {t("settings.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="motion-icon-button rounded-xl p-2 text-[var(--color-text-dim)] hover:bg-white/6 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
          >
            {t("setup.close")}
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            <SettingsSectionCard
              title={t("settings.models")}
              description={t("settings.modelsDescription")}
            >
              <div className="space-y-3">
                {(["lite", "turbo", "pro"] as const).map((variant) => {
                  const status = modelStatuses.find((item) => item.variant === variant);
                  const stateLabel = status ? t(`model.${stateKey(status.state)}`) : t("model.notInstalled");
                  const downloaded = status?.state === "ready";
                  return (
                    <ModelVariantCard
                      key={variant}
                      variant={variant}
                      selected={settings.modelVariant === variant}
                      downloaded={downloaded}
                      state={stateLabel}
                      stateRaw={status?.state ?? "not_installed"}
                      sizeLabel={formatBytes(status?.downloadedBytes ?? 0, status?.totalBytes ?? null)}
                      progressLabel={formatProgress(status?.downloadedBytes ?? 0, status?.totalBytes ?? null)}
                      busy={busyVariant === variant || status?.state === "downloading"}
                      onSelect={() => {
                        setBusyVariant(variant);
                        void selectModelVariant(variant).finally(() => {
                          setBusyVariant(null);
                        });
                      }}
                      onDownload={() => {
                        setBusyVariant(variant);
                        void downloadModelVariant(variant).finally(() => {
                          setBusyVariant(null);
                        });
                      }}
                      onDelete={() => {
                        setBusyVariant(variant);
                        void deleteModelVariant(variant).finally(() => {
                          setBusyVariant(null);
                        });
                      }}
                    />
                  );
                })}
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              title={t("settings.defaults")}
              description={t("settings.defaultsDescription")}
            >
              <label className="space-y-1">
                <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
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
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
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
                <label className="space-y-1">
                  <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
                    {t("settings.audioFormat")}
                  </span>
                  <select
                    className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                    value={draft.defaultAudioFormat}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        defaultAudioFormat: event.target.value as AppSettings["defaultAudioFormat"],
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

              <label className="space-y-1">
                <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
                  {t("settings.outputDirectory")}
                </span>
                <input
                  className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                  value={draft.outputDirectory}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      outputDirectory: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
                  {t("settings.modelDirectory")}
                </span>
                <input
                  className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                  value={draft.modelDirectory}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      modelDirectory: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="flex items-start gap-3 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-3">
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
                <div>
                  <p className="text-[13px] font-medium text-white">
                    {t("settings.defaultThinking")}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
                    {t("settings.defaultThinkingDescription")}
                  </p>
                </div>
              </label>
            </SettingsSectionCard>
          </div>

          <div className="space-y-6">
            <SettingsSectionCard
              title={t("settings.general")}
              description={t("settings.generalDescription")}
            >
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
                      await Promise.all([
                        persistSetting("outputDirectory", draft.outputDirectory || null),
                        persistSetting("modelDirectory", draft.modelDirectory || null),
                        persistSetting("backendPort", Number(draft.backendPort)),
                        persistSetting("logDirectory", draft.logDirectory || null),
                        persistSetting(
                          "defaultDurationSeconds",
                          Number(draft.defaultDurationSeconds),
                        ),
                        persistSetting("defaultAudioFormat", draft.defaultAudioFormat),
                        persistSetting("defaultThinking", draft.defaultThinking),
                      ]);
                      await hydrateFromPersistence();
                      setSaveNotice(t("settings.saved"));
                    })();
                  }}
                  className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:brightness-110"
                >
                  {t("settings.save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reopenSetup();
                    closeSettings();
                  }}
                  className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
                >
                  {t("settings.reopenSetup")}
                </button>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              title={t("settings.backend")}
              description={t("settings.backendDescription")}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
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
                <label className="space-y-1">
                  <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
                    {t("settings.logDirectory")}
                  </span>
                  <input
                    className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                    value={draft.logDirectory}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        logDirectory: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void api.restartBackend().then(() => setSaveNotice(t("settings.backendRestarted")));
                  }}
                  className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
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
                  className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
                >
                  {t("settings.openBackendLog")}
                </button>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              title={t("settings.danger")}
              description={t("settings.dangerDescription")}
              tone="danger"
            >
              <p className="text-[12px] text-[var(--color-text-dim)]">
                {t("settings.clearHistoryDescription")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setClearHistoryConfirmOpen(true)}
                  className="rounded-md border border-red-500/40 bg-red-600/10 px-3 py-1.5 text-[12px] text-red-300 transition-colors hover:bg-red-600/20"
                >
                  {t("settings.clearHistory")}
                </button>
                <button
                  type="button"
                  onClick={() => setClearCacheConfirmOpen(true)}
                  className="rounded-md border border-red-500/40 bg-red-600/10 px-3 py-1.5 text-[12px] text-red-300 transition-colors hover:bg-red-600/20"
                >
                  {t("settings.clearBackendCache")}
                </button>
              </div>
            </SettingsSectionCard>
          </div>
        </div>

        <SettingsDialogHost
          open={clearHistoryConfirmOpen}
          title={t("settings.clearHistoryTitle")}
          message={t("settings.clearHistoryMessage")}
          confirmLabel={t("settings.clearHistory")}
          onCancel={() => setClearHistoryConfirmOpen(false)}
          onConfirm={() => {
            setClearHistoryConfirmOpen(false);
            void (async () => {
              for (const record of history) {
                await deleteGenerationRecord(record.id);
              }
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
      </div>
    </div>
  );
}
