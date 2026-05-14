import { useCallback, useEffect, useRef, useState } from "react";
import {
  MODEL_VARIANTS,
  isModelDownloaded,
  modelDownloadStateForVariant,
  useGenerationStore,
} from "@/app/lib/store";
import { Header } from "./Header";
import { FormBody } from "./FormBody";
import { ActionFooter } from "./ActionFooter";

export function GenerationPanel() {
  const form = useGenerationStore((state) => state.form);
  const modelStatuses = useGenerationStore((state) => state.modelStatuses);
  const validationErrors = useGenerationStore(
    (state) => state.validationErrors,
  );
  const generationState = useGenerationStore((state) => state.generationState);
  const currentRequest = useGenerationStore((state) => state.currentRequest);
  const settings = useGenerationStore((state) => state.settings);
  const runGeneration = useGenerationStore((state) => state.runGeneration);
  const cancelGeneration = useGenerationStore(
    (state) => state.cancelGeneration,
  );
  const enhancePrompt = useGenerationStore((state) => state.enhancePrompt);
  const activeTasks = useGenerationStore((state) => state.activeTasks);
  const resumeActiveTask = useGenerationStore(
    (state) => state.resumeActiveTask,
  );
  const discardActiveTask = useGenerationStore(
    (state) => state.discardActiveTask,
  );
  const resetForm = useGenerationStore((state) => state.resetForm);
  const setField = useGenerationStore((state) => state.setField);
  const openSettings = useGenerationStore((state) => state.openSettings);

  const [tweakOpen, setTweakOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const lyricsRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy =
    generationState.status === "validating" ||
    generationState.status === "running";
  const isFailed = generationState.status === "failed";
  const hasErrors = Object.keys(validationErrors).length > 0;
  const selectedModel = settings.modelVariant
    ? MODEL_VARIANTS[settings.modelVariant]
    : null;
  const modelReady = isModelDownloaded(settings, settings.modelVariant);
  const canSubmit = currentRequest !== null && !hasErrors && modelReady;
  const selectedModelState = modelDownloadStateForVariant(
    modelStatuses,
    settings.modelVariant,
  );

  // Elapsed timer for generating state
  useEffect(() => {
    if (generationState.status === "running") {
      setElapsedTime(0);
      timerRef.current = setInterval(
        () => setElapsedTime((prev) => prev + 1),
        1000,
      );
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [generationState.status]);

  // Auto-expand lyrics when content exists
  useEffect(() => {
    if (form.lyrics.trim()) {
      setField("instrumental", false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = useCallback(() => {
    void runGeneration();
  }, [runGeneration]);







  // Auto-expand tweak section if there are errors
  const hasTweakErrors = (
    [
      "negativePrompt",
      "inferenceSteps",
      "guidanceScale",
      "repaintingStart",
      "repaintingEnd",
      "audioCoverStrength",
      "seed",
    ] as const
  ).some((key) => validationErrors[key]);

  useEffect(() => {
    if (hasTweakErrors && !tweakOpen) {
      setTweakOpen(true);
    }
  }, [hasTweakErrors]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="flex flex-col h-full rounded-[28px] border border-[var(--playback-bar-surface-border)] bg-[var(--playback-bar-surface-bg)] shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
      <form
        className="flex flex-col flex-1 min-h-0"
        onSubmit={(event) => {
          event.preventDefault();
          void runGeneration();
        }}
      >
        <div className="flex-1 overflow-auto space-y-4 p-4">
        <Header
          isBusy={isBusy}
          activeTasks={activeTasks}
          prompt={form.prompt}
          onSetField={(field, value) => setField(field, value)}
          onEnhancePrompt={enhancePrompt}
          onResumeTask={resumeActiveTask}
          onDiscardTask={discardActiveTask}
        />

          <FormBody
            form={form}
            isBusy={isBusy}
            validationErrors={validationErrors}
            selectedModel={selectedModel as import("@/app/lib/types").ModelCatalogItem | null}
            modelReady={modelReady}
            selectedModelState={selectedModelState}
            tweakOpen={tweakOpen}
            setTweakOpen={setTweakOpen}
            expertOpen={expertOpen}
            setExpertOpen={setExpertOpen}
            openSettings={openSettings}
            lyricsRef={lyricsRef}
            setField={setField}
          />
        </div>

        <div className="shrink-0 p-4 pt-0">
          <ActionFooter
            isBusy={isBusy}
            isFailed={isFailed}
            canSubmit={canSubmit}
            generationState={generationState}
            elapsedTime={elapsedTime}
            modelReady={modelReady}
            onCancelGeneration={cancelGeneration}
            onResetForm={resetForm}
            onRetry={handleRetry}
          />
        </div>
      </form>
    </section>
  );
}
