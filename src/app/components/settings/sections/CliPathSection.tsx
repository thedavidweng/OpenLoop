import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Terminal } from "lucide-react";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import * as api from "@/app/lib/api";

export function CliPathSection() {
  const { t } = useTranslation();
  const [cliPathStatus, setCliPathStatus] = useState<"loading" | "added" | "not_added" | "error">(
    "loading",
  );
  const [cliPathError, setCliPathError] = useState<string | null>(null);

  useEffect(() => {
    api
      .isCliInPath()
      .then((added) => setCliPathStatus(added ? "added" : "not_added"))
      .catch(() => setCliPathStatus("error"));
  }, []);

  const handleCliPathToggle = async () => {
    setCliPathStatus("loading");
    setCliPathError(null);
    try {
      if (cliPathStatus === "added") {
        await api.removeCliFromPath();
        setCliPathStatus("not_added");
      } else {
        await api.addCliToPath();
        setCliPathStatus("added");
      }
    } catch (err) {
      setCliPathStatus("error");
      setCliPathError(String(err));
    }
  };

  return (
    <SettingsSectionCard
      id="settings-section-path"
      title={t("settings.cliPath")}
      description={t("settings.cliPathDescription")}
    >
      <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
        {t("settings.cliPathHint", {
          link: "/usr/local/bin/openloop",
        })}
      </p>
      {cliPathError && (
        <p className="text-[11px] text-[var(--color-destructive)]">{cliPathError}</p>
      )}
      <button
        type="button"
        onClick={handleCliPathToggle}
        disabled={cliPathStatus === "loading"}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] disabled:cursor-wait disabled:opacity-60"
      >
        {cliPathStatus === "loading" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{t("settings.cliPathChecking")}</span>
          </>
        ) : cliPathStatus === "added" ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-green-400" />
            <span>{t("settings.cliPathRemove")}</span>
          </>
        ) : (
          <>
            <Terminal className="h-3 w-3" />
            <span>
              {cliPathStatus === "error" ? t("settings.cliPathRetry") : t("settings.cliPathAdd")}
            </span>
          </>
        )}
      </button>
    </SettingsSectionCard>
  );
}
