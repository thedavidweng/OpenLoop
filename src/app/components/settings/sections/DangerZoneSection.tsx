import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";

interface DangerZoneSectionProps {
  historyCount: number;
  downloadedModelsCount: number;
  onClearHistory: () => void;
  onClearCache: () => void;
  onDeleteAllModels: () => void;
}

export function DangerZoneSection({
  historyCount,
  downloadedModelsCount,
  onClearHistory,
  onClearCache,
  onDeleteAllModels,
}: DangerZoneSectionProps) {
  const { t } = useTranslation();

  return (
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
          onClick={onClearHistory}
          disabled={historyCount === 0}
          className="inline-flex h-8 items-center rounded-md border border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] px-3 text-[11px] font-medium text-[var(--color-destructive)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-destructive)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("settings.clearHistory")}
        </button>
        <button
          type="button"
          onClick={onClearCache}
          className="inline-flex h-8 items-center rounded-md border border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] px-3 text-[11px] font-medium text-[var(--color-destructive)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-destructive)_16%,transparent)]"
        >
          {t("settings.clearBackendCache")}
        </button>
      </div>

      <hr className="border-t border-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)]" />

      <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
        {t("settings.deleteAllModelsDescription")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDeleteAllModels}
          disabled={downloadedModelsCount === 0}
          className="inline-flex h-8 items-center rounded-md border border-[color-mix(in_srgb,var(--color-destructive)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] px-3 text-[11px] font-medium text-[var(--color-destructive)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)] hover:text-[var(--color-destructive)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("settings.deleteAllModels")}
        </button>
      </div>
    </SettingsSectionCard>
  );
}
