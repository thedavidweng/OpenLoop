import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { DirectoryPickerRow } from "@/app/components/settings/SettingsOverlay/DirectoryPickerRow";
import { useToast } from "@/app/components/overlay/Toast";
import * as api from "@/app/lib/api";
import { DEFAULT_APP_SETTINGS } from "@/app/lib/model-bootstrap";
import type { AppSettings } from "@/app/lib/types";
import type { SettingsDraft, DirectorySettingKey } from "../hooks/useSettingsDraft";

interface DefaultsSectionProps {
  draft: SettingsDraft;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
  defaultPaths: api.DefaultAppPaths | null;
  modelDirectoryLocked: boolean;
  showModelDirRestartHint: boolean;
  onPickDirectory: (key: DirectorySettingKey) => void;
}

export function DefaultsSection({
  draft,
  setDraft,
  defaultPaths,
  modelDirectoryLocked,
  showModelDirRestartHint,
  onPickDirectory,
}: DefaultsSectionProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();

  return (
    <SettingsSectionCard
      id="settings-section-defaults"
      title={t("settings.defaults")}
      description={t("settings.defaultsDescription")}
      headerAction={
        <button
          type="button"
          onClick={() => {
            setDraft((current) => ({
              ...current,
              outputDirectory: "",
              defaultDurationSeconds: String(DEFAULT_APP_SETTINGS.defaultDurationSeconds),
              defaultAudioFormat: DEFAULT_APP_SETTINGS.defaultAudioFormat,
              defaultThinking: DEFAULT_APP_SETTINGS.defaultThinking,
            }));
          }}
          className="text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-white"
        >
          {t("settings.resetToDefaults")}
        </button>
      }
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

      <DirectoryPickerRow
        label={t("settings.outputDirectory")}
        value={draft.outputDirectory}
        defaultValue={defaultPaths?.outputDirectory ?? ""}
        onPick={() => {
          void onPickDirectory("outputDirectory");
        }}
        onReset={() => setDraft((current) => ({ ...current, outputDirectory: "" }))}
      />

      <DirectoryPickerRow
        label={t("settings.modelDirectory")}
        value={draft.modelDirectory}
        defaultValue={defaultPaths?.modelDirectory ?? ""}
        disabled={modelDirectoryLocked}
        onPick={() => {
          void onPickDirectory("modelDirectory");
        }}
        onReset={() => setDraft((current) => ({ ...current, modelDirectory: "" }))}
      />

      {showModelDirRestartHint ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          <span className="flex-1">{t("settings.restartForModelDir")}</span>
          <button
            type="button"
            onClick={() => {
              void api
                .restartBackend()
                .then(() => {
                  addToast("success", t("settings.backendRestarted"));
                })
                .catch(() => addToast("error", t("settings.backendRestartFailed")));
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
          <p className="text-[13px] font-medium text-white">{t("settings.defaultThinking")}</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
            {t("settings.defaultThinkingDescription")}
          </p>
        </div>
      </label>
    </SettingsSectionCard>
  );
}
