import { FolderOutput, PanelLeft, Settings, Sparkles, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { APP_SHORTCUTS, getShortcutDisplay } from "@/app/lib/app-shortcuts";
import * as api from "@/app/lib/api";
import { createWindowShellStyle, type WindowShellState } from "@/app/lib/window-shell";
import { useGenerationStore } from "@/app/lib/store";

interface ToolbarProps {
  onToggleSidebar: () => void;
  onToggleSettings: () => void;
  shellState: WindowShellState;
  settingsOpen: boolean;
  sidebarVisible: boolean;
}

export function Toolbar({
  onToggleSidebar,
  onToggleSettings,
  shellState,
  settingsOpen,
  sidebarVisible,
}: ToolbarProps) {
  const { t } = useTranslation();
  const outputDirectory = useGenerationStore((state) => state.settings.outputDirectory);
  const reopenSetup = useGenerationStore((state) => state.reopenSetup);
  const resetForm = useGenerationStore((state) => state.resetForm);

  return (
    <div
      className="flex shrink-0 items-center bg-[var(--color-toolbar)] px-4"
      data-window-shell-tier={shellState.tier}
      style={{
        ...createWindowShellStyle(shellState),
        height: "var(--window-shell-toolbar-height)",
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{
          paddingInlineStart: "var(--window-shell-leading-controls-space)",
        }}
      >
        <Tooltip
          label={t("toolbar.toggleSidebar")}
          shortcut={getShortcutDisplay(APP_SHORTCUTS.toggleSidebar)}
        >
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={t("toolbar.toggleSidebar")}
            className={`motion-icon-button rounded-xl p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
              sidebarVisible
                ? "bg-[var(--color-control-selected-bg)] text-[var(--color-text)] shadow-[var(--shadow-control-selected)]"
                : "text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-[var(--color-text)]"
            }`}
          >
            <PanelLeft size={16} />
          </button>
        </Tooltip>
        <div className="h-4 w-px bg-[var(--color-border-light)]" />
        <Tooltip
          label={t("toolbar.newGeneration")}
          shortcut={getShortcutDisplay(APP_SHORTCUTS.newGeneration)}
        >
          <button
            type="button"
            onClick={resetForm}
            className="motion-surface flex items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-hover)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <Sparkles size={14} /> {t("toolbar.newGeneration")}
          </button>
        </Tooltip>
      </div>

      <div className="min-w-0 flex-1 self-stretch px-4" data-tauri-drag-region />

      <div className="flex items-center gap-4">
        <Tooltip label={t("toolbar.revealOutput")}>
          <button
            type="button"
            onClick={() => {
              if (outputDirectory) {
                void api.revealInFinder(outputDirectory).catch(() => {});
              }
            }}
            aria-label={t("toolbar.revealOutput")}
            className="motion-icon-button rounded-xl p-2 text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <FolderOutput size={16} />
          </button>
        </Tooltip>
        <Tooltip label={t("toolbar.openSetup")}>
          <button
            type="button"
            onClick={reopenSetup}
            aria-label={t("toolbar.openSetup")}
            className="motion-icon-button rounded-xl p-2 text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <Wand2 size={16} />
          </button>
        </Tooltip>
        <Tooltip
          label={t("toolbar.settings")}
          shortcut={getShortcutDisplay(APP_SHORTCUTS.toggleSettings)}
        >
          <button
            type="button"
            onClick={onToggleSettings}
            aria-label={t("toolbar.settings")}
            className={`motion-icon-button rounded-xl p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
              settingsOpen
                ? "bg-[var(--color-control-selected-bg)] text-[var(--color-text)] shadow-[var(--shadow-control-selected)]"
                : "text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-[var(--color-text)]"
            }`}
          >
            <Settings size={16} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
