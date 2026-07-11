import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clipboard,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGenerationStore } from "@/app/lib/store";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { useToast } from "@/app/components/overlay/Toast";
import * as api from "@/app/lib/api";
import type { FailedRun, GenerationFormValues, GenerationRequest } from "@/app/lib/types";
import { DEFAULT_GENERATION_FORM_VALUES } from "@/app/lib/validation";

/** Converts a raw GenerationRequest (parsed from failed run JSON) to GenerationFormValues. */
function requestToFormValues(request: GenerationRequest): GenerationFormValues {
  const defaults = DEFAULT_GENERATION_FORM_VALUES;
  return {
    ...defaults,
    prompt: request.prompt,
    negativePrompt: request.negativePrompt ?? "",
    lyrics: request.lyrics,
    vocalLanguage: request.vocalLanguage,
    durationSeconds: String(Math.round(request.durationSeconds)),
    bpmMode: request.bpm === undefined ? "auto" : "manual",
    bpm: request.bpm === undefined ? "" : String(request.bpm),
    keyScale: request.keyScale ?? "auto",
    timeSignature: request.timeSignature,
    audioFormat: request.audioFormat,
    model: request.model ?? defaults.model,
    taskType: request.taskType,
    lmModelPath: request.lmModelPath ?? "",
    lmBackend: request.lmBackend ?? "mlx",
    thinking: request.thinking,
    inferenceSteps: String(request.inferenceSteps),
    guidanceScale: String(request.guidanceScale),
    useFormat: request.useFormat,
    useCotCaption: request.useCotCaption,
    useCotLanguage: request.useCotLanguage,
    constrainedDecoding: request.constrainedDecoding,
    referenceAudioPath: request.referenceAudioPath ?? "",
    srcAudioPath: request.srcAudioPath ?? "",
    instruction: request.instruction ?? "",
    repaintingStart: request.repaintingStart === undefined ? "" : String(request.repaintingStart),
    repaintingEnd: request.repaintingEnd === undefined ? "" : String(request.repaintingEnd),
    audioCoverStrength:
      request.audioCoverStrength === undefined ? "1.0" : String(request.audioCoverStrength),
    useRandomSeed: request.useRandomSeed,
    seed: request.seed === undefined ? "" : String(request.seed),
  };
}

