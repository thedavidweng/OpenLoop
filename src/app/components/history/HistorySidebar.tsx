import { useCallback, useMemo, useRef, useState } from "react";
import {
  Clock3,
  FileDown,
  FolderInput,
  Play,
  Repeat,
  Settings2,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { SearchBox } from "@/app/components/history/SearchBox";
import { ProjectSelector } from "@/app/components/history/ProjectSelector";
import { FailedRunsDrawer } from "@/app/components/history/FailedRunsDrawer";
import { useGenerationStore } from "@/app/lib/store";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { useToast } from "@/app/components/overlay/Toast";
import { SettingsDialogHost } from "@/app/components/settings/SettingsDialogHost";
import * as api from "@/app/lib/api";

export function HistorySidebar() {
  const { t } = useTranslation();
  const history = useGenerationStore((state) => state.history);
  const historyQuery = useGenerationStore((state) => state.historyQuery);
  const deleteGenerationRecord = useGenerationStore((state) => state.deleteGenerationRecord);
  const toggleFavoriteRecord = useGenerationStore((state) => state.toggleFavoriteRecord);
  const restoreLastDeletedRecord = useGenerationStore((state) => state.restoreLastDeletedRecord);
  const favoriteRecordIds = useGenerationStore((state) => state.favoriteRecordIds);
  const selectGenerationRecord = useGenerationStore((state) => state.selectGenerationRecord);
  const loadGenerationSettings = useGenerationStore((state) => state.loadGenerationSettings);
  const clearGenerationHistory = useGenerationStore((state) => state.clearGenerationHistory);
  const currentGeneration = useGenerationStore((state) => state.currentGeneration);
  const selectedHistoryIds = useGenerationStore((state) => state.selectedHistoryIds);
  const toggleSelectHistory = useGenerationStore((state) => state.toggleSelectHistory);
  const clearSelection = useGenerationStore((state) => state.clearSelection);
  const batchDeleteSelected = useGenerationStore((state) => state.batchDeleteSelected);
  const batchFavoriteSelected = useGenerationStore((state) => state.batchFavoriteSelected);
  const enterCompareMode = useGenerationStore((state) => state.enterCompareMode);
  const exitCompareMode = useGenerationStore((state) => state.exitCompareMode);
  const compareModeActive = useGenerationStore((state) => state.compareModeActive);
  const compareGenerationId = useGenerationStore((state) => state.compareGenerationId);
  const activeProjectId = useGenerationStore((state) => state.activeProjectId);
  const projects = useGenerationStore((state) => state.projects);
  const assignGenerationToProject = useGenerationStore((state) => state.assignGenerationToProject);
  const { addToast } = useToast();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [batchExportOpen, setBatchExportOpen] = useState(false);
  const [projectAssignTargetId, setProjectAssignTargetId] = useState<string | null>(null);

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return history.filter((record) => {
      if (activeProjectId !== null && record.projectId !== activeProjectId) {
        return false;
      }
      if (!query) {
        return true;
      }

      return `${record.prompt} ${record.lyrics}`.toLowerCase().includes(query);
    });
  }, [history, historyQuery, activeProjectId]);

  // O(1) membership lookups for per-row checks in the virtualized render loop.
  const selectedHistoryIdSet = useMemo(() => new Set(selectedHistoryIds), [selectedHistoryIds]);
  const favoriteRecordIdSet = useMemo(() => new Set(favoriteRecordIds), [favoriteRecordIds]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredHistory.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90,
    overscan: 5,
  });

  const deleteTarget = useMemo(
    () => history.find((item) => item.id === deleteTargetId) ?? null,
    [deleteTargetId, history],
  );
  const historyCount = history.length;

  const handleItemClick = useCallback(
    (id: string, event: React.MouseEvent) => {
      const multi = event.metaKey || event.ctrlKey || event.shiftKey;
      if (multi) {
        event.preventDefault();
        toggleSelectHistory(id, true);
      } else {
        selectGenerationRecord(id);
        clearSelection();
      }
    },
    [toggleSelectHistory, selectGenerationRecord, clearSelection],
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

      <div className="shrink-0 px-3 pb-2">
        <ProjectSelector />
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

      {selectedHistoryIds.length > 0 && (
        <div className="shrink-0 px-3 py-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-2">
            <span className="text-[11px] font-medium text-[var(--color-text-dim)]">
              {selectedHistoryIds.length} selected
            </span>
            <div className="flex items-center gap-1">
              {selectedHistoryIds.length === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const [a, b] = selectedHistoryIds;
                    const currentId = currentGeneration?.id;
                    const otherId = a === currentId ? b : a === b ? a : currentId === b ? a : b;
                    if (otherId) {
                      enterCompareMode(otherId);
                    }
                  }}
                  className="inline-flex h-6 items-center gap-1 rounded-md bg-[var(--color-accent)]/10 px-2 text-[10px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20"
                >
                  <Play size={10} />
                  Compare
                </button>
              )}
              <button
                type="button"
                onClick={() => setBatchExportOpen(true)}
                className="inline-flex h-6 items-center gap-1 rounded-md bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
              >
                <FileDown size={10} />
                Export
              </button>
              <button
                type="button"
                onClick={() => batchFavoriteSelected()}
                className="inline-flex h-6 items-center gap-1 rounded-md bg-amber-500/10 px-2 text-[10px] font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
              >
                <Star size={10} />
                Favorite
              </button>
              <button
                type="button"
                onClick={() => setBatchDeleteConfirmOpen(true)}
                className="inline-flex h-6 items-center gap-1 rounded-md bg-red-600/10 px-2 text-[10px] font-medium text-red-200 transition-colors hover:bg-red-600/20"
              >
                <Trash2 size={10} />
                Delete
              </button>
              <button
                type="button"
                onClick={() => clearSelection()}
                className="inline-flex h-6 items-center rounded-md px-2 text-[10px] text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-ghost-hover)] hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {compareModeActive && (
        <div className="shrink-0 px-3 py-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-3 py-2">
            <span className="text-[11px] font-medium text-[var(--color-accent)]">A/B Compare</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (compareGenerationId) {
                    selectGenerationRecord(compareGenerationId);
                  }
                }}
                className="inline-flex h-6 items-center gap-1 rounded-md bg-[var(--color-accent)]/10 px-2 text-[10px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20"
              >
                <Repeat size={10} />
                Swap
              </button>
              <button
                type="button"
                onClick={exitCompareMode}
                className="inline-flex h-6 items-center rounded-md px-2 text-[10px] text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-ghost-hover)] hover:text-white"
              >
                <XCircle size={10} />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-text-dim)]">
          {t("history.recent")}
        </div>

        {filteredHistory.length === 0 ? (
          <div className="mx-2 mt-2 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 text-[12px] text-[var(--color-text-dim)]">
            {t("history.empty")}
          </div>
        ) : (
          <div ref={parentRef} role="list" className="custom-scrollbar overflow-auto px-1 pb-3">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = filteredHistory[virtualItem.index];
                const selected = currentGeneration?.id === item.id;
                const isMultiSelected = selectedHistoryIdSet.has(item.id);
                const isFavorited = favoriteRecordIdSet.has(item.id);
                return (
                  <div
                    key={virtualItem.key}
                    role="listitem"
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="pb-2">
                      <div
                        draggable={item.outputPath !== null && api.isTauriRuntime()}
                        onDragStart={async (e) => {
                          if (!item.outputPath || !api.isTauriRuntime()) return;
                          try {
                            const tempPath = await api.prepareDragPayload(item.id);
                            e.dataTransfer.setData("text/uri-list", `file://${tempPath}`);
                            e.dataTransfer.setData("text/plain", tempPath);
                            e.dataTransfer.effectAllowed = "copy";
                          } catch (error) {
                            console.warn("Drag payload preparation failed:", error);
                          }
                        }}
                        className={`group rounded-xl border border-l-2 border-l-emerald-500 px-3 py-3 transition-colors ${
                          isMultiSelected
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8"
                            : selected
                              ? "border-[var(--sidebar-row-selected-border)] bg-[var(--sidebar-row-selected-bg)]"
                              : "border-[var(--color-border-light)] bg-[var(--color-surface)] hover:bg-[var(--color-hover)]"
                        } ${item.outputPath ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleItemClick(item.id, e)}
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
                            {/* Favorite star */}
                            <Tooltip
                              label={isFavorited ? t("history.unfavorite") : t("history.favorite")}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavoriteRecord(item.id);
                                }}
                                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-ghost-hover)] ${isFavorited ? "text-amber-300" : "text-[var(--color-text-dim)] hover:text-amber-200"}`}
                              >
                                <Star size={11} fill={isFavorited ? "currentColor" : "none"} />
                              </button>
                            </Tooltip>
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
                            {/* Assign to project */}
                            {projects.length > 0 && (
                              <div className="relative">
                                <Tooltip label={t("projects.label")}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProjectAssignTargetId(
                                        projectAssignTargetId === item.id ? null : item.id,
                                      );
                                    }}
                                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white"
                                  >
                                    <FolderInput size={11} />
                                  </button>
                                </Tooltip>
                                {projectAssignTargetId === item.id && (
                                  <div className="absolute right-0 top-7 z-50 min-w-[140px] rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] py-1 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void assignGenerationToProject(item.id, null).catch(
                                          (error) => {
                                            console.warn("Failed to unassign generation:", error);
                                          },
                                        );
                                        setProjectAssignTargetId(null);
                                      }}
                                      className="block w-full px-3 py-1 text-left text-[11px] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-muted)]"
                                    >
                                      {t("projects.allProjects")}
                                    </button>
                                    {projects.map((project) => (
                                      <button
                                        key={project.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void assignGenerationToProject(item.id, project.id).catch(
                                            (error) => {
                                              console.warn("Failed to assign generation:", error);
                                            },
                                          );
                                          setProjectAssignTargetId(null);
                                        }}
                                        className={`block w-full px-3 py-1 text-left text-[11px] hover:bg-[var(--color-surface-muted)] ${
                                          item.projectId === project.id
                                            ? "font-medium text-[var(--color-text)]"
                                            : "text-[var(--color-text-dim)]"
                                        }`}
                                      >
                                        {project.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Failed runs drawer */}
      <FailedRunsDrawer />
      <SettingsDialogHost
        open={deleteTarget !== null}
        title={t("history.deleteTitle")}
        message={t("history.deleteMessage", {
          title: deleteTarget?.prompt || deleteTarget?.lyrics.slice(0, 48) || t("history.untitled"),
        })}
        confirmLabel={t("history.deleteConfirm")}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTargetId(null);
          void (async () => {
            await deleteGenerationRecord(id, { undoable: true });
            addToast("info", t("history.deletedUndo"), {
              duration: 5000,
              action: {
                label: t("common.undo"),
                onClick: () => {
                  restoreLastDeletedRecord();
                },
              },
            });
          })();
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
      <SettingsDialogHost
        open={batchDeleteConfirmOpen}
        title={"Delete selected items?"}
        message={`This deletes ${selectedHistoryIds.length} history items and their local audio files. This cannot be undone.`}
        confirmLabel={t("common.delete")}
        onCancel={() => setBatchDeleteConfirmOpen(false)}
        onConfirm={() => {
          setBatchDeleteConfirmOpen(false);
          void batchDeleteSelected();
        }}
      />
      <SettingsDialogHost
        open={batchExportOpen}
        title={"Export selected items?"}
        message={`Copy ${selectedHistoryIds.length} audio files to a folder.`}
        confirmLabel={"Choose folder & export"}
        onCancel={() => setBatchExportOpen(false)}
        onConfirm={async () => {
          setBatchExportOpen(false);
          if (!api.isTauriRuntime()) {
            addToast("error", t("toast.exportRequiresDesktop"));
            return;
          }
          const destination = await api.selectDirectory();
          if (!destination) return;
          try {
            const copied = await api.exportGenerationsToFolder(selectedHistoryIds, destination);
            addToast("success", t("toast.filesExported", { count: copied.length }));
          } catch (error) {
            const msg = error instanceof Error ? error.message : t("toast.exportFailed");
            addToast("error", msg);
          }
        }}
      />
    </div>
  );
}
