import { X, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGenerationStore } from "@/app/lib/store";

export function DemoBanner() {
  const { t } = useTranslation();
  const demoMode = useGenerationStore((state) => state.demoMode);
  const settings = useGenerationStore((state) => state.settings);
  const dismissDemoMode = useGenerationStore((state) => state.dismissDemoMode);
  const openSettings = useGenerationStore((state) => state.openSettings);

  if (!demoMode || settings.modelVariant !== null) {
    return null;
  }

  return (
    <div
      className="animate-expand shrink-0 border-b border-amber-500/30 bg-amber-500/10"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Download size={14} className="shrink-0 text-amber-300" />
          <p className="min-w-0 truncate text-[12px] leading-5 text-amber-100">
            {t("demo.banner", {
              defaultValue: "Demo mode — download a model to generate your own music",
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={openSettings}
          className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition-colors hover:bg-amber-500/20"
        >
          {t("model.chooseModel")}
        </button>

        <button
          type="button"
          onClick={dismissDemoMode}
          className="shrink-0 rounded-md p-1 text-amber-300/60 transition-colors hover:text-amber-100"
          aria-label={t("common.dismiss", { defaultValue: "Dismiss" })}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
