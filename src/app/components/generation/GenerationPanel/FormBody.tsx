import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Music4, Settings2, Wrench } from "lucide-react";
import type { ChangeEvent } from "react";
import { Collapsible } from "@/app/components/ui/Collapsible";
import {
  SELECT_OPTIONS,
  STRUCTURE_TAGS,
} from "@/app/components/generation/generation-panel-options";
import {
  FieldError,
  FieldLabel,
  FilePickerField,
  type TextField,
} from "@/app/components/generation/GenerationPanel/shared";
import type {
  GenerationFormValues,
  ValidationErrors,
  ModelCatalogItem,
  ModelDownloadState,
} from "@/app/lib/types";

interface FormBodyProps {
  form: GenerationFormValues;
  isBusy: boolean;
  validationErrors: ValidationErrors;
  selectedModel: ModelCatalogItem | null;
  modelReady: boolean;
  selectedModelState: ModelDownloadState;
  tweakOpen: boolean;
  setTweakOpen: (v: boolean) => void;
  expertOpen: boolean;
  setExpertOpen: (v: boolean) => void;
  openSettings: () => void;
  lyricsRef: React.RefObject<HTMLTextAreaElement | null>;
  setField: <K extends keyof GenerationFormValues>(
    field: K,
    value: GenerationFormValues[K],
  ) => void;
}

