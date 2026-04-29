import { GenerationPanel } from "@/app/components/generation/GenerationPanel";
import { useGenerationStore } from "@/app/lib/store";

export function OpenLoopStage() {
  const generationState = useGenerationStore((state) => state.generationState);

  const isFailed = generationState.status === "failed";
  const isRunning = generationState.status === "running" || generationState.status === "validating";

  return (
    <div
      className="relative flex h-full w-full flex-1 overflow-hidden"
      data-stage-visual-variant="ambience"
    >
      <div className="absolute inset-0" data-native-stage-backdrop="true">
        <div className="absolute inset-[-6%] scale-[1.06] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),rgba(0,0,0,0.08)_36%,rgba(0,0,0,0.48)_100%)] opacity-34 blur-2xl saturate-[0.92]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,14,18,0.22),rgba(11,13,16,0.54)_58%,rgba(13,15,18,0.72))]" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden px-6 pb-5 pt-6">
        <div className="min-h-0 w-full overflow-auto">
          {/* Status banner */}
          {(isFailed || isRunning) && (
            <div
              className={`mb-3 flex items-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-medium ${
                isFailed
                  ? "border-red-500/25 bg-red-500/8 text-red-200"
                  : "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 text-[var(--color-accent)]"
              }`}
            >
              {isRunning && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              )}
              {generationState.statusMessage}
              {generationState.error && (
                <span className="ml-2 opacity-80">{generationState.error.message}</span>
              )}
            </div>
          )}

          <div className="custom-scrollbar rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] p-3 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
            <GenerationPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
