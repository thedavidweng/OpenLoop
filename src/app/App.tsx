import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/app/components/layout/AppLayout";
import { useToast } from "@/app/components/overlay/Toast";
import { SetupScreen } from "@/app/components/settings/SetupScreen";
import * as api from "@/app/lib/api";
import { useGenerationStore } from "@/app/lib/store";
import { useAppMenuRuntime } from "@/app/runtime/menu-runtime";

function BootShell() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#121212] text-[12px] tracking-wide text-[rgba(255,255,255,0.55)]">
      OpenLoop
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const hydrateFromPersistence = useGenerationStore(
    (state) => state.hydrateFromPersistence,
  );
  const hydrated = useGenerationStore((state) => state.hydrated);
  const settings = useGenerationStore((state) => state.settings);
  const deviceInfo = useGenerationStore((state) => state.deviceInfo);
  const setupOverride = useGenerationStore((state) => state.setupOverride);
  const closeSetup = useGenerationStore((state) => state.closeSetup);
  const applyGenerationEvent = useGenerationStore(
    (state) => state.applyGenerationEvent,
  );
  const applyModelStatus = useGenerationStore((state) => state.applyModelStatus);

  useAppMenuRuntime(hydrated && api.isTauriRuntime());

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
        } else if (event.type === "failed") {
          addToast("error", t("toast.generationFailed"));
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
    return <BootShell />;
  }

  if (
    setupOverride ||
    (!api.isTauriRuntime() ? false : !settings.firstRunCompleted) ||
    deviceInfo?.isAppleSilicon === false
  ) {
    return (
      <SetupScreen
        onClose={settings.firstRunCompleted ? closeSetup : undefined}
      />
    );
  }

  return <AppLayout />;
}

export default App;
