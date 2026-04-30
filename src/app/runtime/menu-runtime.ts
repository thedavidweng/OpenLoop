import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import * as api from "@/app/lib/api";
import { useGenerationStore } from "@/app/lib/store";

export const APP_MENU_ACTION_EVENT = "openloop://menu-action";

export type AppMenuAction =
  | "open-settings"
  | "open-setup"
  | "toggle-sidebar"
  | "reveal-output-folder"
  | "new-generation";

export function useAppMenuRuntime(enabled: boolean) {
  const openSettings = useGenerationStore((state) => state.openSettings);
  const reopenSetup = useGenerationStore((state) => state.reopenSetup);
  const toggleSidebar = useGenerationStore((state) => state.toggleSidebar);
  const resetForm = useGenerationStore((state) => state.resetForm);
  const outputDirectory = useGenerationStore(
    (state) => state.settings.outputDirectory,
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen<AppMenuAction>(APP_MENU_ACTION_EVENT, (event) => {
      switch (event.payload) {
        case "open-settings":
          openSettings();
          break;
        case "open-setup":
          reopenSetup();
          break;
        case "toggle-sidebar":
          toggleSidebar();
          break;
        case "reveal-output-folder":
          if (outputDirectory) {
            void api.revealInFinder(outputDirectory);
          }
          break;
        case "new-generation":
          resetForm();
          break;
      }
    }).then((dispose) => {
      if (cancelled) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [
    enabled,
    openSettings,
    outputDirectory,
    reopenSetup,
    resetForm,
    toggleSidebar,
  ]);
}
