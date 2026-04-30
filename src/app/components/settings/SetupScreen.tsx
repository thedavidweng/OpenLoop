import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  FolderOpen,
  FolderOutput,
  Loader2,
  Sparkles,
} from "lucide-react";
import * as api from "@/app/lib/api";
import {
  MODEL_PACKS,
  MODEL_VARIANTS,
  aggregatePackStatus,
  packIdForVariant,
  type ModelPackId,
} from "@/app/lib/model-packs";
import { useGenerationStore } from "@/app/lib/store";
import type { ModelDownloadState, ModelVariant } from "@/app/lib/types";

interface SetupScreenProps {
  onClose?: () => void;
}

type SetupStep = "welcome" | "device" | "model" | "output" | "done";

const STEP_ORDER: SetupStep[] = [
  "welcome",
  "device",
  "model",
  "output",
  "done",
];

function StepIndicator({ current }: { current: SetupStep }) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-2">
      {STEP_ORDER.map((step, index) => {
        const isActive = index === currentIndex;
        const isDone = index < currentIndex;
        return (
          <div
            key={step}
            className={`h-1 rounded-full transition-all ${
              isActive
                ? "w-6 bg-[var(--color-accent)]"
                : isDone
                  ? "w-1.5 bg-[var(--color-accent)]/60"
                  : "w-1.5 bg-[var(--color-border)]"
            }`}
          />
        );
      })}
    </div>
  );
}

interface SetupActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function SetupActionCard({
  icon: Icon,
  title,
  description,
}: SetupActionCardProps) {
  return (
    <div className="flex w-full items-start gap-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-sidebar)] p-4 text-left">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)]/12 text-[var(--color-accent)]">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-white">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
          {description}
        </div>
      </div>
    </div>
  );
}

function bytesToLabel(bytes: number) {
  if (!bytes) return "0 GB";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function progressPercent(downloadedBytes: number, totalBytes?: number | null) {
  if (!totalBytes) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)),
  );
}

