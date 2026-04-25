import { Music4, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GenerationPanel } from "@/app/components/generation/GenerationPanel";
import { useGenerationStore } from "@/app/lib/store";

export function OpenLoopStage() {
  const { t } = useTranslation();
  const currentGeneration = useGenerationStore((state) => state.currentGeneration);
  const generationState = useGenerationStore((state) => state.generationState);

  const title = currentGeneration?.prompt || currentGeneration?.lyrics || null;

  return (
    <div
      className="relative flex h-full w-full flex-1 overflow-hidden"
      data-stage-visual-variant="ambience"
    >
      <div className="absolute inset-0" data-native-stage-backdrop="true">
        <div className="absolute inset-[-6%] scale-[1.06] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),rgba(0,0,0,0.08)_36%,rgba(0,0,0,0.48)_100%)] opacity-34 blur-2xl saturate-[0.92]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,14,18,0.22),rgba(11,13,16,0.54)_58%,rgba(13,15,18,0.72))]" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center justify-center px-8 py-10">
          <div className="max-w-xl text-center text-[var(--color-text-dim)]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-text)] shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
              {currentGeneration ? <Music4 size={22} /> : <Sparkles size={22} />}
            </div>
            <p className="text-[15px] font-medium text-white">
              {title ? title : t("stage.selectGeneration")}
            </p>
            <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-[var(--color-text-dim)]">
              {currentGeneration
                ? `${currentGeneration.audioFormat.toUpperCase()} · ${Math.round(currentGeneration.durationSeconds)}s · ${t(`history.status.${currentGeneration.status}`)}`
                : generationState.statusMessage}
            </p>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[min(500px,40vw)] max-w-full items-stretch justify-end">
          <div className="pointer-events-auto h-full w-full overflow-auto custom-scrollbar border-l border-[color-mix(in_srgb,var(--color-border)_86%,transparent)] bg-[color-mix(in_srgb,var(--color-sidebar)_92%,transparent)] shadow-[-12px_0_32px_rgba(0,0,0,0.22)] backdrop-blur-[20px]">
            <GenerationPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
