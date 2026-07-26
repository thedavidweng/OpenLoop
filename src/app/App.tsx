import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/app/components/layout/AppLayout";
import { AppShellSkeleton } from "@/app/components/layout/AppShellSkeleton";
import { UpdateBanner } from "@/app/components/bootstrap/UpdateBanner";
import { useToast } from "@/app/components/overlay/Toast";
import { SetupScreen } from "@/app/components/settings/SetupScreen";
import * as api from "@/app/lib/api";
import { notifyWhenUnfocused } from "@/app/lib/notifications";
import { useGenerationStore } from "@/app/lib/store";
import { useAppMenuRuntime } from "@/app/runtime/menu-runtime";
import { useAppReadyRuntime } from "@/app/runtime/app-ready-runtime";

function useHighContrast() {
  const highContrast = useGenerationStore((s) => s.highContrast);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-high-contrast", highContrast);
  }, [highContrast]);
}

function App() {
  useHighContrast();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const hydrateFromPersistence = useGenerationStore((state) => state.hydrateFromPersistence);
  const hydrated = useGenerationStore((state) => state.hydrated);
  const settings = useGenerationStore((state) => state.settings);
  const deviceInfo = useGenerationStore((state) => state.deviceInfo);
  const setupOverride = useGenerationStore((state) => state.setupOverride);
  const closeSetup = useGenerationStore((state) => state.closeSetup);
  const applyGenerationEvent = useGenerationStore((state) => state.applyGenerationEvent);
  const applyModelStatus = useGenerationStore((state) => state.applyModelStatus);

  useAppMenuRuntime(hydrated && api.isTauriRuntime());
  useAppReadyRuntime(hydrated);

  useEffect(() => {
    void hydrateFromPersistence();
  }, [hydrateFromPersistence]);

  useEffect(() => {
    if (!api.isTauriRuntime()) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    void api
      .listenToGenerationEvents((event) => {
        applyGenerationEvent(event);
        if (event.type === "completed") {
          addToast("success", t("toast.generationCompleted"));
          void notifyWhenUnfocused(
            t("notifications.generationCompletedTitle"),
            t("notifications.generationCompletedBody"),
          ).catch(() => {});
        } else if (event.type === "failed") {
          addToast("error", t("toast.generationFailed"));
          void notifyWhenUnfocused(
            t("notifications.generationFailedTitle"),
            t("notifications.generationFailedBody"),
          ).catch(() => {});
        }
      })
      .then((unlisten) => {
        unsubscribe = unlisten;
      });

    return () => {
      unsubscribe?.();
    };
  }, [addToast, applyGenerationEvent, t]);

  useEffect(() => {
    if (!api.isTauriRuntime()) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    void api
      .listenToModelDownloadEvents((event) => {
        applyModelStatus(event);
      })
      .then((unlisten) => {
        unsubscribe = unlisten;
      });

    return () => {
      unsubscribe?.();
    };
  }, [applyModelStatus]);

  if (!hydrated) {
    return <AppShellSkeleton />;
  }

  if (
    setupOverride ||
    (!api.isTauriRuntime() ? false : !settings.firstRunCompleted) ||
    deviceInfo?.isAppleSilicon === false
  ) {
    return <SetupScreen onClose={settings.firstRunCompleted ? closeSetup : undefined} />;
  }

  return (
    <>
      <UpdateBanner />
      <AppLayout />
    </>
  );
}

export default App;
