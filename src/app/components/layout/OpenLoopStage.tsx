import { AlertCircle, Music4, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GenerationPanel } from "@/app/components/generation/GenerationPanel";
import { useGenerationStore } from "@/app/lib/store";

export function OpenLoopStage() {
  const { t } = useTranslation();
  const currentGeneration = useGenerationStore((state) => state.currentGeneration);
  const generationState = useGenerationStore((state) => state.generationState);

  const title = currentGeneration?.prompt || currentGeneration?.lyrics || null;
  const isFailed = generationState.status === "failed";
  const statusTone = isFailed
    ? "border-red-500/20 bg-red-500/10 text-red-200"
    : generationState.status === "completed"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : "border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-text)]";

  return (
    <div
      className="relative flex h-full w-full flex-1 overflow-hidden"
      data-stage-visual-variant="ambience"
    >
      <div className="absolute inset-0" data-native-stage-backdrop="true">
        <div className="absolute inset-[-6%] scale-[1.06] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),rgba(0,0,0,0.08)_36%,rgba(0,0,0,0.48)_100%)] opacity-34 blur-2xl saturate-[0.92]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,14,18,0.22),rgba(11,13,16,0.54)_58%,rgba(13,15,18,0.72))]" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5 pt-6">
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-auto">
          <div className="mx-auto flex min-h-[280px] w-full max-w-6xl flex-1 items-center justify-center px-2 py-8">
            <div className="w-full max-w-3xl text-center text-[var(--color-text-dim)]">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-text)] shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
                {isFailed ? (
                  <AlertCircle size={22} />
                ) : currentGeneration ? (
                  <Music4 size={22} />
                ) : (
                  <Sparkles size={22} />
                )}
              </div>
              <p className="text-[18px] font-semibold text-white">
                {title ? title : t("stage.selectGeneration")}
              </p>
              <p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 text-[var(--color-text-dim)]">
                {currentGeneration
                  ? `${currentGeneration.audioFormat.toUpperCase()} · ${Math.round(currentGeneration.durationSeconds)}s · ${t(`history.status.${currentGeneration.status}`)}`
                  : generationState.statusMessage}
              </p>

              <div className={`mx-auto mt-6 max-w-2xl rounded-2xl border px-4 py-3 text-left text-[13px] leading-6 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl ${statusTone}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
                  <div className="min-w-0">
                    <p className="font-medium">{generationState.statusMessage}</p>
                    {generationState.error ? (
                      <p className="mt-1 text-[12px] opacity-80">
                        {generationState.error.message}
                      </p>
                    ) : currentGeneration?.seed !== undefined ? (
                      <p className="mt-1 text-[12px] opacity-80">
                        Seed {currentGeneration.seed}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl px-2 pb-2">
            <GenerationPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
