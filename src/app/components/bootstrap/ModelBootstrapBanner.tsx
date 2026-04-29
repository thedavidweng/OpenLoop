import { Loader2, AlertTriangle, Download, FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGenerationStore } from "@/app/lib/store";

function formatGigabytes(bytes: number) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function ModelBootstrapBanner() {
  const { t } = useTranslation();
  const bootstrapStatus = useGenerationStore((state) => state.bootstrapStatus);
  const openSettings = useGenerationStore((state) => state.openSettings);
  const reopenSetup = useGenerationStore((state) => state.reopenSetup);
  const settings = useGenerationStore((state) => state.settings);

  if (bootstrapStatus.state === "ready") {
    return null;
  }

  const downloadedBytes =
    bootstrapStatus.state === "downloading"
      ? (bootstrapStatus.downloadedBytes ?? 0)
      : 0;
  const totalBytes =
    bootstrapStatus.state === "downloading" ? bootstrapStatus.totalBytes : null;
  const percent =
    bootstrapStatus.state === "downloading" && totalBytes
      ? Math.min(100, Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)))
      : null;

  const accent =
    bootstrapStatus.state === "failed"
      ? "bg-red-500/12 border-red-500/30 text-red-100"
      : bootstrapStatus.state === "experimental"
        ? "bg-amber-500/12 border-amber-500/30 text-amber-100"
        : "bg-[var(--color-sidebar)] border-[var(--color-border)] text-[var(--color-text)]";

  return (
    <div
      className={`animate-expand shrink-0 border-b ${accent}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {bootstrapStatus.state === "downloading" ? (
            <Loader2
              size={14}
              className="shrink-0 animate-spin text-[var(--color-accent)]"
            />
          ) : bootstrapStatus.state === "failed" ? (
            <AlertTriangle size={14} className="shrink-0 text-red-300" />
          ) : bootstrapStatus.state === "experimental" ? (
            <FlaskConical size={14} className="shrink-0 text-amber-300" />
          ) : (
            <Download
              size={14}
              className="shrink-0 text-[var(--color-text-dim)]"
            />
          )}
          <p className="min-w-0 truncate text-[12px] leading-5">
            {bootstrapStatus.message}
          </p>
        </div>

        {bootstrapStatus.state === "downloading" && totalBytes ? (
          <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-dim)] tabular-nums">
            {formatGigabytes(downloadedBytes)} / {formatGigabytes(totalBytes)}
            {percent !== null ? ` · ${percent}%` : null}
          </span>
        ) : null}

        {bootstrapStatus.state === "pending" ? (
          <button
            type="button"
            onClick={settings.firstRunCompleted ? openSettings : reopenSetup}
            className="shrink-0 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
          >
            {settings.firstRunCompleted
              ? t("model.chooseModel")
              : t("setup.openSetup")}
          </button>
        ) : null}

        {bootstrapStatus.state === "experimental" ? (
          <button
            type="button"
            onClick={openSettings}
            className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition-colors hover:bg-amber-500/20"
          >
            {t("model.openSettings")}
          </button>
        ) : null}
      </div>

      {bootstrapStatus.state === "downloading" && totalBytes ? (
        <div className="h-[3px] w-full overflow-hidden bg-[var(--color-border)]/60">
          <div
            className="h-full bg-[var(--color-accent)] transition-[width] duration-200 ease-out"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
      ) : null}

      {bootstrapStatus.state === "failed" &&
      bootstrapStatus.error?.details &&
      bootstrapStatus.error.details !== bootstrapStatus.message ? (
        <p className="border-t border-red-500/20 bg-red-500/5 px-4 py-2 text-[11px] text-red-200/80">
          {bootstrapStatus.error.details}
        </p>
      ) : null}
    </div>
  );
}
