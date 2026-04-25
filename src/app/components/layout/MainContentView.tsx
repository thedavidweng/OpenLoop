import { ModelBootstrapBanner } from "@/app/components/bootstrap/ModelBootstrapBanner";
import { OpenLoopStage } from "@/app/components/layout/OpenLoopStage";
import { PlaybackBar } from "@/app/components/player/PlaybackBar";
import { SettingsOverlay } from "@/app/components/settings/SettingsOverlay";
import { useGenerationStore } from "@/app/lib/store";

export function MainContentView() {
  const settingsOpen = useGenerationStore((state) => state.isSettingsOpen);

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col ${
        settingsOpen ? "bg-[var(--color-surface-muted)]" : "bg-[var(--color-surface)]"
      }`}
      data-main-content-visual-variant="unified"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ModelBootstrapBanner />
          <OpenLoopStage />
        </div>
        {settingsOpen ? <SettingsOverlay /> : null}
      </div>
      <PlaybackBar />
    </div>
  );
}
