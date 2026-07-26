import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { ExternalLink } from "@/app/components/ui/ExternalLink";
import { useGenerationStore } from "@/app/lib/store";
import * as api from "@/app/lib/api";
import { SUPPORTED_LANGUAGES, detectSystemLanguage } from "@/app/lib/i18n";

interface GeneralSectionProps {
  draftCheckForUpdates: boolean;
  onDraftChange: (patch: Record<string, unknown>) => void;
  configDir: string | null;
  saveNotice: string | null;
}

export function GeneralSection({
  draftCheckForUpdates,
  onDraftChange,
  configDir,
  saveNotice,
}: GeneralSectionProps) {
  const { t, i18n } = useTranslation();
  const setLanguage = useGenerationStore((state) => state.setLanguage);
  const reopenSetup = useGenerationStore((state) => state.reopenSetup);
  const closeSettings = useGenerationStore((state) => state.closeSettings);
  const settings = useGenerationStore((state) => state.settings);
  const highContrast = useGenerationStore((state) => state.highContrast);
  const setHighContrast = useGenerationStore((state) => state.setHighContrast);

  return (
    <SettingsSectionCard
      id="settings-section-general"
      title={t("settings.general")}
      description={t("settings.generalDescription")}
      headerAction={
        <button
          type="button"
          onClick={() => {
            void setLanguage(detectSystemLanguage());
          }}
          className="text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)]"
        >
          {t("settings.resetToDefaults")}
        </button>
      }
    >
      <label className="space-y-1.5 block">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
          {t("settings.language")}
        </span>
        <select
          className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]"
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
          checked={draftCheckForUpdates}
          onChange={(event) => onDraftChange({ checkForUpdates: event.target.checked })}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--color-text)]">
            {t("settings.checkForUpdates")}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
            {t("settings.checkForUpdatesDescription")}
          </p>
        </div>
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-3">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={highContrast}
          onChange={(event) => setHighContrast(event.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--color-text)]">
            {t("settings.highContrast")}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
            {t("settings.highContrastDescription")}
          </p>
        </div>
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-3 opacity-50 cursor-not-allowed">
        <input type="checkbox" className="mt-0.5" disabled checked={false} onChange={() => {}} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--color-text)]">
            {t("settings.anonymousErrorReports")}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
            {t("settings.anonymousErrorReportsDescription")}
          </p>
        </div>
      </label>

      {saveNotice ? (
        <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-[12px] text-[var(--color-text)]">
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
          className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          {t("settings.reopenSetup")}
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              if (configDir) {
                await api.revealInFinder(configDir);
              }
            } catch {
              // revealInFinder requires Tauri runtime; silently ignore
            }
          }}
          className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          {t("settings.revealConfigFile")}
        </button>
        <ExternalLink
          href="https://github.com/thedavidweng/OpenLoop/releases"
          className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] no-underline"
        >
          {t("settings.releaseNotes")}
        </ExternalLink>
      </div>
    </SettingsSectionCard>
  );
}
