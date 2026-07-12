import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Check, CheckCircle2, Clock, Download, Loader2 } from "lucide-react";
import {
  MODEL_PACKS,
  MODEL_VARIANTS,
  packIdForVariant,
  type ModelPackId,
} from "@/app/lib/model-packs";
import type { ModelDownloadState, ModelVariant } from "@/app/lib/types";

export type SetupStep = "welcome" | "device" | "model" | "output" | "done";

export const STEP_ORDER: SetupStep[] = ["welcome", "device", "model", "output", "done"];

export function StepIndicator({ current }: { current: SetupStep }) {
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

export function SetupActionCard({ icon: Icon, title, description }: SetupActionCardProps) {
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

export function bytesToLabel(bytes: number) {
  if (!bytes) return "0 GB";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function progressPercent(downloadedBytes: number, totalBytes?: number | null) {
  if (!totalBytes) return 0;
  return Math.min(100, Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)));
}

export function etaFromBytes(totalBytes: number, speedBps = 10 * 1024 * 1024) {
  const seconds = totalBytes / speedBps;
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatEta(seconds: number): string {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `~${Math.ceil(seconds)} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `~${mins} min ${secs} sec`;
}

export function PackDownloadCard({
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

export function VariantPickerCard({
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
