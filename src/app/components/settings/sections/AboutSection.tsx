import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { useGenerationStore } from "@/app/lib/store";
import {
  collectDiagnostics,
  copyDebugInfo,
  formatBackendStatus,
  type DiagnosticsBundle,
} from "@/app/lib/diagnostics";

const COPIED_RESET_MS = 2000;
const REPOSITORY_URL = "https://github.com/thedavidweng/OpenLoop";
const PLACEHOLDER = "—";

function AboutRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-[var(--color-text-dim)]">{label}</dt>
      <dd className="min-w-0 break-words text-[var(--color-text)]">{value}</dd>
    </>
  );
}

export function AboutSection() {
  const { t } = useTranslation();
  const deviceInfo = useGenerationStore((state) => state.deviceInfo);
  const [bundle, setBundle] = useState<DiagnosticsBundle | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    collectDiagnostics()
      .then((value) => {
        if (!cancelled) {
          setBundle(value);
        }
      })
      .catch(() => {
        // About is display-only; a failed fetch just leaves placeholders. The
        // copy button still fetches fresh on demand.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async () => {
    try {
      await copyDebugInfo();
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // Clipboard access requires the desktop runtime; ignore failures.
    }
  };

  const system = deviceInfo
    ? `${deviceInfo.os} · ${deviceInfo.arch}${deviceInfo.isAppleSilicon ? " · Apple Silicon" : ""}`
    : PLACEHOLDER;
  const backend = bundle ? formatBackendStatus(bundle.backendStatus) : PLACEHOLDER;

  return (
    <SettingsSectionCard
      id="settings-section-about"
      title={t("settings.about.title")}
      description={t("settings.about.description")}
    >
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <AboutRow
          label={t("settings.about.version")}
          value={`OpenLoop ${import.meta.env.PACKAGE_VERSION}`}
        />
        <AboutRow label={t("settings.about.build")} value={bundle?.buildSha ?? PLACEHOLDER} />
        <AboutRow label={t("settings.about.system")} value={system} />
        <AboutRow label={t("settings.about.backend")} value={backend} />
        <AboutRow label={t("settings.about.logs")} value={bundle?.appLogDir ?? PLACEHOLDER} />
        <AboutRow
          label={t("settings.about.repository")}
          value={
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] no-underline hover:underline"
            >
              {REPOSITORY_URL}
            </a>
          }
        />
      </dl>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex h-9 w-fit items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
      >
        {copied ? t("settings.about.copied") : t("settings.about.copyDebugInfo")}
      </button>
    </SettingsSectionCard>
  );
}
