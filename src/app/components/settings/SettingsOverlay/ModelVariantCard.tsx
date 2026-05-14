import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import {
  MODEL_PACKS,
  MODEL_VARIANTS,
  packIdForVariant,
} from "@/app/lib/model-packs";
import type { ModelDownloadState, ModelVariant } from "@/app/lib/types";

interface ModelVariantCardProps {
  variant: ModelVariant;
  selected: boolean;
  packReady: boolean;
  packState: ModelDownloadState;
  busy: boolean;
  onSelect: () => void;
}

export function ModelVariantCard({
  variant,
  selected,
  packReady,
  packState,
  busy,
  onSelect,
}: ModelVariantCardProps) {
  const { t } = useTranslation();
  const meta = MODEL_VARIANTS[variant];
  const packId = packIdForVariant(variant);

  return (
    <div
      className={`rounded-lg border p-3.5 transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
          : "border-[var(--color-border-light)] bg-[var(--color-surface)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-white">{meta.label}</p>
            {selected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/16 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent)]">
                <CheckCircle2 size={10} />
                {t("model.active")}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
            {t(`modelProfiles.${variant}.description`)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-dimmer)]">
            {MODEL_PACKS[packId].label} · {t(`model.${packState}`)}
          </p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={busy || (!packReady && !selected)}
          className={`inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            selected
              ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 text-white"
              : "border-[var(--color-border-light)] bg-[var(--color-surface-muted)] text-[var(--color-text)] hover:bg-[var(--color-hover)] hover:text-white"
          }`}
        >
          {selected ? t("model.selected") : t("model.select")}
        </button>
      </div>
    </div>
  );
}
