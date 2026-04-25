import type { ChangeEvent } from "react";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WandSparkles } from "lucide-react";
import { MODEL_VARIANTS, useGenerationStore } from "@/app/lib/store";
import type { GenerationFormValues } from "@/app/lib/types";

const SELECT_OPTIONS = {
  vocalLanguage: ["en", "zh", "ja", "ko", "auto"] as const,
  timeSignature: ["2", "3", "4", "6"] as const,
  audioFormat: ["wav", "mp3", "flac", "ogg"] as const,
  taskType: ["text2music", "cover", "repaint", "lego", "extract", "complete"] as const,
  lmBackend: ["mlx", "pt", "vllm"] as const,
  lmModelPath: ["", "acestep-5Hz-lm-0.6B", "acestep-5Hz-lm-1.7B", "acestep-5Hz-lm-4B"] as const,
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-400">{message}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] uppercase text-[var(--color-text-dim)]">{children}</span>;
}

export function GenerationPanel() {
  const { t } = useTranslation();
  const form = useGenerationStore((state) => state.form);
  const validationErrors = useGenerationStore((state) => state.validationErrors);
  const generationState = useGenerationStore((state) => state.generationState);
  const settings = useGenerationStore((state) => state.settings);
  const runGeneration = useGenerationStore((state) => state.runGeneration);
  const cancelGeneration = useGenerationStore((state) => state.cancelGeneration);
  const resetForm = useGenerationStore((state) => state.resetForm);
  const setField = useGenerationStore((state) => state.setField);
  const openSettings = useGenerationStore((state) => state.openSettings);

  const isBusy = generationState.status === "validating" || generationState.status === "running";
  const hasErrors = Object.keys(validationErrors).length > 0;
  const selectedModel = settings.modelVariant ? MODEL_VARIANTS[settings.modelVariant] : null;
  const modelReady = settings.modelVariant
    ? settings.downloadedModels.includes(settings.modelVariant)
    : false;

  const submitLabel = useMemo(() => {
    if (generationState.status === "validating") return t("generation.validating");
    if (generationState.status === "running") return t("generation.generating");
    return t("generation.generate");
  }, [generationState.status, t]);

  const handleTextFieldChange =
    (
      field: keyof Pick<
        GenerationFormValues,
        | "prompt"
        | "negativePrompt"
        | "lyrics"
        | "vocalLanguage"
        | "durationSeconds"
        | "bpm"
        | "keyScale"
        | "model"
        | "lmModelPath"
        | "inferenceSteps"
        | "guidanceScale"
        | "seed"
        | "referenceAudioPath"
        | "srcAudioPath"
        | "instruction"
        | "repaintingStart"
        | "repaintingEnd"
        | "audioCoverStrength"
      >,
    ) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setField(field, event.target.value);
    };

  return (
    <section className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
            {t("generation.workspace")}
          </p>
          <h1 className="mt-1 text-[22px] font-semibold text-white">{t("generation.title")}</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-dim)]">
            {t("generation.description")}
          </p>
        </div>
        <div className="hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3 text-[var(--color-accent)] md:block">
          <WandSparkles size={18} />
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void runGeneration();
        }}
      >
        <div className="space-y-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
          <label className="space-y-1">
            <FieldLabel>{t("generation.prompt")}</FieldLabel>
            <textarea
              className="min-h-[112px] w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
              placeholder={t("generation.promptPlaceholder")}
              value={form.prompt}
              onChange={handleTextFieldChange("prompt")}
              disabled={isBusy}
            />
            <FieldError message={validationErrors.prompt} />
          </label>

          <label className="space-y-1">
            <FieldLabel>{t("generation.negativePrompt")}</FieldLabel>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
              placeholder={t("generation.negativePromptPlaceholder")}
              value={form.negativePrompt}
              onChange={handleTextFieldChange("negativePrompt")}
              disabled={isBusy}
            />
            <FieldError message={validationErrors.negativePrompt} />
          </label>

          <label className="space-y-1">
            <FieldLabel>{t("generation.lyrics")}</FieldLabel>
            <textarea
              className="min-h-[160px] w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
              placeholder={t("generation.lyricsPlaceholder")}
              value={form.lyrics}
              onChange={handleTextFieldChange("lyrics")}
              disabled={isBusy}
            />
            <FieldError message={validationErrors.lyrics} />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
              {t("generation.musicalControls")}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <FieldLabel>{t("generation.language")}</FieldLabel>
                <select className="select-input" value={form.vocalLanguage} onChange={(event) => setField("vocalLanguage", event.target.value)} disabled={isBusy}>
                  {SELECT_OPTIONS.vocalLanguage.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.duration")}</FieldLabel>
                <input className="text-input" type="number" min="10" max="600" step="1" value={form.durationSeconds} onChange={handleTextFieldChange("durationSeconds")} disabled={isBusy} />
                <FieldError message={validationErrors.durationSeconds} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.bpm")}</FieldLabel>
                <input className="text-input" type="number" min="30" max="300" step="1" placeholder={t("generation.optional")} value={form.bpm} onChange={handleTextFieldChange("bpm")} disabled={isBusy} />
                <FieldError message={validationErrors.bpm} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.keyScale")}</FieldLabel>
                <input className="text-input" placeholder={t("generation.keyScalePlaceholder")} value={form.keyScale} onChange={handleTextFieldChange("keyScale")} disabled={isBusy} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.timeSignature")}</FieldLabel>
                <select className="select-input" value={form.timeSignature} onChange={(event) => setField("timeSignature", event.target.value as GenerationFormValues["timeSignature"])} disabled={isBusy}>
                  {SELECT_OPTIONS.timeSignature.map((option) => <option key={option} value={option}>{option}/4</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.format")}</FieldLabel>
                <select className="select-input" value={form.audioFormat} onChange={(event) => setField("audioFormat", event.target.value as GenerationFormValues["audioFormat"])} disabled={isBusy}>
                  {SELECT_OPTIONS.audioFormat.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
              {t("generation.modelAdvanced")}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <FieldLabel>{t("generation.taskType")}</FieldLabel>
                <select className="select-input" value={form.taskType} onChange={(event) => setField("taskType", event.target.value as GenerationFormValues["taskType"])} disabled={isBusy}>
                  {SELECT_OPTIONS.taskType.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <div className="space-y-1 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-3">
                <FieldLabel>{t("generation.model")}</FieldLabel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-white">{selectedModel?.label ?? t("model.noModel")}</p>
                    <p className="text-[12px] text-[var(--color-text-dim)]">{selectedModel?.description ?? t("model.chooseFirst")}</p>
                  </div>
                  <button type="button" onClick={openSettings} className="secondary-button">
                    {modelReady ? t("model.select") : t("model.download")}
                  </button>
                </div>
              </div>
              <label className="space-y-1">
                <FieldLabel>{t("generation.lmModel")}</FieldLabel>
                <select className="select-input" value={form.lmModelPath} onChange={(event) => setField("lmModelPath", event.target.value)} disabled={isBusy || !form.thinking}>
                  {SELECT_OPTIONS.lmModelPath.map((option) => <option key={option || "none"} value={option}>{option || "None"}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.lmBackend")}</FieldLabel>
                <select className="select-input" value={form.lmBackend} onChange={(event) => setField("lmBackend", event.target.value as GenerationFormValues["lmBackend"])} disabled={isBusy || !form.thinking}>
                  {SELECT_OPTIONS.lmBackend.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.inferenceSteps")}</FieldLabel>
                <input className="text-input" type="number" min="1" value={form.inferenceSteps} onChange={handleTextFieldChange("inferenceSteps")} disabled={isBusy} />
                <FieldError message={validationErrors.inferenceSteps} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.guidanceScale")}</FieldLabel>
                <input className="text-input" type="number" min="0.1" step="0.1" value={form.guidanceScale} onChange={handleTextFieldChange("guidanceScale")} disabled={isBusy} />
                <FieldError message={validationErrors.guidanceScale} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.seed")}</FieldLabel>
                <input className="text-input disabled:opacity-60" type="number" step="1" placeholder={form.useRandomSeed ? t("generation.randomSeedEnabled") : t("generation.optional")} value={form.seed} onChange={handleTextFieldChange("seed")} disabled={isBusy || form.useRandomSeed} />
                <FieldError message={validationErrors.seed} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {([
                ["thinking", "generation.thinking", "generation.thinkingDesc"],
                ["useRandomSeed", "generation.randomSeed", "generation.randomSeedDesc"],
                ["useFormat", "generation.useFormat", ""],
                ["useCotCaption", "generation.cotCaption", ""],
                ["useCotLanguage", "generation.cotLanguage", ""],
                ["constrainedDecoding", "generation.constrained", ""],
              ] as const).map(([field, titleKey, descriptionKey]) => (
                <label key={field} className="flex items-start gap-3 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-3">
                  <input type="checkbox" className="mt-0.5" checked={Boolean(form[field])} onChange={(event) => setField(field, event.target.checked)} disabled={isBusy} />
                  <div>
                    <p className="text-[13px] font-medium text-white">{t(titleKey)}</p>
                    {descriptionKey ? <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">{t(descriptionKey)}</p> : null}
                  </div>
                </label>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <FieldLabel>{t("generation.referenceAudio")}</FieldLabel>
                <input className="text-input" value={form.referenceAudioPath} onChange={handleTextFieldChange("referenceAudioPath")} disabled={isBusy} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.sourceAudio")}</FieldLabel>
                <input className="text-input" value={form.srcAudioPath} onChange={handleTextFieldChange("srcAudioPath")} disabled={isBusy} />
              </label>
              <label className="space-y-1 md:col-span-2">
                <FieldLabel>{t("generation.instruction")}</FieldLabel>
                <input className="text-input" value={form.instruction} onChange={handleTextFieldChange("instruction")} disabled={isBusy} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.repaintStart")}</FieldLabel>
                <input className="text-input" type="number" min="0" step="0.1" value={form.repaintingStart} onChange={handleTextFieldChange("repaintingStart")} disabled={isBusy} />
                <FieldError message={validationErrors.repaintingStart} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.repaintEnd")}</FieldLabel>
                <input className="text-input" type="number" min="-1" step="0.1" value={form.repaintingEnd} onChange={handleTextFieldChange("repaintingEnd")} disabled={isBusy} />
                <FieldError message={validationErrors.repaintingEnd} />
              </label>
              <label className="space-y-1">
                <FieldLabel>{t("generation.coverStrength")}</FieldLabel>
                <input className="text-input" type="number" min="0" max="1" step="0.05" value={form.audioCoverStrength} onChange={handleTextFieldChange("audioCoverStrength")} disabled={isBusy} />
                <FieldError message={validationErrors.audioCoverStrength} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="primary-button disabled:opacity-50" type="submit" disabled={isBusy || hasErrors || !modelReady}>
            {submitLabel}
          </button>
          {isBusy ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                void cancelGeneration();
              }}
            >
              {t("common.cancel")}
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={resetForm} disabled={isBusy}>
            {t("generation.reset")}
          </button>
        </div>
        {!modelReady ? <p className="text-[12px] text-[var(--color-text-dim)]">{t("model.chooseFirst")}</p> : null}
      </form>
    </section>
  );
}