function PackDownloadCard({
  packId,
  state,
  downloadedBytes,
  totalBytes,
  errorMessage,
  busy,
  onDownload,
}: {
  packId: ModelPackId;
  state: ModelDownloadState;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage?: string | null;
  busy: boolean;
  onDownload: () => void;
}) {
  const { t } = useTranslation();
  const pack = MODEL_PACKS[packId];
  const percent = progressPercent(downloadedBytes, totalBytes);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-white">{pack.label}</p>
            {state === "ready" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                <CheckCircle2 size={10} />
                {t("setup.downloadComplete", { defaultValue: "Downloaded" })}
              </span>
            ) : state === "failed" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-200">
                <AlertCircle size={10} />
                {t("model.failed")}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
            {t(`modelPacks.${packId}.description`)}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-[var(--color-text-dimmer)]">
            {bytesToLabel(downloadedBytes)} / {bytesToLabel(totalBytes)}
            {state === "downloading" ? ` · ${percent}%` : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy || state === "downloading" || state === "ready"}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "downloading" || busy ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              {t("setup.downloadingButton", { defaultValue: "Downloading…" })}
            </>
          ) : state === "ready" ? (
            <>
              <CheckCircle2 size={12} />
              {t("setup.downloaded")}
            </>
          ) : state === "failed" ? (
            <>
              <Download size={12} />
              {t("model.retry")}
            </>
          ) : (
            <>
              <Download size={12} />
              {t("setup.downloadModelButton")}
            </>
          )}
        </button>
      </div>

      {state === "downloading" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-md border border-red-500/25 bg-red-500/8 px-3 py-2 text-[11px] leading-5 text-red-200">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function VariantPickerCard({
  variant,
  selected,
  packState,
  onSelect,
  busy,
}: {
  variant: ModelVariant;
  selected: boolean;
  packState: ModelDownloadState;
  onSelect: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const meta = MODEL_VARIANTS[variant];
  const packId = packIdForVariant(variant);
  const packReady = packState === "ready";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={busy || (!packReady && !selected)}
      className={`group relative flex h-full w-full flex-col gap-2 rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12 shadow-[0_0_0_1px_var(--color-accent)/0.3]"
          : "border-[var(--color-border)] bg-[var(--color-sidebar)] hover:border-[var(--color-border-light)] hover:bg-[var(--color-hover)]/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-white">{meta.label}</p>
        {selected ? (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
            <Check size={11} strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
        {t(`modelProfiles.${variant}.description`)}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-dimmer)]">
        {MODEL_PACKS[packId].label}
      </p>
    </button>
  );
}

export function SetupScreen({ onClose }: SetupScreenProps) {
  const { t } = useTranslation();
  const deviceInfo = useGenerationStore((state) => state.deviceInfo);
  const settings = useGenerationStore((state) => state.settings);
  const modelStatuses = useGenerationStore((state) => state.modelStatuses);
  const completeSetup = useGenerationStore((state) => state.completeSetup);
  const downloadModelVariant = useGenerationStore(
    (state) => state.downloadModelVariant,
  );
  const selectModelVariant = useGenerationStore(
    (state) => state.selectModelVariant,
  );
  const [step, setStep] = useState<SetupStep>("welcome");
  const [busyVariant, setBusyVariant] = useState<ModelVariant | null>(null);
  const [outputDirectory, setOutputDirectory] = useState(
    settings.outputDirectory ?? "",
  );
  const [defaultPaths, setDefaultPaths] = useState<api.DefaultAppPaths | null>(
    null,
  );

  const currentIndex = STEP_ORDER.indexOf(step);
  const recommendedProfile = deviceInfo?.recommendedProfile ?? settings.profile;
  const recommendedVariant = settings.modelVariant ?? "turbo";

  const stepTitle = useMemo(() => {
    switch (step) {
      case "welcome":
        return t("setup.welcome");
      case "device":
        return t("setup.device");
      case "model":
        return t("setup.model");
      case "output":
        return t("setup.output");
      case "done":
      default:
        return t("setup.done");
    }
  }, [step, t]);

  const stepDescription = useMemo(() => {
    switch (step) {
      case "welcome":
        return t("setup.welcomeBody");
      case "device":
        return t("setup.deviceBody");
      case "model":
        return t("setup.modelBody");
      case "output":
        return t("setup.outputBody");
      case "done":
      default:
        return t("setup.doneBody");
    }
  }, [step, t]);

  useEffect(() => {
    if (!api.isTauriRuntime()) {
      setDefaultPaths({
        outputDirectory: "~/Music/OpenLoop",
        modelDirectory:
          "~/Library/Application Support/OpenLoop/models/checkpoints",
        logDirectory: "~/Library/Application Support/OpenLoop/logs/backend",
      });
      return;
    }
    void api.getDefaultAppPaths().then(setDefaultPaths);
  }, []);

  const nextStep = async () => {
    if (step === "output" && api.isTauriRuntime()) {
      await api.setSetting("outputDirectory", outputDirectory || null);
    }
    setStep(STEP_ORDER[Math.min(currentIndex + 1, STEP_ORDER.length - 1)]);
  };

  const StepIcon =
    step === "welcome"
      ? Sparkles
      : step === "device"
        ? Cpu
        : step === "model"
          ? Sparkles
          : step === "output"
            ? FolderOutput
            : Check;

  return (
    <div className="flex h-screen w-full items-center justify-center overflow-y-auto bg-[var(--color-surface)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
        <StepIndicator current={step} />

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/12 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25 ring-inset">
            <StepIcon size={24} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
            {t("setup.eyebrow")}
          </p>
          <h1 className="text-balance text-[26px] font-semibold leading-tight text-white">
            {stepTitle}
          </h1>
          <p className="mx-auto max-w-xl text-balance text-[13px] leading-6 text-[var(--color-text-dim)]">
            {stepDescription}
          </p>
        </div>

        {step === "welcome" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <SetupActionCard
              icon={Sparkles}
              title={t("setup.downloadModel")}
              description={t("setup.downloadModelDesc")}
            />
            <SetupActionCard
              icon={FolderOutput}
              title={t("setup.pickOutput")}
              description={t("setup.pickOutputDesc")}
            />
          </div>
        ) : null}

        {step === "device" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                key: "os",
                label: t("setup.os"),
                value: deviceInfo?.os ?? t("common.unknown"),
              },
              {
                key: "arch",
                label: t("setup.architecture"),
                value: deviceInfo?.arch ?? t("common.unknown"),
              },
              {
                key: "memory",
                label: t("setup.memory"),
                value: deviceInfo
                  ? `${deviceInfo.totalMemoryGb} GB`
                  : t("common.unknown"),
              },
              {
                key: "profile",
                label: t("setup.recommendedProfile"),
                value: recommendedProfile,
              },
            ].map((info) => (
              <div
                key={info.key}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-3.5 text-left"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                  {info.label}
                </p>
                <p className="mt-1.5 truncate text-[14px] font-semibold text-white">
                  {info.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {step === "model" ? (
          <div className="space-y-5 text-left">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("setup.modelPackHeading", { defaultValue: "Weight packs" })}
              </p>
              {(Object.keys(MODEL_PACKS) as ModelPackId[]).map((packId) => {
                const pack = MODEL_PACKS[packId];
                const status = aggregatePackStatus(modelStatuses, packId);
                const primary = pack.primaryVariant;
                const busy =
                  busyVariant !== null && pack.variants.includes(busyVariant);
                return (
                  <PackDownloadCard
                    key={packId}
                    packId={packId}
                    state={status.state}
                    downloadedBytes={status.downloadedBytes}
                    totalBytes={status.totalBytes}
                    errorMessage={status.error?.message ?? null}
                    busy={busy}
                    onDownload={() => {
                      setBusyVariant(primary);
                      void downloadModelVariant(primary).finally(() =>
                        setBusyVariant(null),
                      );
                    }}
                  />
                );
              })}
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("setup.modelProfileHeading", {
                  defaultValue: "Runtime profiles",
                })}
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {(["lite", "turbo", "pro"] as const).map((variant) => {
                  const status = aggregatePackStatus(
                    modelStatuses,
                    packIdForVariant(variant),
                  );
                  return (
                    <VariantPickerCard
                      key={variant}
                      variant={variant}
                      selected={settings.modelVariant === variant}
                      packState={status.state}
                      busy={busyVariant === variant}
                      onSelect={() => {
                        setBusyVariant(variant);
                        void selectModelVariant(variant).finally(() =>
                          setBusyVariant(null),
                        );
                      }}
                    />
                  );
                })}
              </div>
              <p className="text-center text-[11px] text-[var(--color-text-dim)]">
                {t("setup.recommended", {
                  model: MODEL_VARIANTS[recommendedVariant].label,
                })}
              </p>
            </div>
          </div>
        ) : null}

        {step === "output" ? (
          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("settings.outputDirectory")}
              </p>
              <div className="mt-2 flex flex-wrap items-stretch gap-2 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] p-1.5">
                <code
                  className="min-w-0 flex-1 break-all rounded-md bg-[var(--color-surface-muted)]/60 px-3 py-2 font-mono text-[12px] leading-5 text-[var(--color-text)]"
                  title={
                    outputDirectory || defaultPaths?.outputDirectory || "—"
                  }
                >
                  {outputDirectory || defaultPaths?.outputDirectory || "—"}
                </code>
                <div className="flex shrink-0 items-center gap-1">
                  {!outputDirectory ? (
                    <span className="rounded-full bg-white/6 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--color-text-dim)]">
                      {t("settings.defaultPath")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="motion-icon-button inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-2.5 text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
                    onClick={() => {
                      void api
                        .selectDirectory(
                          outputDirectory || defaultPaths?.outputDirectory,
                        )
                        .then((selected) => {
                          if (selected) setOutputDirectory(selected);
                        });
                    }}
                  >
                    <FolderOpen size={12} />
                    {t("settings.chooseFolder")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
            >
              {t("setup.close")}
            </button>
          ) : null}
          {currentIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStep(STEP_ORDER[currentIndex - 1])}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
            >
              <ChevronLeft size={13} /> {t("setup.back")}
            </button>
          ) : null}
          {step !== "done" ? (
            <button
              type="button"
              onClick={() => {
                void nextStep();
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-4 text-[12px] font-semibold text-white shadow-sm transition-colors hover:brightness-110"
            >
              {t("setup.next")}
              <ChevronRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void completeSetup();
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-4 text-[12px] font-semibold text-white shadow-sm transition-colors hover:brightness-110"
            >
              {t("setup.finish")}
              <Check size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
