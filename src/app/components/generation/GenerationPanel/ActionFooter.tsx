import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Play, WandSparkles } from "lucide-react";
import type { GenerationState } from "@/app/lib/types";

interface ActionFooterProps {
  isBusy: boolean;
  isFailed: boolean;
  canSubmit: boolean;
  generationState: GenerationState;
  elapsedTime: number;
  modelReady: boolean;
  onCancelGeneration: () => void;
  onResetForm: () => void;
  onRetry: () => void;
}

export function ActionFooter({
  isBusy,
  isFailed,
  canSubmit,
  generationState,
  elapsedTime,
  modelReady,
  onCancelGeneration,
  onResetForm,
  onRetry,
}: ActionFooterProps) {
  const { t } = useTranslation();

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const submitLabel = useMemo(() => {
    if (generationState.status === "validating")
      return t("generation.validating");
    if (generationState.status === "running")
      return t("generation.generatingElapsed", {
        time: formatElapsed(elapsedTime),
      });
    return t("generation.generate");
  }, [generationState.status, elapsedTime, t]);

  return (
    <>
      {/* Action buttons row */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        {isBusy ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void onCancelGeneration();
            }}
          >
            {t("common.cancel")}
          </button>
        ) : null}
        <button
          className="secondary-button"
          type="button"
          onClick={onResetForm}
          disabled={isBusy}
        >
          {t("generation.reset")}
        </button>
        {isFailed && !isBusy && (
          <button
            className="secondary-button"
            type="button"
            onClick={onRetry}
          >
            <Play size={13} />
            {t("generation.retry")}
          </button>
        )}
        <p className="min-w-0 flex-1 text-[11px] leading-[1.4] text-[var(--color-text-dim)]">
          {modelReady ? t("generation.localReady") : t("model.chooseFirst")}
        </p>
      </div>

      {/* Generate button - full width, prominent */}
      <button
        className="primary-button w-full py-3 text-[14px] font-semibold disabled:opacity-50"
        type="submit"
        disabled={isBusy || !canSubmit}
      >
        {isBusy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <WandSparkles size={16} />
        )}
        {submitLabel}
      </button>
    </>
  );
}
