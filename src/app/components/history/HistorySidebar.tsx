import { useMemo, useState } from "react";
import {
  Clock3,
  Play,
  Settings2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchBox } from "@/app/components/history/SearchBox";
import { useGenerationStore } from "@/app/lib/store";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { SettingsDialogHost } from "@/app/components/settings/SettingsDialogHost";

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
  const clearGenerationHistory = useGenerationStore(
    (state) => state.clearGenerationHistory,
  );
  const currentGeneration = useGenerationStore(
    (state) => state.currentGeneration,
  );
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return history.filter((record) => {
      if (!query) {
        return true;
      }

      return `${record.prompt} ${record.lyrics}`.toLowerCase().includes(query);
    });
  }, [history, historyQuery]);

  const deleteTarget = useMemo(
    () => history.find((item) => item.id === deleteTargetId) ?? null,
    [deleteTargetId, history],
  );
  const historyCount = history.length;

  return (
    <div
      className="app-panel-surface flex h-full w-[var(--window-shell-sidebar-width)] shrink-0 flex-col border-r border-[color-mix(in_srgb,var(--color-border)_86%,transparent)] bg-[color-mix(in_srgb,var(--color-sidebar)_94%,transparent)] shadow-[1px_0_0_rgba(255,255,255,0.02)]"
      data-window-shell-section="sidebar"
      data-sidebar-visual-variant="unified"
    >
      <div className="shrink-0 px-3 pb-3 pt-3">
        <SearchBox />
      </div>

      <div className="shrink-0 px-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-[var(--color-text-dim)]">
              {t("history.generatedMusic")}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-dimmer)]">
              {t("history.itemCount", { count: historyCount })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setClearConfirmOpen(true)}
            disabled={historyCount === 0}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-red-500/25 bg-red-600/8 px-2 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-600/16 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={11} />
            {t("history.clearAllShort")}
          </button>
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-text-dim)]">
          {t("history.recent")}
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
                    className={`group rounded-xl border border-l-2 border-l-emerald-500 px-3 py-3 transition-colors ${
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
                          {item.prompt ||
                            item.lyrics.slice(0, 48) ||
                            t("history.untitled")}
                        </p>
                        {/* Key parameters row */}
                        <p className="mt-1 truncate text-[11px] text-[var(--color-text-dim)]">
                          {item.bpm ? `${item.bpm} BPM` : null}
                          {item.bpm && item.keyScale ? " · " : null}
                          {item.keyScale || null}
                          {(item.bpm || item.keyScale) && " · "}
                          {item.audioFormat.toUpperCase()} ·{" "}
                          {Math.round(item.durationSeconds)}s
                        </p>
                      </div>
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
                              setDeleteTargetId(item.id);
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
      <SettingsDialogHost
        open={deleteTarget !== null}
        title={t("history.deleteTitle")}
        message={t("history.deleteMessage", {
          title:
            deleteTarget?.prompt ||
            deleteTarget?.lyrics.slice(0, 48) ||
            t("history.untitled"),
        })}
        confirmLabel={t("history.deleteConfirm")}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTargetId(null);
          void deleteGenerationRecord(id);
        }}
      />
      <SettingsDialogHost
        open={clearConfirmOpen}
        title={t("history.clearTitle")}
        message={t("history.clearMessage", { count: historyCount })}
        confirmLabel={t("history.clearConfirm")}
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          setClearConfirmOpen(false);
          void clearGenerationHistory();
        }}
      />
    </div>
  );
}
