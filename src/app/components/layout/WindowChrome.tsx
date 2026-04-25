import { Toolbar } from "@/app/components/layout/Toolbar";
import type { WindowShellState } from "@/app/lib/window-shell";

interface WindowChromeProps {
  onToggleSettings: () => void;
  onToggleSidebar: () => void;
  settingsOpen: boolean;
  shellState: WindowShellState;
  sidebarVisible: boolean;
}

export function WindowChrome(props: WindowChromeProps) {
  return <Toolbar {...props} />;
}
