import { useCallback } from "react";
import { AlertCircle, ClipboardCopy, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Collapsible } from "@/app/components/ui/Collapsible";
import { GenerationPanel } from "@/app/components/generation/GenerationPanel";
import * as api from "@/app/lib/api";
import { useGenerationStore } from "@/app/lib/store";
import { buildGitHubIssueUrl } from "@/app/lib/error-help";

export function OpenLoopStage() {
  const { t } = useTranslation();
  const generationState = useGenerationStore((state) => state.generationState);
  const runGeneration = useGenerationStore((state) => state.runGeneration);

  const isFailed = generationState.status === "failed";
  const isRunning = generationState.status === "running" || generationState.status === "validating";

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
    void api.openExternalUrl(url).catch(() => {});
  }, [error]);

  return (
    <div className="relative flex h-full w-full flex-1 overflow-hidden">
      <div className="relative flex min-h-0 flex-1 overflow-hidden px-6 pb-5 pt-6">
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
            <div className="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--color-destructive)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] px-4 py-3 text-[13px]">
              {/* Header row */}
              <div className="flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0 text-[var(--color-destructive)]" />
                <span className="font-semibold text-[var(--color-text)]">
                  {t("stage.somethingWentWrong")}
                </span>
              </div>

              {/* Expandable details */}
              <Collapsible
                title={
                  <span className="text-[12px] font-medium text-[var(--color-destructive)]">
                    {t("stage.showDetails")}
                  </span>
                }
                className="mt-2"
                headerClassName="!px-0 !py-1 !text-[var(--color-destructive)]"
                contentClassName="rounded-lg bg-[var(--color-ghost-hover)] p-3 font-mono text-[12px] text-[var(--color-destructive)] space-y-1"
              >
                <div>
                  <span className="font-semibold text-[var(--color-destructive)]">
                    {t("stage.errorCode")}
                  </span>{" "}
                  {error.code}
                </div>
                <div>
                  <span className="font-semibold text-[var(--color-destructive)]">
                    {t("stage.errorMessage")}
                  </span>{" "}
                  {error.message}
                </div>
                {error.details && (
                  <div>
                    <span className="font-semibold text-[var(--color-destructive)]">
                      {t("stage.errorDetails")}
                    </span>{" "}
                    {error.details}
                  </div>
                )}
              </Collapsible>

              {/* Action buttons */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-destructive)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)]"
                >
                  <RefreshCw size={14} />
                  {t("stage.retry")}
                </button>
                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-ghost-hover)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                >
                  <ClipboardCopy size={14} />
                  {t("stage.copyDetails")}
                </button>
                <button
                  type="button"
                  onClick={handleGetHelp}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-ghost-hover)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                >
                  <ExternalLink size={14} />
                  {t("stage.getHelp")}
                </button>
              </div>
            </div>
          )}

          <div className="custom-scrollbar rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
            <GenerationPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
