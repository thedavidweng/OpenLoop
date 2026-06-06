import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import type { ModelDownloadState } from "@/app/lib/types";

export function StateBadge({ state }: { state: ModelDownloadState }) {
  const { t } = useTranslation();
  const map: Record<
    ModelDownloadState,
    { label: string; classes: string; Icon: typeof CheckCircle2 }
  > = {
    ready: {
      label: t("model.ready"),
      classes: "bg-emerald-500/12 text-emerald-200 border-emerald-500/30",
      Icon: CheckCircle2,
    },
    downloading: {
      label: t("model.downloading"),
      classes:
        "bg-[var(--color-accent)]/12 text-[var(--color-accent)] border-[var(--color-accent)]/30",
      Icon: Loader2,
    },
    failed: {
      label: t("model.failed"),
      classes: "bg-red-500/12 text-red-200 border-red-500/30",
      Icon: AlertCircle,
    },
    not_installed: {
      label: t("model.notInstalled"),
      classes: "bg-white/4 text-[var(--color-text-dim)] border-white/8",
      Icon: Download,
    },
  };
  const { label, classes, Icon } = map[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${classes}`}
    >
      <Icon size={10} className={state === "downloading" ? "animate-spin" : ""} />
      {label}
    </span>
  );
}
