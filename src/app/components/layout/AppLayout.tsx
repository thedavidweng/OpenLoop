import { useEffect, useMemo, useState } from "react";
import { MainContentView } from "@/app/components/layout/MainContentView";
import { SidebarRail } from "@/app/components/layout/SidebarRail";
import { WindowChrome } from "@/app/components/layout/WindowChrome";
import { HistorySidebar } from "@/app/components/history/HistorySidebar";
import { createWindowShellStyle, useWindowShellState } from "@/app/lib/window-shell";
import { useGenerationStore } from "@/app/lib/store";
import {
  APP_SHORTCUTS,
  getShortcutDisplay,
  shouldHandleGlobalShortcut,
} from "@/app/lib/app-shortcuts";

export function AppLayout() {
  const sidebarVisible = useGenerationStore((state) => state.sidebarVisible);
  const sidebarWidth = useGenerationStore((state) => state.sidebarWidth);
  const setSidebarWidth = useGenerationStore((state) => state.setSidebarWidth);
  const toggleSidebar = useGenerationStore((state) => state.toggleSidebar);
  const settingsOpen = useGenerationStore((state) => state.isSettingsOpen);
  const toggleSettings = useGenerationStore((state) => state.toggleSettings);
  const resetForm = useGenerationStore((state) => state.resetForm);
  const runGeneration = useGenerationStore((state) => state.runGeneration);
  const requestPlaybackToggle = useGenerationStore((state) => state.requestPlaybackToggle);
  const generationState = useGenerationStore((state) => state.generationState);
  const compareModeActive = useGenerationStore((state) => state.compareModeActive);
  const toggleCompareTarget = useGenerationStore((state) => state.toggleCompareTarget);
  const windowShellState = useWindowShellState(sidebarWidth);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const shortcutRows = useMemo(
    () =>
      [
        ["Toggle sidebar", APP_SHORTCUTS.toggleSidebar],
        ["New generation", APP_SHORTCUTS.newGeneration],
        ["Open settings", APP_SHORTCUTS.toggleSettings],
        ["Generate", APP_SHORTCUTS.submitGeneration],
        ["Retry failed generation", APP_SHORTCUTS.retryGeneration],
        ["Play / pause", APP_SHORTCUTS.togglePlayback],
        ["A / B compare", APP_SHORTCUTS.compareToggle],
        ["Keyboard shortcuts", APP_SHORTCUTS.keyboardHelp],
      ] as const,
    [],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shortcutsOpen && event.key === "Escape") {
        event.preventDefault();
        setShortcutsOpen(false);
        return;
      }
      if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.togglePlayback)) {
        event.preventDefault();
        requestPlaybackToggle();
      } else if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.keyboardHelp)) {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
      } else if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.toggleSidebar)) {
        event.preventDefault();
        toggleSidebar();
      } else if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.newGeneration)) {
        event.preventDefault();
        resetForm();
      } else if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.toggleSettings)) {
        event.preventDefault();
        toggleSettings();
      } else if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.submitGeneration)) {
        event.preventDefault();
        if (generationState.status !== "running" && generationState.status !== "validating") {
          void runGeneration();
        }
      } else if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.retryGeneration)) {
        event.preventDefault();
        if (generationState.status === "failed") {
          void runGeneration();
        }
      } else if (shouldHandleGlobalShortcut(event, APP_SHORTCUTS.compareToggle)) {
        event.preventDefault();
        if (compareModeActive) {
          toggleCompareTarget();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleSidebar,
    resetForm,
    toggleSettings,
    runGeneration,
    requestPlaybackToggle,
    generationState.status,
    shortcutsOpen,
  ]);

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden font-sans"
      data-window-chrome-platform={windowShellState.chromeVariant}
      data-window-shell-tier={windowShellState.tier}
      style={createWindowShellStyle(windowShellState)}
    >
      <WindowChrome
        onToggleSettings={toggleSettings}
        onToggleSidebar={toggleSidebar}
        shellState={windowShellState}
        settingsOpen={settingsOpen}
        sidebarVisible={sidebarVisible}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarRail visible={sidebarVisible} width={sidebarWidth} onResize={setSidebarWidth}>
          <HistorySidebar />
        </SidebarRail>

        <MainContentView />
      </div>

      {shortcutsOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="keyboard-shortcuts-title" className="text-base font-semibold text-white">
                  Keyboard shortcuts
                </h2>
                <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
                  Common OpenLoop commands.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="rounded-lg px-2 py-1 text-[12px] text-[var(--color-text-dim)] hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
              >
                Esc
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {shortcutRows.map(([label, shortcut]) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border-light)] bg-black/10 px-3 py-2"
                >
                  <span className="text-[13px] text-[var(--color-text-primary)]">{label}</span>
                  <kbd className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-2 py-1 text-[11px] font-semibold text-white">
                    {getShortcutDisplay(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
