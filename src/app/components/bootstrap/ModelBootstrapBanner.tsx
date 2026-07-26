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

  const isProgressState =
    bootstrapStatus.state === "downloading" || bootstrapStatus.state === "provisioning_backend";
  const downloadedBytes = isProgressState ? (bootstrapStatus.downloadedBytes ?? 0) : 0;
  const totalBytes = isProgressState ? bootstrapStatus.totalBytes : null;
  const percent =
    isProgressState && totalBytes
      ? Math.min(100, Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)))
      : null;

  const isDownloading = bootstrapStatus.state === "downloading";
  const indeterminate = isDownloading && !totalBytes;
  const showCounter = isProgressState && (totalBytes != null || downloadedBytes > 0);

  const accent =
    bootstrapStatus.state === "failed"
      ? "bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] text-[var(--color-destructive)]"
      : bootstrapStatus.state === "experimental"
        ? "bg-amber-500/12 border-amber-500/30 text-amber-100"
        : "bg-[var(--color-sidebar)] border-[var(--color-border)] text-[var(--color-text)]";

  return (
    <div className={`animate-expand shrink-0 border-b ${accent}`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {bootstrapStatus.state === "downloading" ||
          bootstrapStatus.state === "provisioning_backend" ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-[var(--color-accent)]" />
          ) : bootstrapStatus.state === "failed" ? (
            <AlertTriangle size={14} className="shrink-0 text-[var(--color-destructive)]" />
          ) : bootstrapStatus.state === "experimental" ? (
            <FlaskConical size={14} className="shrink-0 text-amber-300" />
          ) : (
            <Download size={14} className="shrink-0 text-[var(--color-text-dim)]" />
          )}
          <p className="min-w-0 truncate text-[12px] leading-5">{bootstrapStatus.message}</p>
        </div>

        {showCounter ? (
          <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-dim)] tabular-nums">
            {formatGigabytes(downloadedBytes)}
            {totalBytes ? ` / ${formatGigabytes(totalBytes)}` : null}
            {percent !== null ? ` · ${percent}%` : null}
          </span>
        ) : null}

        {bootstrapStatus.state === "pending" ? (
          <button
            type="button"
            onClick={settings.firstRunCompleted ? openSettings : reopenSetup}
            className="shrink-0 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            {settings.firstRunCompleted ? t("model.chooseModel") : t("setup.openSetup")}
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

      {isProgressState && totalBytes ? (
        <div className="h-[3px] w-full overflow-hidden bg-[var(--color-border)]/60">
          <div
            className="h-full bg-[var(--color-accent)] transition-[width] duration-200 ease-out"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
      ) : indeterminate ? (
        <div className="relative h-[3px] w-full overflow-hidden bg-[var(--color-border)]/60">
          <div className="model-indeterminate-bar absolute inset-y-0 left-0 bg-[var(--color-accent)] will-change-transform" />
        </div>
      ) : null}

      {bootstrapStatus.state === "failed" &&
      bootstrapStatus.error?.details &&
      bootstrapStatus.error.details !== bootstrapStatus.message ? (
        <p className="border-t border-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_5%,transparent)] px-4 py-2 text-[11px] text-[var(--color-destructive)]">
          {bootstrapStatus.error.details}
        </p>
      ) : null}
    </div>
  );
}
