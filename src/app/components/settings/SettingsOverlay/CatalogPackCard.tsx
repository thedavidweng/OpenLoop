import { useTranslation } from "react-i18next";
import type { ModelPackDescriptor, ModelDownloadState } from "@/app/lib/types";
import { StateBadge } from "./StateBadge";

function bytesToLabel(bytes: number) {
  if (!bytes) return "—";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface CatalogPackCardProps {
  pack: ModelPackDescriptor;
  state?: ModelDownloadState;
  downloadedBytes?: number;
  totalBytes?: number;
}

export function CatalogPackCard({
  pack,
  state = "not_installed",
  downloadedBytes = 0,
  totalBytes,
}: CatalogPackCardProps) {
  const { t } = useTranslation();
  const announced = pack.installPolicy === "announced";

  return (
    <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-[var(--color-text)]">{pack.label}</p>
            {announced ? (
              <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-ghost-hover)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("model.announced")}
              </span>
            ) : (
              <StateBadge state={state} />
            )}
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">{pack.description}</p>
          <p className="font-mono text-[10px] tabular-nums text-[var(--color-text-dimmer)]">
            {announced
              ? t("model.recommendedMemory", { gb: pack.recommendedMemoryGb })
              : `${bytesToLabel(downloadedBytes)} / ${bytesToLabel(totalBytes ?? pack.estimatedSizeBytes)}`}
          </p>
        </div>
      </div>
    </div>
  );
}
