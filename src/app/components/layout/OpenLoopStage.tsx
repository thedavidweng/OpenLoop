import { useCallback } from "react";
import { AlertCircle, ClipboardCopy, ExternalLink, RefreshCw } from "lucide-react";
import { Collapsible } from "@/app/components/ui/Collapsible";
import { GenerationPanel } from "@/app/components/generation/GenerationPanel";
import { useGenerationStore } from "@/app/lib/store";
import { buildGitHubIssueUrl } from "@/app/lib/error-help";

export function OpenLoopStage() {
  const generationState = useGenerationStore((state) => state.generationState);
  const runGeneration = useGenerationStore((state) => state.runGeneration);

  const isFailed = generationState.status === "failed";
  const isRunning =
    generationState.status === "running" ||
    generationState.status === "validating";

  const error = generationState.error;

  const handleRetry = useCallback(() => {
    void runGeneration();
  }, [runGeneration]);

  const handleCopyDetails = useCallback(() => {
    if (!error) return;
    const payload = JSON.stringify(
      { code: error.code, message: error.message, details: error.details },
      null,
      2,
    );
    void navigator.clipboard.writeText(payload);
  }, [error]);

  const handleGetHelp = useCallback(() => {
    if (!error) return;
    const url = buildGitHubIssueUrl(error);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [error]);

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
          {/* Running banner */}
          {isRunning && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-2 text-[12px] font-medium text-[var(--color-accent)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              {generationState.statusMessage}
            </div>
          )}

          {/* Failed error banner */}
          {isFailed && error && (
            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-[13px]">
              {/* Header row */}
              <div className="flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0 text-red-300" />
                <span className="font-semibold text-white">
                  Something went wrong
                </span>
              </div>

              {/* Expandable details */}
              <Collapsible
                title={
                  <span className="text-[12px] font-medium text-red-200/70 hover:text-red-200">
                    Show details
                  </span>
                }
                className="mt-2"
                headerClassName="!px-0 !py-1 !text-red-200/70 hover:!text-red-200"
                contentClassName="rounded-lg bg-white/5 p-3 font-mono text-[12px] text-red-200/90 space-y-1"
              >
                <div>
                  <span className="font-semibold text-red-200">Code:</span>{" "}
                  {error.code}
                </div>
                <div>
                  <span className="font-semibold text-red-200">Message:</span>{" "}
                  {error.message}
                </div>
                {error.details && (
                  <div>
                    <span className="font-semibold text-red-200">Details:</span>{" "}
                    {error.details}
                  </div>
                )}
              </Collapsible>

              {/* Action buttons */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-200 transition-colors hover:bg-red-500/20"
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ClipboardCopy size={14} />
                  Copy details
                </button>
                <button
                  type="button"
                  onClick={handleGetHelp}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink size={14} />
                  Get help
                </button>
              </div>
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