export function FormBody({
  form,
  isBusy,
  validationErrors,
  selectedModel,
  modelReady,
  selectedModelState,
  tweakOpen,
  setTweakOpen,
  expertOpen,
  setExpertOpen,
  openSettings,
  lyricsRef,
  setField,
}: FormBodyProps) {
  const { t } = useTranslation();

  const handleTextFieldChange =
    (field: TextField) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      (setField as (field: TextField, value: string) => void)(field, event.target.value);
    };

  const insertTag = useCallback(
    (tagKey: string) => {
      const textarea = lyricsRef.current;
      if (!textarea) return;
      const tag = `[${t(`generation.${tagKey}`).replace(/[[\]]/g, "")}]`;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = form.lyrics.slice(0, start);
      const after = form.lyrics.slice(end);
      const insertion = (before.endsWith("\n") || before === "" ? "" : "\n") + tag + "\n";
      setField("lyrics", before + insertion + after);
      requestAnimationFrame(() => {
        const newPos = start + insertion.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
      });
    },
    [form.lyrics, setField, t, lyricsRef],
  );

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

  const variationOptions = [1, 2, 3, 4];

  return (
    <>
      {/* Task Type - standalone row */}
      <div className="px-1">
        <label className="space-y-1">
          <FieldLabel>{t("generation.taskType")}</FieldLabel>
          <select
            className="select-input"
            value={form.taskType}
            onChange={(event) =>
              setField("taskType", event.target.value as GenerationFormValues["taskType"])
            }
            disabled={isBusy}
          >
            {SELECT_OPTIONS.taskType.map((option) => (
              <option key={option} value={option}>
                {t(`generation.taskTypes.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Prompt - full width */}
      <label className="block space-y-2 px-1">
        <FieldLabel>{t("generation.prompt")}</FieldLabel>
        <textarea
          className="min-h-[140px] w-full resize-none rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] px-4 py-3 text-[14px] leading-6 text-white outline-none transition-colors placeholder:text-[var(--color-text-dimmer)] focus:border-[var(--color-accent)] disabled:opacity-60"
          placeholder={t("generation.promptPlaceholder")}
          value={form.prompt}
          onChange={handleTextFieldChange("prompt")}
          disabled={isBusy}
          aria-describedby={validationErrors.prompt ? "error-prompt" : undefined}
        />
        <FieldError id="error-prompt" message={validationErrors.prompt} />
      </label>

      {/* Model info - compact row */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_68%,transparent)] px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text-dim)]">
          <Music4 size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-medium text-white">
            {selectedModel?.label ?? t("model.noModel")}
          </span>
          {selectedModel && (
            <span
              className={`ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                modelReady
                  ? "bg-emerald-500/14 text-emerald-200"
                  : selectedModelState === "failed"
                    ? "bg-red-500/14 text-red-200"
                    : selectedModelState === "downloading"
                      ? "bg-[var(--color-accent)]/14 text-[var(--color-accent)]"
                      : "bg-amber-500/14 text-amber-200"
              }`}
            >
              {modelReady ? <CheckCircle2 size={8} /> : null}
              {modelReady
                ? t("model.ready")
                : selectedModelState === "failed"
                  ? t("model.failed")
                  : selectedModelState === "downloading"
                    ? t("model.downloading")
                    : t("model.notInstalled")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={openSettings}
          className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent)] transition-colors hover:text-white"
        >
          {t("model.openSettings")} →
        </button>
      </div>

      {/* Lyrics section - always visible */}
      <div className="space-y-2 rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_62%,transparent)] p-3">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>{t("generation.lyrics")}</FieldLabel>
          <div className="flex items-center gap-2">
            {/* Instrumental toggle */}
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-dim)]">
              <input
                type="checkbox"
                className="rounded"
                checked={form.instrumental}
                onChange={(e) => {
                  setField("instrumental", e.target.checked);
                  if (e.target.checked) {
                    setField("lyrics", "");
                  }
                }}
                disabled={isBusy}
              />
              <span>{t("generation.instrumental")}</span>
            </label>
          </div>
        </div>

        {/* Structure tag chips */}
        {!form.instrumental && (
          <div className="flex flex-wrap gap-1.5">
            {STRUCTURE_TAGS.map((tagKey) => (
              <button
                key={tagKey}
                type="button"
                className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)] hover:text-white disabled:opacity-40"
                onClick={() => insertTag(tagKey)}
                disabled={isBusy}
              >
                {t(`generation.${tagKey}`)}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={lyricsRef}
          className="min-h-[100px] w-full resize-y rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] leading-6 text-white outline-none transition-colors placeholder:text-[var(--color-text-dimmer)] focus:border-[var(--color-accent)] disabled:opacity-60"
          placeholder={
            form.instrumental ? t("generation.instrumentalDesc") : t("generation.lyricsPlaceholder")
          }
          value={form.lyrics}
          onChange={handleTextFieldChange("lyrics")}
          disabled={isBusy || form.instrumental}
          aria-describedby={validationErrors.lyrics ? "error-lyrics" : undefined}
        />
        <FieldError id="error-lyrics" message={validationErrors.lyrics} />
      </div>

      {/* Basic parameters - grouped */}
      <div className="space-y-3 rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_62%,transparent)] p-3">
        <div className="flex items-center gap-2 px-1">
          <FieldLabel>{t("generation.musicalControls")}</FieldLabel>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <FieldLabel>{t("generation.duration")}</FieldLabel>
            <input
              className="text-input"
              type="number"
              min="10"
              max="600"
              step="1"
              value={form.durationSeconds}
              onChange={handleTextFieldChange("durationSeconds")}
              disabled={isBusy}
              aria-describedby={validationErrors.durationSeconds ? "error-duration" : undefined}
            />
            <FieldError id="error-duration" message={validationErrors.durationSeconds} />
          </label>
          <label className="space-y-1">
            <FieldLabel>{t("generation.bpm")}</FieldLabel>
            <div className="grid grid-cols-[0.75fr_1fr] gap-2">
              <select
                className="select-input"
                value={form.bpmMode}
                onChange={(event) =>
                  setField("bpmMode", event.target.value as GenerationFormValues["bpmMode"])
                }
                disabled={isBusy}
              >
                <option value="auto">{t("generation.auto")}</option>
                <option value="manual">{t("generation.manual")}</option>
              </select>
              <input
                className="text-input"
                type="number"
                min="30"
                max="300"
                step="1"
                placeholder={t("generation.optional")}
                value={form.bpm}
                onChange={handleTextFieldChange("bpm")}
                disabled={isBusy || form.bpmMode === "auto"}
                aria-describedby={validationErrors.bpm ? "error-bpm" : undefined}
              />
            </div>
            <FieldError id="error-bpm" message={validationErrors.bpm} />
          </label>
          <label className="space-y-1">
            <FieldLabel>{t("generation.keyScale")}</FieldLabel>
            <select
              className="select-input"
              value={form.keyScale}
              onChange={(event) => setField("keyScale", event.target.value)}
              disabled={isBusy}
            >
              {SELECT_OPTIONS.keyScale.map((option) => (
                <option key={option} value={option}>
                  {option === "auto" ? t("generation.auto") : option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <FieldLabel>{t("generation.timeSignature")}</FieldLabel>
            <select
              className="select-input"
              value={form.timeSignature}
              onChange={(event) =>
                setField(
                  "timeSignature",
                  event.target.value as GenerationFormValues["timeSignature"],
                )
              }
              disabled={isBusy}
            >
              {SELECT_OPTIONS.timeSignature.map((option) => (
                <option key={option} value={option}>
                  {option}/4
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <FieldLabel>{t("generation.language")}</FieldLabel>
            <select
              className="select-input"
              value={form.vocalLanguage}
              onChange={(event) => setField("vocalLanguage", event.target.value)}
              disabled={isBusy || form.instrumental}
            >
              {SELECT_OPTIONS.vocalLanguage.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <FieldLabel>{t("generation.format")}</FieldLabel>
            <select
              className="select-input"
              value={form.audioFormat}
              onChange={(event) =>
                setField("audioFormat", event.target.value as GenerationFormValues["audioFormat"])
              }
              disabled={isBusy}
            >
              {SELECT_OPTIONS.audioFormat.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Tweak the sound — smooth collapsible */}
      <Collapsible
        className="rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_58%,transparent)]"
        title={
          <span className="flex items-center gap-2">
            <Settings2 size={15} />
            {t("generation.tweakSound")}
          </span>
        }
        badge={
          hasTweakErrors ? (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
              {t("generation.needsReview")}
            </span>
          ) : null
        }
        open={tweakOpen}
        onOpenChange={setTweakOpen}
        contentClassName="border-t border-[var(--color-border-light)]"
      >
        <div className="space-y-4 p-4">
          <p id="desc-tweak-sound" className="text-[12px] text-[var(--color-text-dim)]">
            {t("generation.tweakSoundDesc")}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <FieldLabel>{t("generation.negativePrompt")}</FieldLabel>
              <textarea
                className="min-h-[76px] w-full resize-y rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] leading-6 text-white outline-none transition-colors placeholder:text-[var(--color-text-dimmer)] focus:border-[var(--color-accent)] disabled:opacity-60"
                placeholder={t("generation.negativePromptPlaceholder")}
                value={form.negativePrompt}
                onChange={handleTextFieldChange("negativePrompt")}
                disabled={isBusy}
                aria-describedby={
                  validationErrors.negativePrompt
                    ? "error-negative-prompt desc-tweak-sound"
                    : "desc-tweak-sound"
                }
              />
              <FieldError id="error-negative-prompt" message={validationErrors.negativePrompt} />
            </label>

            <label className="space-y-1">
              <FieldLabel>{t("generation.inferenceSteps")}</FieldLabel>
              <input
                className="text-input"
                type="number"
                min="1"
                value={form.inferenceSteps}
                onChange={handleTextFieldChange("inferenceSteps")}
                disabled={isBusy}
                aria-describedby={
                  validationErrors.inferenceSteps ? "error-inference-steps" : undefined
                }
              />
              <FieldError id="error-inference-steps" message={validationErrors.inferenceSteps} />
            </label>
            <label className="space-y-1">
              <FieldLabel>{t("generation.guidanceScale")}</FieldLabel>
              <input
                className="text-input"
                type="number"
                min="0.1"
                step="0.1"
                value={form.guidanceScale}
                onChange={handleTextFieldChange("guidanceScale")}
                disabled={isBusy}
                aria-describedby={
                  validationErrors.guidanceScale ? "error-guidance-scale" : undefined
                }
              />
              <FieldError id="error-guidance-scale" message={validationErrors.guidanceScale} />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FilePickerField
              label={t("generation.referenceAudio")}
              value={form.referenceAudioPath}
              onChange={(path) => setField("referenceAudioPath", path)}
              disabled={isBusy}
            />
            <FilePickerField
              label={t("generation.sourceAudio")}
              value={form.srcAudioPath}
              onChange={(path) => setField("srcAudioPath", path)}
              disabled={isBusy}
            />
            <label className="space-y-1 md:col-span-2">
              <FieldLabel>{t("generation.instruction")}</FieldLabel>
              <input
                className="text-input"
                value={form.instruction}
                onChange={handleTextFieldChange("instruction")}
                disabled={isBusy}
              />
            </label>
            <label className="space-y-1">
              <FieldLabel>{t("generation.repaintStart")}</FieldLabel>
              <input
                className="text-input"
                type="number"
                min="0"
                step="0.1"
                value={form.repaintingStart}
                onChange={handleTextFieldChange("repaintingStart")}
                disabled={isBusy}
              />
              <FieldError message={validationErrors.repaintingStart} />
            </label>
            <label className="space-y-1">
              <FieldLabel>{t("generation.repaintEnd")}</FieldLabel>
              <input
                className="text-input"
                type="number"
                min="-1"
                step="0.1"
                value={form.repaintingEnd}
                onChange={handleTextFieldChange("repaintingEnd")}
                disabled={isBusy}
              />
              <FieldError message={validationErrors.repaintingEnd} />
            </label>
            <label className="space-y-1">
              <FieldLabel>{t("generation.coverStrength")}</FieldLabel>
              <input
                className="text-input"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={form.audioCoverStrength}
                onChange={handleTextFieldChange("audioCoverStrength")}
                disabled={isBusy}
              />
              <FieldError message={validationErrors.audioCoverStrength} />
            </label>
            <label className="space-y-1">
              <FieldLabel>{t("generation.seed")}</FieldLabel>
              <input
                className="text-input disabled:opacity-60"
                type="number"
                step="1"
                placeholder={
                  form.useRandomSeed ? t("generation.randomSeedEnabled") : t("generation.optional")
                }
                value={form.seed}
                onChange={handleTextFieldChange("seed")}
                disabled={isBusy || form.useRandomSeed}
              />
              <FieldError message={validationErrors.seed} />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(form.useRandomSeed)}
              onChange={(event) => setField("useRandomSeed", event.target.checked)}
              disabled={isBusy}
            />
            <div>
              <p className="text-[13px] font-medium text-white">{t("generation.randomSeed")}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
                {t("generation.randomSeedDesc")}
              </p>
            </div>
          </label>
        </div>
      </Collapsible>

      {/* Expert (ACE-Step internals) — default collapsed */}
      <Collapsible
        className="rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_54%,transparent)]"
        title={
          <span className="flex items-center gap-2">
            <Wrench size={15} />
            {t("generation.expertMode")}
          </span>
        }
        open={expertOpen}
        onOpenChange={setExpertOpen}
        contentClassName="border-t border-[var(--color-border-light)]"
      >
        <div className="space-y-4 p-4">
          <p className="text-[12px] text-[var(--color-text-dim)]">
            {t("generation.expertModeHint")}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <FieldLabel>{t("generation.lmModel")}</FieldLabel>
              <select
                className="select-input"
                value={form.lmModelPath}
                onChange={(event) => setField("lmModelPath", event.target.value)}
                disabled={isBusy || !form.thinking}
              >
                {SELECT_OPTIONS.lmModelPath.map((option) => (
                  <option key={option || "none"} value={option}>
                    {option || "None"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <FieldLabel>{t("generation.lmBackend")}</FieldLabel>
              <select
                className="select-input"
                value={form.lmBackend}
                onChange={(event) =>
                  setField("lmBackend", event.target.value as GenerationFormValues["lmBackend"])
                }
                disabled={isBusy || !form.thinking}
              >
                {SELECT_OPTIONS.lmBackend.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["thinking", "generation.thinking", "generation.thinkingDesc"],
                ["useFormat", "generation.useFormat", ""],
                ["useCotCaption", "generation.cotCaption", ""],
                ["useCotLanguage", "generation.cotLanguage", ""],
                ["constrainedDecoding", "generation.constrained", ""],
              ] as const
            ).map(([field, titleKey, descriptionKey]) => (
              <label
                key={field}
                className="flex items-start gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-3"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(form[field as keyof GenerationFormValues])}
                  onChange={(event) =>
                    setField(field as keyof GenerationFormValues, event.target.checked as never)
                  }
                  disabled={isBusy}
                />
                <div>
                  <p className="text-[13px] font-medium text-white">{t(titleKey)}</p>
                  {descriptionKey ? (
                    <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
                      {t(descriptionKey)}
                    </p>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        </div>
      </Collapsible>

      {/* Variations selector */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <FieldLabel>{t("generation.variations")}</FieldLabel>
        <div
          className="inline-flex overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] p-0.5"
          role="group"
          aria-label={t("generation.variations")}
        >
          {variationOptions.map((n) => {
            const selected = form.variations === n;
            return (
              <button
                key={n}
                type="button"
                className={`h-8 min-w-9 rounded-lg px-3 text-[12px] font-semibold transition-colors ${
                  selected
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "text-[var(--color-text-dim)] hover:bg-[var(--color-hover)] hover:text-white"
                }`}
                aria-label={t("generation.variationOption", { count: n })}
                aria-pressed={selected}
                onClick={() => setField("variations", n)}
                disabled={isBusy}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
