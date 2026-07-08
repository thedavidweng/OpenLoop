import type { ChangeEvent } from "react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Dice5,
  FileAudio,
  Loader2,
  Music2,
  Music4,
  Play,
  Settings2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  MODEL_VARIANTS,
  isModelDownloaded,
  modelDownloadStateForVariant,
  useGenerationStore,
} from "@/app/lib/store";
import type { GenerationFormValues } from "@/app/lib/types";
import { Collapsible } from "@/app/components/ui/Collapsible";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import * as api from "@/app/lib/api";
import { useToast } from "@/app/components/overlay/Toast";
import { getRandomPromptExample } from "@/app/lib/prompt-examples";
import {
  SELECT_OPTIONS,
  STRUCTURE_TAGS,
} from "@/app/components/generation/generation-panel-options";

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

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[11px] text-red-300">
      {message}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
      {children}
    </span>
  );
}

function FilePickerField({
  label,
  value,
  onChange,
  disabled,
  filters,
}: {
  label: string;
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  filters?: { name: string; extensions: string[] }[];
}) {
  const { t } = useTranslation();

  const handleBrowse = useCallback(async () => {
    if (!api.isTauriRuntime()) return;
    try {
      const selected = await api.openFileDialog({
        multiple: false,
        filters: filters ?? [{ name: "Audio", extensions: ["mp3", "wav", "flac", "m4a", "ogg"] }],
      });
      if (selected && typeof selected === "string") {
        onChange(selected);
      }
    } catch {
      // User cancelled
    }
  }, [onChange, filters]);

  return (
    <label className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-2">
        <input
          className="text-input flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={api.isTauriRuntime()}
        />
        {api.isTauriRuntime() && (
          <button
            type="button"
            className="secondary-button shrink-0"
            onClick={handleBrowse}
            disabled={disabled}
          >
            <FileAudio size={13} />
            {t("generation.chooseFile")}
          </button>
        )}
        {value && (
          <button
            type="button"
            className="secondary-button shrink-0 px-2"
            onClick={() => onChange("")}
            disabled={disabled}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </label>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GenerationPanel() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const form = useGenerationStore((state) => state.form);
  const modelStatuses = useGenerationStore((state) => state.modelStatuses);
  const validationErrors = useGenerationStore((state) => state.validationErrors);
  const generationState = useGenerationStore((state) => state.generationState);
  const currentRequest = useGenerationStore((state) => state.currentRequest);
  const settings = useGenerationStore((state) => state.settings);
  const runGeneration = useGenerationStore((state) => state.runGeneration);
  const cancelGeneration = useGenerationStore((state) => state.cancelGeneration);
  const enhancePrompt = useGenerationStore((state) => state.enhancePrompt);
  const activeTasks = useGenerationStore((state) => state.activeTasks);
  const resumeActiveTask = useGenerationStore((state) => state.resumeActiveTask);
  const discardActiveTask = useGenerationStore((state) => state.discardActiveTask);
  const resetForm = useGenerationStore((state) => state.resetForm);
  const setField = useGenerationStore((state) => state.setField);
  const openSettings = useGenerationStore((state) => state.openSettings);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const lyricsRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = generationState.status === "validating" || generationState.status === "running";
  const isFailed = generationState.status === "failed";
  const hasErrors = Object.keys(validationErrors).length > 0;
  const selectedModel = settings.modelVariant ? MODEL_VARIANTS[settings.modelVariant] : null;
  const modelReady = isModelDownloaded(settings, settings.modelVariant);
  const canSubmit = currentRequest !== null && !hasErrors && modelReady;
  const selectedModelState = modelDownloadStateForVariant(modelStatuses, settings.modelVariant);

  // Elapsed timer for generating state
  useEffect(() => {
    if (generationState.status === "running") {
      setElapsedTime(0);
      timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
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

  const submitLabel = useMemo(() => {
    if (generationState.status === "validating") return t("generation.validating");
    if (generationState.status === "running")
      return t("generation.generatingElapsed", {
        time: formatElapsed(elapsedTime),
      });
    return t("generation.generate");
  }, [generationState.status, elapsedTime, t]);

  const handleTextFieldChange =
    (field: TextField) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setField(field, event.target.value);
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
    [form.lyrics, setField, t],
  );

  const handleRetry = useCallback(() => {
    void runGeneration();
  }, [runGeneration]);

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

  // Auto-expand advanced if there are errors
  useEffect(() => {
    if (hasAdvancedErrors && !advancedOpen) {
      setAdvancedOpen(true);
    }
  }, [hasAdvancedErrors]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleItems: readonly [ToggleField, string, string][] = [
    ["thinking", "generation.thinking", "generation.thinkingDesc"],
    ["useRandomSeed", "generation.randomSeed", "generation.randomSeedDesc"],
    ["useFormat", "generation.useFormat", ""],
    ["useCotCaption", "generation.cotCaption", ""],
    ["useCotLanguage", "generation.cotLanguage", ""],
    ["constrainedDecoding", "generation.constrained", ""],
  ];

  const variationOptions = [1, 2, 3, 4];

  return (
    <section className="rounded-[28px] border border-[var(--playback-bar-surface-border)] bg-[var(--playback-bar-surface-bg)] p-4 shadow-[var(--chrome-panel-shadow)] backdrop-blur-xl">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void runGeneration();
        }}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-accent)]">
              <Music2 size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white">
                {t("generation.composerTitle")}
              </p>
              <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
                {t("generation.composerDescription")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip label={t("generation.randomInspiration")}>
              <button
                type="button"
                className="secondary-button shrink-0 px-2"
                aria-label={t("generation.randomInspiration")}
                onClick={() => setField("prompt", getRandomPromptExample())}
                disabled={isBusy}
              >
                <Dice5 size={14} />
              </button>
            </Tooltip>
            <Tooltip label={t("generation.enhancePrompt")}>
              <button
                type="button"
                className="secondary-button shrink-0 px-2"
                aria-label={t("generation.enhancePrompt")}
                onClick={() => {
                  void (async () => {
                    try {
                      setEnhancing(true);
                      await enhancePrompt();
                      addToast("success", t("toast.promptEnhanced"));
                    } catch {
                      addToast("error", t("toast.promptEnhanceFailed"));
                    } finally {
                      setEnhancing(false);
                    }
                  })();
                }}
                disabled={isBusy || enhancing}
              >
                {enhancing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <WandSparkles size={14} />
                )}
              </button>
            </Tooltip>
          </div>
        </div>

        {activeTasks.length > 0 ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                {t("generation.recoveryAvailable", {
                  count: activeTasks.length,
                })}
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void resumeActiveTask(activeTasks[0].id);
                }}
                disabled={isBusy}
              >
                {t("generation.resumeTask")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void discardActiveTask(activeTasks[0].id);
                }}
                disabled={isBusy}
              >
                {t("generation.discardTask")}
              </button>
            </div>
          </div>
        ) : null}

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
            aria-describedby={validationErrors.prompt ? "gen-error-prompt" : undefined}
          />
          <FieldError id="gen-error-prompt" message={validationErrors.prompt} />
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
              form.instrumental
                ? t("generation.instrumentalDesc")
                : t("generation.lyricsPlaceholder")
            }
            value={form.lyrics}
            onChange={handleTextFieldChange("lyrics")}
            disabled={isBusy || form.instrumental}
          />
          <FieldError message={validationErrors.lyrics} />
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
              />
              <FieldError message={validationErrors.durationSeconds} />
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
                />
              </div>
              <FieldError message={validationErrors.bpm} />
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

        {/* Advanced controls - smooth collapsible */}
        <Collapsible
          className="rounded-2xl border border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-surface)_58%,transparent)]"
          title={
            <span className="flex items-center gap-2">
              <Settings2 size={15} />
              {t("generation.advancedControls")}
            </span>
          }
          badge={
            hasAdvancedErrors ? (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
                {t("generation.needsReview")}
              </span>
            ) : null
          }
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          contentClassName="border-t border-[var(--color-border-light)]"
        >
          <div className="space-y-4 p-4">
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
              <label className="space-y-1">
                <FieldLabel>{t("generation.inferenceSteps")}</FieldLabel>
                <input
                  className="text-input"
                  type="number"
                  min="1"
                  value={form.inferenceSteps}
                  onChange={handleTextFieldChange("inferenceSteps")}
                  disabled={isBusy}
                />
                <FieldError message={validationErrors.inferenceSteps} />
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
                />
                <FieldError message={validationErrors.guidanceScale} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {toggleItems.map(([field, titleKey, descriptionKey]) => (
                <label
                  key={field}
                  className="flex items-start gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-3"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={Boolean(form[field])}
                    onChange={(event) => setField(field, event.target.checked)}
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
                    form.useRandomSeed
                      ? t("generation.randomSeedEnabled")
                      : t("generation.optional")
                  }
                  value={form.seed}
                  onChange={handleTextFieldChange("seed")}
                  disabled={isBusy || form.useRandomSeed}
                />
                <FieldError message={validationErrors.seed} />
              </label>
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

        {/* Action buttons row */}
        <div className="flex flex-wrap items-center gap-2 px-1">
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
          {isFailed && !isBusy && (
            <button className="secondary-button" type="button" onClick={handleRetry}>
              <Play size={13} />
              {t("generation.retry")}
            </button>
          )}
          <p className="min-w-0 flex-1 text-[11px] leading-[1.4] text-[var(--color-text-dim)]">
            {modelReady ? t("generation.localReady") : t("model.chooseFirst")}
          </p>
        </div>

        {/* Generate button - full width, prominent */}
        <button
          className="primary-button w-full py-3 text-[14px] font-semibold disabled:opacity-50"
          type="submit"
          disabled={isBusy || !canSubmit}
        >
          {isBusy ? <Loader2 size={16} className="animate-spin" /> : <WandSparkles size={16} />}
          {submitLabel}
        </button>
      </form>
    </section>
  );
}
