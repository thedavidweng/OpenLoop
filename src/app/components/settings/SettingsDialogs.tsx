import { useTranslation } from "react-i18next";
import { SettingsDialogHost } from "@/app/components/settings/SettingsDialogHost";

interface SettingsDialogsProps {
  clearHistoryOpen: boolean;
  clearCacheOpen: boolean;
  deleteAllModelsOpen: boolean;
  historyCount: number;
  downloadedModelsCount: number;
  onDismissClearHistory: () => void;
  onConfirmClearHistory: () => void;
  onDismissClearCache: () => void;
  onConfirmClearCache: () => void;
  onDismissDeleteAllModels: () => void;
  onConfirmDeleteAllModels: () => void;
}

export function SettingsDialogs({
  clearHistoryOpen,
  clearCacheOpen,
  deleteAllModelsOpen,
  historyCount,
  downloadedModelsCount,
  onDismissClearHistory,
  onConfirmClearHistory,
  onDismissClearCache,
  onConfirmClearCache,
  onDismissDeleteAllModels,
  onConfirmDeleteAllModels,
}: SettingsDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsDialogHost
        open={clearHistoryOpen}
        title={t("settings.clearHistoryTitle")}
        message={t("settings.clearHistoryMessage", { count: historyCount })}
        confirmLabel={t("settings.clearHistory")}
        onCancel={onDismissClearHistory}
        onConfirm={onConfirmClearHistory}
      />
      <SettingsDialogHost
        open={clearCacheOpen}
        title={t("settings.clearBackendCacheTitle")}
        message={t("settings.clearBackendCacheMessage")}
        confirmLabel={t("settings.clearBackendCache")}
        onCancel={onDismissClearCache}
        onConfirm={onConfirmClearCache}
      />
      <SettingsDialogHost
        open={deleteAllModelsOpen}
        title={t("settings.deleteAllModelsTitle")}
        message={t("settings.deleteAllModelsMessage", {
          count: downloadedModelsCount,
        })}
        confirmLabel={t("settings.deleteAllModels")}
        onCancel={onDismissDeleteAllModels}
        onConfirm={onConfirmDeleteAllModels}
      />
    </>
  );
}