export function FailedRunsDrawer() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [failedRuns, setFailedRuns] = useState<FailedRun[]>([]);
  const [expanded, setExpanded] = useState(false);
  const setField = useGenerationStore((state) => state.setField);
  const selectGenerationRecord = useGenerationStore((state) => state.selectGenerationRecord);

  const fetchFailedRuns = useCallback(async () => {
    if (!api.isTauriRuntime()) return;
    try {
      const runs = await api.listFailedRuns(50);
      setFailedRuns(runs);
    } catch (error) {
      console.warn("Failed to fetch failed runs:", error);
    }
  }, []);

  useEffect(() => {
    void fetchFailedRuns();
  }, [fetchFailedRuns]);

  const handleRetry = useCallback(
    (run: FailedRun) => {
      if (!run.requestJson) return;
      try {
        const request = JSON.parse(run.requestJson) as GenerationRequest;
        const form = requestToFormValues(request);
        setField("prompt", form.prompt);
        setField("negativePrompt", form.negativePrompt);
        setField("lyrics", form.lyrics);
        setField("vocalLanguage", form.vocalLanguage);
        setField("durationSeconds", form.durationSeconds);
        setField("bpmMode", form.bpmMode);
        setField("bpm", form.bpm);
        setField("keyScale", form.keyScale);
        setField("timeSignature", form.timeSignature);
        setField("audioFormat", form.audioFormat);
        setField("model", form.model);
        setField("taskType", form.taskType);
        setField("lmModelPath", form.lmModelPath);
        setField("lmBackend", form.lmBackend);
        setField("thinking", form.thinking);
        setField("inferenceSteps", form.inferenceSteps);
        setField("guidanceScale", form.guidanceScale);
        setField("useFormat", form.useFormat);
        setField("useCotCaption", form.useCotCaption);
        setField("useCotLanguage", form.useCotLanguage);
        setField("constrainedDecoding", form.constrainedDecoding);
        setField("referenceAudioPath", form.referenceAudioPath);
        setField("srcAudioPath", form.srcAudioPath);
        setField("instruction", form.instruction);
        setField("repaintingStart", form.repaintingStart);
        setField("repaintingEnd", form.repaintingEnd);
        setField("audioCoverStrength", form.audioCoverStrength);
        setField("useRandomSeed", form.useRandomSeed);
        setField("seed", form.seed);
        selectGenerationRecord("");
        addToast("info", t("history.failedRunRetryLoaded"));
      } catch {
        addToast("error", t("history.failedRunRetryFailed"));
      }
    },
    [addToast, selectGenerationRecord, setField, t],
  );

  const handleCopyDiagnostics = useCallback(
    (run: FailedRun) => {
      const parts: string[] = [];
      if (run.errorCode) parts.push(`Error Code: ${run.errorCode}`);
      if (run.errorMessage) parts.push(`Error Message: ${run.errorMessage}`);
      if (run.errorDetails) parts.push(`Error Details: ${run.errorDetails}`);
      void navigator.clipboard.writeText(parts.join("\n"));
      addToast("info", t("history.failedRunCopied"));
    },
    [addToast, t],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      if (!api.isTauriRuntime()) return;
      try {
        await api.deleteFailedRun(id);
        setFailedRuns((runs) => runs.filter((run) => run.id !== id));
        addToast("info", t("history.failedRunRemoved"));
      } catch (error) {
        console.warn("Failed to remove failed run:", error);
        addToast(
          "error",
          t("history.failedRunRemoveFailed", { defaultValue: "Failed to remove run." }),
        );
      }
    },
    [addToast, t],
  );

  const handleClearAll = useCallback(async () => {
    if (!api.isTauriRuntime()) return;
    try {
      await api.clearFailedRuns();
      setFailedRuns([]);
      addToast("info", t("history.failedRunCleared"));
    } catch (error) {
      console.warn("Failed to clear failed runs:", error);
      addToast(
        "error",
        t("history.failedRunClearFailed", { defaultValue: "Failed to clear runs." }),
      );
    }
  }, [addToast, t]);

  if (failedRuns.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-[color-mix(in_srgb,var(--color-border)_86%,transparent)] px-3 py-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-[11px] font-semibold tracking-wide text-[var(--color-text-dim)]"
      >
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-400" />
          {t("history.failedRuns", { count: failedRuns.length })}
        </span>
        <div className="flex items-center gap-1">
          <Tooltip label={t("common.clearAll")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleClearAll();
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-dimmer)] hover:bg-[var(--color-ghost-hover)] hover:text-white"
            >
              <Trash2 size={10} />
            </button>
          </Tooltip>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 max-h-48 space-y-1.5 overflow-auto">
          {failedRuns.map((run) => (
            <div
              key={run.id}
              className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-red-300">
                    {run.errorCode ?? t("history.unknownError")}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--color-text-dim)]">
                    {run.errorMessage ?? t("history.noErrorMessage")}
                  </p>
                  <p className="mt-0.5 text-[9px] text-[var(--color-text-dimmer)]">
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                <XCircle
                  size={14}
                  className="mt-0.5 shrink-0 cursor-pointer text-[var(--color-text-dimmer)] hover:text-red-400"
                  onClick={() => void handleRemove(run.id)}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <Tooltip label={t("history.failedRunRetry")}>
                  <button
                    type="button"
                    onClick={() => handleRetry(run)}
                    disabled={!run.requestJson}
                    className="inline-flex h-5 items-center gap-1 rounded bg-[var(--color-ghost-hover)] px-1.5 text-[9px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw size={9} />
                    {t("common.retry")}
                  </button>
                </Tooltip>
                <Tooltip label={t("history.failedRunCopyDiagnostics")}>
                  <button
                    type="button"
                    onClick={() => handleCopyDiagnostics(run)}
                    className="inline-flex h-5 items-center gap-1 rounded bg-[var(--color-ghost-hover)] px-1.5 text-[9px] font-medium text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-ghost-hover)] hover:text-white"
                  >
                    <Clipboard size={9} />
                    {t("common.copy")}
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
