import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import * as api from "@/app/lib/api";

const LEVELS = ["trace", "debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

export function LogsSection() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<api.AppLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [minLevel, setMinLevel] = useState<Level>("info");

  const refresh = useCallback(() => {
    setLoading(true);
    void api
      .getAppLogs(minLevel, 200)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [minLevel]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const levelColor = useMemo(
    () => ({
      error: "text-red-400",
      warn: "text-yellow-400",
      info: "text-white",
      debug: "text-[var(--color-text-dim)]",
      trace: "text-[var(--color-text-dimmer)]",
    }),
    [],
  );

  return (
    <SettingsSectionCard
      id="settings-section-logs"
      title={t("settings.appLogs")}
      description={t("settings.appLogsDescription")}
      headerAction={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-dim)]">
            {t("settings.logLevel")}
            <select
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value as Level)}
              className="rounded border border-[var(--color-border-light)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] text-white outline-none"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-white disabled:opacity-50"
          >
            {loading ? t("settings.refreshing") : t("settings.refresh")}
          </button>
        </div>
      }
    >
      {entries.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-dim)]">{t("settings.noLogs")}</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--color-border-light)] font-mono text-[11px]">
          {entries.map((entry, index) => (
            <div
              key={`${entry.timestamp}-${index}`}
              className="border-b border-[var(--color-border-light)] px-3 py-1.5 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-dim)] whitespace-nowrap">
                  {formatTimestamp(entry.timestamp)}
                </span>
                <span
                  className={`uppercase font-semibold ${levelColor[entry.level as Level] ?? "text-white"}`}
                >
                  {entry.level}
                </span>
                {entry.target && (
                  <span className="text-[var(--color-text-dimmer)] truncate">{entry.target}</span>
                )}
              </div>
              <p className="mt-0.5 text-white break-all">
                {extractMessage(entry.fields) ??
                  (entry.fields &&
                  typeof entry.fields === "object" &&
                  Object.keys(entry.fields as object).length > 0
                    ? JSON.stringify(entry.fields)
                    : entry.raw)}
              </p>
            </div>
          ))}
        </div>
      )}
    </SettingsSectionCard>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function extractMessage(fields: unknown): string | null {
  if (typeof fields === "object" && fields !== null) {
    const obj = fields as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
  }
  return null;
}
