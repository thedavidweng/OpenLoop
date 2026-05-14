import { useTranslation } from "react-i18next";
import { Download, Loader2, Trash2, XCircle } from "lucide-react";
import { MODEL_PACKS, type ModelPackId } from "@/app/lib/model-packs";
import type { ModelDownloadState } from "@/app/lib/types";
import { StateBadge } from "./StateBadge";

function bytesToLabel(bytes: number) {
  if (!bytes) return "0 GB";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function progressPercent(downloadedBytes: number, totalBytes?: number | null) {
  if (!totalBytes) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)),
  );
}

interface ModelPackCardProps {
  packId: ModelPackId;
  state: ModelDownloadState;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage?: string | null;
  errorDetails?: string | null;
  busy: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onClearPartial: () => void;
}

export function ModelPackCard({
  packId,
  state,
  downloadedBytes,
  totalBytes,
  errorMessage,
  errorDetails,
  busy,
  onDownload,
  onDelete,
  onCancel,
  onClearPartial,
}: ModelPackCardProps) {
  const { t } = useTranslation();
  const meta = MODEL_PACKS[packId];
  const percent = progressPercent(downloadedBytes, totalBytes);

  return (
    <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-white">{meta.label}</p>
            <StateBadge state={state} />
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
            {t(`modelPacks.${packId}.description`)}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-[var(--color-text-dimmer)]">
            {bytesToLabel(downloadedBytes)} / {bytesToLabel(totalBytes)}
            {state === "downloading" ? ` · ${percent}%` : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {state === "ready" ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={11} />
              {t("model.delete")}
            </button>
          ) : null}
          {state === "downloading" ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle size={11} />
                {t("model.cancel")}
              </button>
              <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3 text-[11px] font-semibold text-white shadow-sm opacity-60 cursor-not-allowed">
                <Loader2 size={11} className="animate-spin" />
                {t("setup.downloadingButton", {
                  defaultValue: "Downloading…",
                })}
              </div>
            </>
          ) : null}
          {state !== "ready" && state !== "downloading" ? (
            <>
              <button
                type="button"
                onClick={onDownload}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3 text-[11px] font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "failed" ? (
                  <>
                    <Download size={11} />
                    {t("model.retry")}
                  </>
                ) : (
                  <>
                    <Download size={11} />
                    {t("model.download")}
                  </>
                )}
              </button>
              {state === "failed" ? (
                <button
                  type="button"
                  onClick={onClearPartial}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-600/8 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={11} />
                  {t("model.clearCache")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {state === "downloading" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-3 rounded-md border border-red-500/25 bg-red-500/8 px-3 py-2">
          <p className="text-[11px] leading-5 text-red-200">{errorMessage}</p>
          {errorDetails ? (
            <p className="mt-1 text-[10px] leading-4 text-red-300/70">
              {errorDetails}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
