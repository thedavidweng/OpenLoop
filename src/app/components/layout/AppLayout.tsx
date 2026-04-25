import { MainContentView } from "@/app/components/layout/MainContentView";
import { SidebarRail } from "@/app/components/layout/SidebarRail";
import { WindowChrome } from "@/app/components/layout/WindowChrome";
import { HistorySidebar } from "@/app/components/history/HistorySidebar";
import { createWindowShellStyle, useWindowShellState } from "@/app/lib/window-shell";
import { useGenerationStore } from "@/app/lib/store";

export function AppLayout() {
  const sidebarVisible = useGenerationStore((state) => state.sidebarVisible);
  const sidebarWidth = useGenerationStore((state) => state.sidebarWidth);
  const setSidebarWidth = useGenerationStore((state) => state.setSidebarWidth);
  const toggleSidebar = useGenerationStore((state) => state.toggleSidebar);
  const settingsOpen = useGenerationStore((state) => state.isSettingsOpen);
  const toggleSettings = useGenerationStore((state) => state.toggleSettings);
  const windowShellState = useWindowShellState(sidebarWidth);

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
