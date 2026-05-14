import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dice5, Loader2, Music2, WandSparkles } from "lucide-react";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { useToast } from "@/app/components/overlay/Toast";
import { getRandomPromptExample } from "@/app/lib/prompt-examples";
import type { ActiveGenerationTask } from "@/app/lib/types";

interface HeaderProps {
  isBusy: boolean;
  activeTasks: ActiveGenerationTask[];
  onSetField: (field: "prompt", value: string) => void;
  onEnhancePrompt: () => Promise<void>;
  onResumeTask: (id: string) => Promise<void>;
  onDiscardTask: (id: string) => Promise<void>;
}

export function Header({
  isBusy,
  activeTasks,
  onSetField,
  onEnhancePrompt,
  onResumeTask,
  onDiscardTask,
}: HeaderProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [enhancing, setEnhancing] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-accent)]">
            <Music2 size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white">
              {t("generation.composerTitle")}
            </p>
            <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
              {t("generation.composerDescription")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip label={t("generation.randomInspiration")}>
            <button
              type="button"
              className="secondary-button shrink-0 px-2"
              aria-label={t("generation.randomInspiration")}
              onClick={() => onSetField("prompt", getRandomPromptExample())}
              disabled={isBusy}
            >
              <Dice5 size={14} />
            </button>
          </Tooltip>
          <Tooltip label={t("generation.enhancePrompt")}>
            <button
              type="button"
              className="secondary-button shrink-0 px-2"
              aria-label={t("generation.enhancePrompt")}
              onClick={() => {
                void (async () => {
                  try {
                    setEnhancing(true);
                    await onEnhancePrompt();
                    addToast("success", t("toast.promptEnhanced"));
                  } catch {
                    addToast("error", t("toast.promptEnhanceFailed"));
                  } finally {
                    setEnhancing(false);
                  }
                })();
              }}
              disabled={isBusy || enhancing}
            >
              {enhancing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <WandSparkles size={14} />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {activeTasks.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1">
              {t("generation.recoveryAvailable", {
                count: activeTasks.length,
              })}
            </span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void onResumeTask(activeTasks[0].id);
              }}
              disabled={isBusy}
            >
              {t("generation.resumeTask")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void onDiscardTask(activeTasks[0].id);
              }}
              disabled={isBusy}
            >
              {t("generation.discardTask")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
