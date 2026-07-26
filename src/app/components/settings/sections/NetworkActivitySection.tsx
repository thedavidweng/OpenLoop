import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import * as api from "@/app/lib/api";

export function NetworkActivitySection() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<api.NetworkEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    void api
      .getNetworkLog(50)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SettingsSectionCard
      id="settings-section-network"
      title={t("settings.networkActivity")}
      description={t("settings.networkActivityDescription")}
      headerAction={
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
        >
          {loading ? t("settings.refreshing") : t("settings.refresh")}
        </button>
      }
    >
      {entries.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-dim)]">
          {t("settings.noNetworkActivity")}
        </p>
      ) : (
        <div className="max-h-60 overflow-y-auto rounded-md border border-[var(--color-border-light)]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
                <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-dim)]">
                  {t("settings.networkTime")}
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-dim)]">
                  {t("settings.networkMethod")}
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-dim)]">
                  {t("settings.networkUrl")}
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--color-text-dim)]">
                  {t("settings.networkStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={`${entry.timestamp}-${index}`}
                  className="border-b border-[var(--color-border-light)] last:border-0"
                >
                  <td className="px-3 py-1.5 text-[var(--color-text-dim)] whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[var(--color-text)]">{entry.method}</td>
                  <td
                    className="px-3 py-1.5 text-[var(--color-text)] truncate max-w-[280px]"
                    title={entry.url}
                  >
                    {truncateUrl(entry.url)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    <span className={statusColor(entry.status)}>{entry.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function truncateUrl(url: string): string {
  // Remove protocol for display brevity
  const stripped = url.replace(/^https?:\/\//, "");
  if (stripped.length > 60) {
    return stripped.slice(0, 57) + "...";
  }
  return stripped;
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-green-400";
  if (status >= 300 && status < 400) return "text-yellow-400";
  if (status >= 400) return "text-[var(--color-destructive)]";
  return "text-[var(--color-text)]";
}
