import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Cpu,
  FolderOutput,
  Hash,
  Loader2,
  Music4,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { GenerationPanel } from "@/app/components/generation/GenerationPanel";
import {
  MODEL_VARIANTS,
  useGenerationStore,
} from "@/app/lib/store";

function formatRelativeTime(iso: string, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function OpenLoopStage() {
  const { i18n, t } = useTranslation();
  const currentGeneration = useGenerationStore(
    (state) => state.currentGeneration,
  );
  const generationState = useGenerationStore((state) => state.generationState);
  const settings = useGenerationStore((state) => state.settings);
  const bootstrapStatus = useGenerationStore((state) => state.bootstrapStatus);

  const title = currentGeneration?.prompt || currentGeneration?.lyrics || null;
  const status = generationState.status;
  const isFailed = status === "failed";
  const isCompleted = status === "completed";
  const isRunning = status === "running" || status === "validating";

  const StatusIcon = isFailed
    ? AlertCircle
    : isCompleted
      ? CheckCircle2
      : isRunning
        ? Loader2
        : Sparkles;

  const statusTone = isFailed
    ? "border-red-500/25 bg-red-500/8 text-red-200"
    : isCompleted
      ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-200"
      : isRunning
        ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 text-[var(--color-accent)]"
        : "border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-text)]";

  const variantLabel = settings.modelVariant
    ? MODEL_VARIANTS[settings.modelVariant].label
    : null;
  const modelReady = bootstrapStatus.state === "ready";

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
        <div className="grid min-h-0 w-full flex-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="custom-scrollbar min-h-0 overflow-auto rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] p-3 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
            <GenerationPanel />
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] p-4 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--chrome-floating-border)] bg-[var(--color-surface)] text-[var(--color-text)]">
                {isFailed ? (
                  <AlertCircle size={18} />
                ) : currentGeneration ? (
                  <Music4 size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
              </div>
              <p
                className="line-clamp-2 text-[15px] font-semibold leading-tight text-white"
                title={title ?? undefined}
              >
                {title ?? t("stage.selectGeneration")}
              </p>
              {currentGeneration ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-light)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                    {currentGeneration.audioFormat.toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-light)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                    {Math.round(currentGeneration.durationSeconds)}s
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      currentGeneration.status === "completed"
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : currentGeneration.status === "failed"
                          ? "border border-red-500/30 bg-red-500/10 text-red-200"
                          : "border border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text-dim)]"
                    }`}
                  >
                    {t(`history.status.${currentGeneration.status}`)}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-[12px] leading-5 text-[var(--color-text-dim)]">
                  {generationState.statusMessage}
                </p>
              )}
            </div>

            <div
              className={`rounded-2xl border px-4 py-3 text-left text-[13px] leading-6 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl ${statusTone}`}
            >
              <div className="flex items-start gap-2.5">
                <StatusIcon
                  size={14}
                  className={`mt-1 shrink-0 ${isRunning ? "animate-spin" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[13px] font-medium leading-5">
                    {generationState.statusMessage}
                  </p>
                  {generationState.error ? (
                    <p className="mt-1 break-words text-[11px] leading-5 opacity-80">
                      {generationState.error.message}
                    </p>
                  ) : currentGeneration?.seed !== undefined ? (
                    <p className="mt-1 font-mono text-[11px] tabular-nums opacity-70">
                      seed · {currentGeneration.seed}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] p-4 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                    {t("settings.models")}
                  </p>
                  <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)]/60 px-3 py-2.5">
                    <Cpu
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--color-text-dim)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-white">
                        {variantLabel ?? t("model.noModel")}
                      </p>
                      <p
                        className={`mt-0.5 text-[11px] ${
                          modelReady
                            ? "text-emerald-300/85"
                            : "text-[var(--color-text-dim)]"
                        }`}
                      >
                        {modelReady
                          ? t("model.ready")
                          : t("model.notInstalled")}
                      </p>
                    </div>
                  </div>
                </div>

                {currentGeneration ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                      {t("history.localRuns")}
                    </p>
                    <ul className="space-y-1.5 text-[11px] text-[var(--color-text-dim)]">
                      {currentGeneration.outputPath ? (
                        <li className="flex items-start gap-2">
                          <FolderOutput
                            size={12}
                            className="mt-0.5 shrink-0 opacity-70"
                          />
                          <span
                            className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-4"
                            title={currentGeneration.outputPath}
                          >
                            {currentGeneration.outputPath}
                          </span>
                        </li>
                      ) : null}
                      <li className="flex items-center gap-2">
                        <Calendar
                          size={12}
                          className="shrink-0 opacity-70"
                        />
                        <span>
                          {formatRelativeTime(
                            currentGeneration.createdAt,
                            i18n.resolvedLanguage ?? "en",
                          )}
                        </span>
                      </li>
                      {currentGeneration.seed !== undefined ? (
                        <li className="flex items-center gap-2">
                          <Hash size={12} className="shrink-0 opacity-70" />
                          <span className="font-mono tabular-nums">
                            {currentGeneration.seed}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
