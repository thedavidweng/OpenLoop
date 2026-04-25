import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronLeft, Cpu, FolderOutput, Sparkles } from "lucide-react";
import * as api from "@/app/lib/api";
import { MODEL_VARIANTS, useGenerationStore } from "@/app/lib/store";
import type { ModelVariant } from "@/app/lib/types";

interface SetupScreenProps {
  onClose?: () => void;
}

type SetupStep = "welcome" | "device" | "model" | "output" | "done";

const STEP_ORDER: SetupStep[] = ["welcome", "device", "model", "output", "done"];

function StepIndicator({ current }: { current: SetupStep }) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-2">
      {STEP_ORDER.map((step, index) => (
        <div
          key={step}
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            index <= currentIndex ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
          }`}
        />
      ))}
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
    <div className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-sidebar)] px-5 py-4 text-left">
      <Icon size={20} className="shrink-0 text-[var(--color-accent)]" />
      <div>
        <div className="text-[14px] font-medium text-white">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
          {description}
        </div>
      </div>
    </div>
  );
}

function ModelOptionCard({
  variant,
  selected,
  downloaded,
  busy,
  onSelect,
  onDownload,
}: {
  variant: ModelVariant;
  selected: boolean;
  downloaded: boolean;
  busy: boolean;
  onSelect: () => void;
  onDownload: () => void;
}) {
  const { t } = useTranslation();
  const meta = MODEL_VARIANTS[variant];

  return (
    <div
      className={`rounded-lg border p-4 text-left ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
          : "border-[var(--color-border)] bg-[var(--color-sidebar)]"
      }`}
    >
      <div className="space-y-1">
        <p className="text-[14px] font-medium text-white">{meta.label}</p>
        <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
          {meta.description}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-dimmer)]">
          {downloaded ? t("setup.downloaded") : t("setup.notDownloaded")}
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        {downloaded ? (
          <button
            type="button"
            onClick={onSelect}
            disabled={busy}
            className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white disabled:opacity-50"
          >
            {selected ? t("model.selected") : t("model.select")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {busy ? t("setup.preparing") : t("setup.downloadModelButton")}
          </button>
        )}
      </div>
    </div>
  );
}

export function SetupScreen({ onClose }: SetupScreenProps) {
  const { t } = useTranslation();
  const deviceInfo = useGenerationStore((state) => state.deviceInfo);
  const settings = useGenerationStore((state) => state.settings);
  const completeSetup = useGenerationStore((state) => state.completeSetup);
  const downloadModelVariant = useGenerationStore((state) => state.downloadModelVariant);
  const selectModelVariant = useGenerationStore((state) => state.selectModelVariant);
  const [step, setStep] = useState<SetupStep>("welcome");
  const [busyVariant, setBusyVariant] = useState<ModelVariant | null>(null);
  const [outputDirectory, setOutputDirectory] = useState(settings.outputDirectory ?? "");

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

  const nextStep = async () => {
    if (step === "output" && api.isTauriRuntime()) {
      await api.setSetting("outputDirectory", outputDirectory || null);
    }

    setStep(STEP_ORDER[Math.min(currentIndex + 1, STEP_ORDER.length - 1)]);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--color-surface)]">
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 text-center">
        <StepIndicator current={step} />

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
          {step === "welcome" ? <Sparkles size={28} /> : null}
          {step === "device" ? <Cpu size={28} /> : null}
          {step === "model" ? <Sparkles size={28} /> : null}
          {step === "output" ? <FolderOutput size={28} /> : null}
          {step === "done" ? <Check size={28} /> : null}
        </div>

        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
	            {t("setup.eyebrow")}
          </p>
          <h1 className="text-3xl font-bold text-white">{stepTitle}</h1>
        </div>

        {step === "welcome" ? (
          <div className="space-y-4">
            <p className="mx-auto max-w-2xl text-[14px] leading-7 text-[var(--color-text-dim)]">
	              {t("setup.welcomeBody")}
            </p>
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
          </div>
        ) : null}

        {step === "device" ? (
          <div className="space-y-4">
            <p className="mx-auto max-w-2xl text-[14px] leading-7 text-[var(--color-text-dim)]">
	              {t("setup.deviceBody")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4 text-left">
                <p className="text-[11px] uppercase text-[var(--color-text-dim)]">{t("setup.os")}</p>
                <p className="mt-1 text-[14px] font-medium text-white">{deviceInfo?.os ?? t("common.unknown")}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4 text-left">
                <p className="text-[11px] uppercase text-[var(--color-text-dim)]">{t("setup.architecture")}</p>
                <p className="mt-1 text-[14px] font-medium text-white">{deviceInfo?.arch ?? t("common.unknown")}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4 text-left">
                <p className="text-[11px] uppercase text-[var(--color-text-dim)]">{t("setup.memory")}</p>
                <p className="mt-1 text-[14px] font-medium text-white">
                  {deviceInfo ? `${deviceInfo.totalMemoryGb} GB` : t("common.unknown")}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4 text-left">
                <p className="text-[11px] uppercase text-[var(--color-text-dim)]">{t("setup.recommendedProfile")}</p>
                <p className="mt-1 text-[14px] font-medium text-white">{recommendedProfile}</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === "model" ? (
          <div className="space-y-4 text-left">
            <p className="text-center text-[14px] leading-7 text-[var(--color-text-dim)]">
	              {t("setup.modelBody")}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {(["lite", "turbo", "pro"] as const).map((variant) => (
                <ModelOptionCard
                  key={variant}
                  variant={variant}
                  selected={settings.modelVariant === variant}
                  downloaded={settings.downloadedModels.includes(variant)}
                  busy={busyVariant === variant}
                  onSelect={() => {
                    setBusyVariant(variant);
                    void selectModelVariant(variant).finally(() => setBusyVariant(null));
                  }}
                  onDownload={() => {
                    setBusyVariant(variant);
                    void downloadModelVariant(variant).finally(() => setBusyVariant(null));
                  }}
                />
              ))}
            </div>
            <p className="text-center text-[12px] text-[var(--color-text-dim)]">
	              {t("setup.recommended", { model: MODEL_VARIANTS[recommendedVariant].label })}
            </p>
          </div>
        ) : null}

        {step === "output" ? (
          <div className="space-y-4 text-left">
            <p className="text-center text-[14px] leading-7 text-[var(--color-text-dim)]">
	              {t("setup.outputBody")}
            </p>
            <label className="mx-auto block max-w-xl space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
              <span className="text-[11px] uppercase text-[var(--color-text-dim)]">
                {t("settings.outputDirectory")}
              </span>
              <input
                className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
                value={outputDirectory}
                onChange={(event) => setOutputDirectory(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="space-y-4">
            <p className="mx-auto max-w-2xl text-[14px] leading-7 text-[var(--color-text-dim)]">
	              {t("setup.doneBody")}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
            >
              {t("setup.close")}
            </button>
          ) : null}
          {currentIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStep(STEP_ORDER[currentIndex - 1])}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
            >
              <ChevronLeft size={12} /> {t("setup.back")}
            </button>
          ) : null}
          {step !== "done" ? (
            <button
              type="button"
              onClick={() => {
                void nextStep();
              }}
              className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:brightness-110"
            >
              {t("setup.next")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void completeSetup();
              }}
              className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:brightness-110"
            >
              {t("setup.finish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
