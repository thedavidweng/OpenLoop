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
          className="inline-flex h-8 items-center rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("settings.clearHistory")}
        </button>
        <button
          type="button"
          onClick={onClearCache}
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
          onClick={onDeleteAllModels}
          disabled={downloadedModelsCount === 0}
          className="inline-flex h-8 items-center rounded-md border border-red-500/40 bg-red-600/10 px-3 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-600/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("settings.deleteAllModels")}
        </button>
      </div>
    </SettingsSectionCard>
  );
}
