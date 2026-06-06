import React, { Suspense } from "react";
import { DemoBanner } from "@/app/components/bootstrap/DemoBanner";
import { ModelBootstrapBanner } from "@/app/components/bootstrap/ModelBootstrapBanner";
import { OpenLoopStage } from "@/app/components/layout/OpenLoopStage";
import { PlaybackBar } from "@/app/components/player/PlaybackBar";
import { useGenerationStore } from "@/app/lib/store";

const SettingsOverlay = React.lazy(() =>
  import("@/app/components/settings/SettingsOverlay").then((m) => ({
    default: m.SettingsOverlay,
  })),
);

export function MainContentView() {
  const settingsOpen = useGenerationStore((state) => state.isSettingsOpen);
  const demoMode = useGenerationStore((state) => state.demoMode);

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col ${
        settingsOpen ? "bg-[var(--color-surface-muted)]" : "bg-[var(--color-surface)]"
      }`}
      data-main-content-visual-variant="unified"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {demoMode ? <DemoBanner /> : <ModelBootstrapBanner />}
          <OpenLoopStage />
        </div>
        {settingsOpen ? (
          <Suspense fallback={null}>
            <SettingsOverlay />
          </Suspense>
        ) : null}
      </div>
      <PlaybackBar />
    </div>
  );
}
