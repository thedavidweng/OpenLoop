import { useTranslation } from "react-i18next";

interface SettingsSaveBarProps {
  hasUnsavedChanges: boolean;
  saveNotice: string | null;
  backendPortValid: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SettingsSaveBar({
  hasUnsavedChanges,
  saveNotice,
  backendPortValid,
  onSave,
  onDiscard,
}: SettingsSaveBarProps) {
  const { t } = useTranslation();

  return (
    <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-muted)]/95 px-6 py-4 backdrop-blur-sm md:-mx-10 md:-mb-10 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              {t("settings.unsavedChanges")}
            </span>
          ) : saveNotice ? (
            <span className="text-[12px] text-[var(--color-text-dim)]">{saveNotice}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={!hasUnsavedChanges}
            className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("settings.discardChanges")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!backendPortValid || !hasUnsavedChanges}
            className="inline-flex h-9 items-center rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("settings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
