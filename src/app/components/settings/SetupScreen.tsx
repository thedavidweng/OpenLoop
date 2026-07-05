import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FolderOpen,
  FolderOutput,
  Keyboard,
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
import { APP_SHORTCUTS, getShortcutDisplay, getShortcutPlatform } from "@/app/lib/app-shortcuts";

interface SetupScreenProps {
  onClose?: () => void;
}

type SetupStep = "welcome" | "device" | "model" | "output" | "done";

const STEP_ORDER: SetupStep[] = ["welcome", "device", "model", "output", "done"];

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

function SetupActionCard({ icon: Icon, title, description }: SetupActionCardProps) {
  return (
    <div className="flex w-full items-start gap-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-sidebar)] p-4 text-left">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)]/12 text-[var(--color-accent)]">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-white">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">{description}</div>
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
  return Math.min(100, Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)));
}

function etaFromBytes(totalBytes: number, speedBps = 10 * 1024 * 1024) {
  const seconds = totalBytes / speedBps;
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatEta(seconds: number): string {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `~${Math.ceil(seconds)} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `~${mins} min ${secs} sec`;
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

  // Track download speed for real-time ETA
  const lastBytesRef = useRef(downloadedBytes);
  const lastTimeRef = useRef(Date.now());
  const [speedBps, setSpeedBps] = useState(0);

  useEffect(() => {
    if (state === "downloading" && totalBytes > 0) {
      const now = Date.now();
      const elapsed = (now - lastTimeRef.current) / 1000;
      const bytesDiff = downloadedBytes - lastBytesRef.current;

      if (bytesDiff !== 0) {
        if (elapsed >= 0.5 && bytesDiff > 0) {
          setSpeedBps(Math.round(bytesDiff / elapsed));
        }
        lastBytesRef.current = downloadedBytes;
        lastTimeRef.current = now;
      }
    } else {
      setSpeedBps(0);
      lastBytesRef.current = downloadedBytes;
      lastTimeRef.current = Date.now();
    }
  }, [downloadedBytes, state, totalBytes]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-white">{pack.label}</p>
            {state === "ready" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                <CheckCircle2 size={10} />
                {t("setup.downloadedBadge")}
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
            {state === "downloading" && speedBps > 0 && totalBytes > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--color-text-dim)]">
                ~{formatEta((totalBytes - downloadedBytes) / speedBps)}
              </span>
            ) : null}
            {state === "not_installed" && totalBytes > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--color-text-dim)]">
                <Clock size={9} />~{etaFromBytes(totalBytes)}
              </span>
            ) : null}
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
              {t("setup.downloadingButton")}
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
  const downloadModelVariant = useGenerationStore((state) => state.downloadModelVariant);
  const selectModelVariant = useGenerationStore((state) => state.selectModelVariant);
  const enterDemoMode = useGenerationStore((state) => state.enterDemoMode);
  const backendProvisionStatus = useGenerationStore((state) => state.backendProvisionStatus);
  const provisionBackend = useGenerationStore((state) => state.provisionBackend);
  const [step, setStep] = useState<SetupStep>("welcome");
  const [busyVariant, setBusyVariant] = useState<ModelVariant | null>(null);
  const [outputDirectory, setOutputDirectory] = useState(settings.outputDirectory ?? "");
  const [skipLoading, setSkipLoading] = useState(false);
  const [defaultPaths, setDefaultPaths] = useState<api.DefaultAppPaths | null>(null);

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
        modelDirectory: "~/Library/Application Support/OpenLoop/models/checkpoints",
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

  const handleSkipDemo = async () => {
    setSkipLoading(true);
    try {
      enterDemoMode();
      await completeSetup();
    } finally {
      setSkipLoading(false);
    }
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
          <>
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
            <p className="text-center text-[11px] text-[var(--color-text-dim)]">
              <a
                href="https://github.com/thedavidweng/OpenLoop/blob/main/docs/privacy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[var(--color-text-dimmer)]/40 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60"
              >
                Privacy policy
              </a>
            </p>
          </>
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
                value: deviceInfo ? `${deviceInfo.totalMemoryGb} GB` : t("common.unknown"),
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
                <p className="mt-1.5 truncate text-[14px] font-semibold text-white">{info.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {step === "model" ? (
          <div className="space-y-5 text-left">
            {/* Engine provisioning card */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("settings.backendEngine")}
              </p>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-white">ACE-Step Engine</p>
                      {backendProvisionStatus.state === "ready" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                          <CheckCircle2 size={10} />
                          {t("setup.downloadComplete")}
                        </span>
                      ) : backendProvisionStatus.state === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-200">
                          <AlertCircle size={10} />
                          {t("model.failed")}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
                      {t("settings.backendEngineDescription")}
                    </p>
                    {backendProvisionStatus.state === "ready" &&
                    backendProvisionStatus.installedTag ? (
                      <p className="font-mono text-[10px] tabular-nums text-[var(--color-text-dimmer)]">
                        {backendProvisionStatus.installedTag}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void provisionBackend()}
                    disabled={
                      backendProvisionStatus.state === "ready" ||
                      backendProvisionStatus.state === "downloading" ||
                      backendProvisionStatus.state === "extracting"
                    }
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {backendProvisionStatus.state === "downloading" ||
                    backendProvisionStatus.state === "extracting" ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        {t("settings.provisioningBackend")}
                      </>
                    ) : backendProvisionStatus.state === "ready" ? (
                      <>
                        <CheckCircle2 size={12} />
                        {t("setup.downloaded")}
                      </>
                    ) : backendProvisionStatus.state === "failed" ? (
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
                {backendProvisionStatus.state === "downloading" ||
                backendProvisionStatus.state === "extracting" ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out"
                      style={{
                        width: `${backendProvisionStatus.totalBytes ? Math.min(100, Math.round((backendProvisionStatus.downloadedBytes / backendProvisionStatus.totalBytes) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("setup.modelPackHeading")}
              </p>
              {(Object.keys(MODEL_PACKS) as ModelPackId[]).map((packId) => {
                const pack = MODEL_PACKS[packId];
                const status = aggregatePackStatus(modelStatuses, packId);
                const primary = pack.primaryVariant;
                const busy = busyVariant !== null && pack.variants.includes(busyVariant);
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
                      void downloadModelVariant(primary).finally(() => setBusyVariant(null));
                    }}
                  />
                );
              })}
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("setup.modelProfileHeading")}
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {(["lite", "turbo", "pro"] as const).map((variant) => {
                  const status = aggregatePackStatus(modelStatuses, packIdForVariant(variant));
                  return (
                    <VariantPickerCard
                      key={variant}
                      variant={variant}
                      selected={settings.modelVariant === variant}
                      packState={status.state}
                      busy={busyVariant === variant}
                      onSelect={() => {
                        setBusyVariant(variant);
                        void selectModelVariant(variant).finally(() => setBusyVariant(null));
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

            {/* Skip to demo */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleSkipDemo}
                disabled={skipLoading}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-dim)] underline decoration-[var(--color-text-dimmer)]/40 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60 disabled:opacity-50"
              >
                {skipLoading ? <Loader2 size={10} className="animate-spin" /> : null}
                {t("setup.skipDemo")}
              </button>
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
                  title={outputDirectory || defaultPaths?.outputDirectory || "—"}
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
                        .selectDirectory(outputDirectory || defaultPaths?.outputDirectory)
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

        {step === "done" ? (
          <div className="space-y-5 text-left">
            {/* Quick-start hint */}
            <div className="text-center">
              <p className="text-[13px] leading-6 text-[var(--color-text-dim)]">
                {t("setup.shortcutHint", {
                  shortcut: getShortcutDisplay(APP_SHORTCUTS.submitGeneration),
                })}
              </p>
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
              <div className="flex items-center gap-2 text-[var(--color-accent)]">
                <Keyboard size={16} />
                <p className="text-[13px] font-semibold text-white">{t("setup.shortcutsHint")}</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["toggleSidebar", APP_SHORTCUTS.toggleSidebar],
                    ["newGeneration", APP_SHORTCUTS.newGeneration],
                    ["toggleSettings", APP_SHORTCUTS.toggleSettings],
                    ["submitGeneration", APP_SHORTCUTS.submitGeneration],
                    ["togglePlayback", APP_SHORTCUTS.togglePlayback],
                  ] as const
                ).map(([labelKey, shortcut]) => {
                  const platform = getShortcutPlatform();
                  return (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2"
                    >
                      <span className="text-[12px] text-[var(--color-text-dim)]">
                        {t(`setup.shortcut_${labelKey}`)}
                      </span>
                      <kbd className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text)]">
                        {getShortcutDisplay(shortcut, platform)}
                      </kbd>
                    </div>
                  );
                })}
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
