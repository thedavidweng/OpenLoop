import type { ChangeEvent } from "react";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Music2, Settings2, SlidersHorizontal, WandSparkles } from "lucide-react";
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

type TextField =
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
  | "audioCoverStrength";

type ToggleField =
  | "thinking"
  | "useRandomSeed"
  | "useFormat"
  | "useCotCaption"
  | "useCotLanguage"
  | "constrainedDecoding";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-300">{message}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
      {children}
    </span>
  );
}

export function GenerationPanel() {
  const { t } = useTranslation();
  const [lyricsOpen, setLyricsOpen] = useState(false);
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
  const hasAdvancedErrors = (
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

  const submitLabel = useMemo(() => {
    if (generationState.status === "validating") return t("generation.validating");
    if (generationState.status === "running") return t("generation.generating");
    return t("generation.generate");
  }, [generationState.status, t]);

  const handleTextFieldChange =
    (field: TextField) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setField(field, event.target.value);
    };

  const toggleItems: readonly [ToggleField, string, string][] = [
    ["thinking", "generation.thinking", "generation.thinkingDesc"],
    ["useRandomSeed", "generation.randomSeed", "generation.randomSeedDesc"],
    ["useFormat", "generation.useFormat", ""],
    ["useCotCaption", "generation.cotCaption", ""],
    ["useCotLanguage", "generation.cotLanguage", ""],
    ["constrainedDecoding", "generation.constrained", ""],
  ];

  return (
    <section className="rounded-[28px] border border-[var(--playback-bar-surface-border)] bg-[var(--playback-bar-surface-bg)] p-4 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void runGeneration();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-accent)]">
              <Music2 size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">{t("generation.composerTitle")}</p>
              <p className="truncate text-[12px] text-[var(--color-text-dim)]">
                {t("generation.composerDescription")}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setLyricsOpen((open) => !open)}
            disabled={isBusy}
          >
            <WandSparkles size={14} />
            {form.lyrics.trim() ? t("generation.editLyrics") : t("generation.addLyrics")}
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <label className="space-y-2">
            <FieldLabel>{t("generation.prompt")}</FieldLabel>
            <textarea
              className="min-h-[116px] w-full resize-none rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] px-4 py-3 text-[14px] leading-6 text-white outline-none transition-colors placeholder:text-[var(--color-text-dimmer)] focus:border-[var(--color-accent)] disabled:opacity-60"
              placeholder={t("generation.promptPlaceholder")}
              value={form.prompt}
              onChange={handleTextFieldChange("prompt")}
              disabled={isBusy}
            />
            <FieldError message={validationErrors.prompt} />
          </label>

          <div className="flex min-h-[116px] flex-col justify-between gap-3 rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_68%,transparent)] p-3">
            <div>
              <FieldLabel>{t("generation.model")}</FieldLabel>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {selectedModel?.label ?? t("model.noModel")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--color-text-dim)]">
                    {selectedModel?.description ?? t("model.chooseFirst")}
                  </p>
                </div>
                <button type="button" onClick={openSettings} className="secondary-button shrink-0">
                  {modelReady ? t("model.select") : t("model.download")}
                </button>
              </div>
            </div>

            <button className="primary-button w-full disabled:opacity-50" type="submit" disabled={isBusy || hasErrors || !modelReady}>
              {isBusy ? <SlidersHorizontal size={15} /> : <WandSparkles size={15} />}
              {submitLabel}
            </button>
          </div>
        </div>

        {(lyricsOpen || form.lyrics.trim() || validationErrors.lyrics) ? (
          <label className="block space-y-2 rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_62%,transparent)] p-3">
            <FieldLabel>{t("generation.lyrics")}</FieldLabel>
            <textarea
              className="min-h-[120px] w-full resize-y rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] leading-6 text-white outline-none transition-colors placeholder:text-[var(--color-text-dimmer)] focus:border-[var(--color-accent)] disabled:opacity-60"
              placeholder={t("generation.lyricsPlaceholder")}
              value={form.lyrics}
              onChange={handleTextFieldChange("lyrics")}
              disabled={isBusy}
            />
            <FieldError message={validationErrors.lyrics} />
          </label>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(112px,0.55fr))]">
          <label className="space-y-1">
            <FieldLabel>{t("generation.taskType")}</FieldLabel>
            <select className="select-input" value={form.taskType} onChange={(event) => setField("taskType", event.target.value as GenerationFormValues["taskType"])} disabled={isBusy}>
              {SELECT_OPTIONS.taskType.map((option) => (
                <option key={option} value={option}>
                  {t(`generation.taskTypes.${option}`)}
                </option>
              ))}
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
            <FieldLabel>{t("generation.language")}</FieldLabel>
            <select className="select-input" value={form.vocalLanguage} onChange={(event) => setField("vocalLanguage", event.target.value)} disabled={isBusy}>
              {SELECT_OPTIONS.vocalLanguage.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <FieldLabel>{t("generation.format")}</FieldLabel>
            <select className="select-input" value={form.audioFormat} onChange={(event) => setField("audioFormat", event.target.value as GenerationFormValues["audioFormat"])} disabled={isBusy}>
              {SELECT_OPTIONS.audioFormat.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
            </select>
          </label>
        </div>

        <details className="group rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_58%,transparent)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold text-white">
            <span className="flex items-center gap-2">
              <Settings2 size={15} />
              {t("generation.advancedControls")}
              {hasAdvancedErrors ? (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
                  {t("generation.needsReview")}
                </span>
              ) : null}
            </span>
            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
          </summary>

          <div className="space-y-4 border-t border-[var(--color-border-light)] p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <FieldLabel>{t("generation.negativePrompt")}</FieldLabel>
                <textarea
                  className="min-h-[76px] w-full resize-y rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] leading-6 text-white outline-none transition-colors placeholder:text-[var(--color-text-dimmer)] focus:border-[var(--color-accent)] disabled:opacity-60"
                  placeholder={t("generation.negativePromptPlaceholder")}
                  value={form.negativePrompt}
                  onChange={handleTextFieldChange("negativePrompt")}
                  disabled={isBusy}
                />
                <FieldError message={validationErrors.negativePrompt} />
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
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {toggleItems.map(([field, titleKey, descriptionKey]) => (
                <label key={field} className="flex items-start gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-3">
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
              <label className="space-y-1">
                <FieldLabel>{t("generation.seed")}</FieldLabel>
                <input className="text-input disabled:opacity-60" type="number" step="1" placeholder={form.useRandomSeed ? t("generation.randomSeedEnabled") : t("generation.optional")} value={form.seed} onChange={handleTextFieldChange("seed")} disabled={isBusy || form.useRandomSeed} />
                <FieldError message={validationErrors.seed} />
              </label>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2">
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
          <span className="text-[12px] text-[var(--color-text-dim)]">
            {modelReady ? t("generation.localReady") : t("model.chooseFirst")}
          </span>
        </div>
      </form>
    </section>
  );
}
