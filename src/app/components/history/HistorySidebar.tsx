import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Folder, Play, Settings2, Trash2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchBox } from "@/app/components/history/SearchBox";
import { useGenerationStore } from "@/app/lib/store";
import { Tooltip } from "@/app/components/overlay/Tooltip";

type HistoryFilter = "all" | "completed" | "failed" | "cancelled";

const STATUS_BORDER = {
  completed: "border-l-emerald-500",
  failed: "border-l-red-500",
  cancelled: "border-l-amber-500",
} as const;

export function HistorySidebar() {
  const { t } = useTranslation();
  const history = useGenerationStore((state) => state.history);
  const historyQuery = useGenerationStore((state) => state.historyQuery);
  const deleteGenerationRecord = useGenerationStore(
    (state) => state.deleteGenerationRecord,
  );
  const selectGenerationRecord = useGenerationStore(
    (state) => state.selectGenerationRecord,
  );
  const loadGenerationSettings = useGenerationStore(
    (state) => state.loadGenerationSettings,
  );
  const currentGeneration = useGenerationStore((state) => state.currentGeneration);
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return history.filter((record) => {
      if (filter !== "all" && record.status !== filter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${record.prompt} ${record.lyrics}`.toLowerCase().includes(query);
    });
  }, [filter, history, historyQuery]);

  const counts = useMemo(
    () => ({
      all: history.length,
      completed: history.filter((record) => record.status === "completed").length,
      failed: history.filter((record) => record.status === "failed").length,
      cancelled: history.filter((record) => record.status === "cancelled").length,
    }),
    [history],
  );

  return (
    <div
      className="app-panel-surface flex h-full w-[var(--window-shell-sidebar-width)] shrink-0 flex-col border-r border-[color-mix(in_srgb,var(--color-border)_86%,transparent)] bg-[color-mix(in_srgb,var(--color-sidebar)_94%,transparent)] shadow-[1px_0_0_rgba(255,255,255,0.02)]"
      data-window-shell-section="sidebar"
      data-sidebar-visual-variant="unified"
    >
      <div className="shrink-0 px-3 pb-3 pt-3">
        <SearchBox />
      </div>

      <div className="shrink-0 space-y-0.5 px-2">
        <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-text-dim)]">
          {t("history.localRuns")}
        </div>

        {([
          ["all", t("history.all"), counts.all, Folder],
          ["completed", t("history.completed"), counts.completed, CheckCircle2],
          ["failed", t("history.failed"), counts.failed, XCircle],
          ["cancelled", t("history.cancelled"), counts.cancelled, XCircle],
        ] as const).map(([value, label, count, Icon]) => {
          const selected = filter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`sidebar-source-list-row motion-surface flex w-full items-center justify-between px-2 py-1.5 ${
                selected
                  ? "border border-[var(--sidebar-row-selected-border)] bg-[var(--sidebar-row-selected-bg)] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)]"
                  : "border border-transparent text-[var(--color-text)] hover:bg-[var(--sidebar-row-overlay-bg)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon size={14} className="text-[var(--color-accent)]" />
                <span>{label}</span>
              </span>
              <span className="text-[11px] text-[var(--color-text-dim)]">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-text-dim)]">
          {t("history.localMusic")}
        </div>

        {filteredHistory.length === 0 ? (
          <div className="mx-2 mt-2 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 text-[12px] text-[var(--color-text-dim)]">
            {t("history.empty")}
          </div>
        ) : (
          <ul className="custom-scrollbar space-y-2 overflow-auto px-1 pb-3">
            {filteredHistory.map((item) => {
              const selected = currentGeneration?.id === item.id;
              return (
                <li key={item.id}>
                  <div
                    className={`group rounded-xl border border-l-2 px-3 py-3 transition-colors ${
                      STATUS_BORDER[item.status]
                    } ${
                      selected
                        ? "border-[var(--sidebar-row-selected-border)] bg-[var(--sidebar-row-selected-bg)]"
                        : "border-[var(--color-border-light)] bg-[var(--color-surface)] hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectGenerationRecord(item.id)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">
                          {item.prompt || item.lyrics.slice(0, 48) || t("history.untitled")}
                        </p>
                        {/* Key parameters row */}
                        <p className="mt-1 truncate text-[11px] text-[var(--color-text-dim)]">
                          {item.bpm ? `${item.bpm} BPM` : null}
                          {item.bpm && item.keyScale ? " · " : null}
                          {item.keyScale || null}
                          {(item.bpm || item.keyScale) && " · "}
                          {item.audioFormat.toUpperCase()} · {Math.round(item.durationSeconds)}s
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          item.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : item.status === "cancelled"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {t(`history.status.${item.status}`)}
                      </span>
                    </button>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-dim)]">
                      <span className="flex items-center gap-1.5">
                        <Clock3 size={11} />
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        {/* Quick play button */}
                        <Tooltip label={t("player.play")}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectGenerationRecord(item.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white"
                          >
                            <Play size={11} fill="currentColor" />
                          </button>
                        </Tooltip>
                        {/* Always-visible Use Settings button */}
                        <Tooltip label={t("history.useSettings")}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadGenerationSettings(item.id, "settings");
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white"
                          >
                            <Settings2 size={11} />
                          </button>
                        </Tooltip>
                        {/* Reproduce button */}
                        <Tooltip label={t("history.reproduce")}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadGenerationSettings(item.id, "reproduce");
                            }}
                            className="contextual-reveal flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white"
                            data-visible={selected}
                          >
                            <Play size={11} />
                          </button>
                        </Tooltip>
                        {/* Delete button */}
                        <Tooltip label={t("common.delete")}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteGenerationRecord(item.id);
                            }}
                            className="contextual-reveal flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-red-400"
                            data-visible={selected}
                          >
                            <Trash2 size={11} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
