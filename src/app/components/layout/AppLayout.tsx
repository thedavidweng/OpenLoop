import { useEffect } from "react";
import { MainContentView } from "@/app/components/layout/MainContentView";
import { SidebarRail } from "@/app/components/layout/SidebarRail";
import { WindowChrome } from "@/app/components/layout/WindowChrome";
import { HistorySidebar } from "@/app/components/history/HistorySidebar";
import { createWindowShellStyle, useWindowShellState } from "@/app/lib/window-shell";
import { useGenerationStore } from "@/app/lib/store";
import {
  APP_SHORTCUTS,
  isInputFocused,
  matchesShortcut,
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
  const generationState = useGenerationStore((state) => state.generationState);
  const windowShellState = useWindowShellState(sidebarWidth);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when input is focused (except Space for non-input)
      if (isInputFocused()) return;

      if (matchesShortcut(event, APP_SHORTCUTS.toggleSidebar)) {
        event.preventDefault();
        toggleSidebar();
      } else if (matchesShortcut(event, APP_SHORTCUTS.newGeneration)) {
        event.preventDefault();
        resetForm();
      } else if (matchesShortcut(event, APP_SHORTCUTS.toggleSettings)) {
        event.preventDefault();
        toggleSettings();
      } else if (matchesShortcut(event, APP_SHORTCUTS.submitGeneration)) {
        event.preventDefault();
        if (generationState.status !== "running" && generationState.status !== "validating") {
          void runGeneration();
        }
      } else if (matchesShortcut(event, APP_SHORTCUTS.retryGeneration)) {
        event.preventDefault();
        if (generationState.status === "failed") {
          void runGeneration();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, resetForm, toggleSettings, runGeneration, generationState.status]);

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
        <SidebarRail
          visible={sidebarVisible}
          width={sidebarWidth}
          onResize={setSidebarWidth}
        >
          <HistorySidebar />
        </SidebarRail>

        <MainContentView />
      </div>
    </div>
  );
}
