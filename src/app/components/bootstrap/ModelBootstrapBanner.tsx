import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGenerationStore } from "@/app/lib/store";

export function ModelBootstrapBanner() {
  const { t } = useTranslation();
  const bootstrapStatus = useGenerationStore((state) => state.bootstrapStatus);
  const openSettings = useGenerationStore((state) => state.openSettings);
  const reopenSetup = useGenerationStore((state) => state.reopenSetup);
  const settings = useGenerationStore((state) => state.settings);

  if (bootstrapStatus.state === "ready") {
    return null;
  }

  return (
    <div className="animate-expand shrink-0 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-3">
      {bootstrapStatus.state === "pending" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12px] text-[var(--color-text)]">
            <p>{bootstrapStatus.message}</p>
          </div>
          <button
            type="button"
            onClick={settings.firstRunCompleted ? openSettings : reopenSetup}
            className="shrink-0 self-start rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white sm:self-center"
          >
            {settings.firstRunCompleted ? t("model.chooseModel") : t("setup.openSetup")}
          </button>
        </div>
      ) : null}

	      {bootstrapStatus.state === "downloading" ? (
	        <div className="flex items-center justify-between gap-3 text-[12px]">
	          <span className="flex items-center gap-2 text-[var(--color-text)]">
	            <Loader2 size={12} className="animate-spin" />
	            {bootstrapStatus.message}
	          </span>
	          {bootstrapStatus.totalBytes ? (
	            <span className="text-[11px] text-[var(--color-text-dim)]">
	              {Math.round(((bootstrapStatus.downloadedBytes ?? 0) / bootstrapStatus.totalBytes) * 100)}%
	            </span>
	          ) : null}
	        </div>
	      ) : null}

      {bootstrapStatus.state === "outdated" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12px] text-[var(--color-text)]">
            <p>{bootstrapStatus.message}</p>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="shrink-0 self-start rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white sm:self-center"
          >
            {t("model.chooseModel")}
          </button>
        </div>
      ) : null}

      {bootstrapStatus.state === "failed" ? (
        <div className="flex flex-col gap-1 text-[12px]">
          <span className="text-red-400">{bootstrapStatus.message}</span>
          {bootstrapStatus.error?.message ? (
            <span className="text-[11px] text-[var(--color-text-dim)]">
              {bootstrapStatus.error.message}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
