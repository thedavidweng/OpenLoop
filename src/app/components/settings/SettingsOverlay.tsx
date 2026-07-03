import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useToast } from "@/app/components/overlay/Toast";
import { useGenerationStore } from "@/app/lib/store";
import * as api from "@/app/lib/api";
import { useSettingsDraft } from "./hooks/useSettingsDraft";
import { ModelsSection } from "./sections/ModelsSection";
import { CliPathSection } from "./sections/CliPathSection";
import { DefaultsSection } from "./sections/DefaultsSection";
import { GeneralSection } from "./sections/GeneralSection";
import { BackendSection } from "./sections/BackendSection";
import { DangerZoneSection } from "./sections/DangerZoneSection";
import { NetworkActivitySection } from "./sections/NetworkActivitySection";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { SettingsDialogs } from "./SettingsDialogs";

export function SettingsOverlay() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const settings = useGenerationStore((s) => s.settings);
  const modelStatuses = useGenerationStore((s) => s.modelStatuses);
  const closeSettings = useGenerationStore((s) => s.closeSettings);
  const refreshModelStatuses = useGenerationStore((s) => s.refreshModelStatuses);
  const hydrateFromPersistence = useGenerationStore((s) => s.hydrateFromPersistence);
  const history = useGenerationStore((s) => s.history);
  const clearGenerationHistory = useGenerationStore((s) => s.clearGenerationHistory);
  const deleteAllModels = useGenerationStore((s) => s.deleteAllModels);

  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearCacheOpen, setClearCacheOpen] = useState(false);
  const [deleteModelsOpen, setDeleteModelsOpen] = useState(false);
  const [defaultPaths, setDefaultPaths] = useState<api.DefaultAppPaths | null>(null);

  useEffect(() => {
    if (!api.isTauriRuntime()) {
      setDefaultPaths({
        outputDirectory: "~/Music/OpenLoop",
        modelDirectory: "~/Library/Application Support/OpenLoop/models/checkpoints",
        logDirectory: "~/Library/Application Support/OpenLoop/logs/backend",
      });
      return;
    }
    void api.getDefaultAppPaths().then(setDefaultPaths);
  }, []);

  useEffect(() => {
    void refreshModelStatuses();
  }, [refreshModelStatuses]);

  const {
    draft,
    setDraft,
    hasUnsavedChanges,
    backendPortValid,
    modelDirectoryLocked,
    showModelDirRestartHint,
    configDir,
    pickDirectory,
    discardChanges,
    saveChanges,
  } = useSettingsDraft(settings, modelStatuses, defaultPaths);

  const handleSave = async () => {
    if (!(await saveChanges())) {
      setSaveNotice(
        t("settings.backendPortInvalid", {
          defaultValue: "Backend port must be between 1024 and 65535.",
        }),
      );
      return;
    }
    await hydrateFromPersistence();
    setSaveNotice(t("settings.saved"));
    addToast("success", t("toast.settingsSaved"));
  };

  const handleDiscard = () => {
    discardChanges();
    setSaveNotice(null);
  };

  const sectionNav = [
    { id: "models", label: t("settings.models") },
    { id: "defaults", label: t("settings.defaults") },
    { id: "general", label: t("settings.general") },
    { id: "backend", label: t("settings.backend") },
    { id: "network", label: t("settings.networkActivity", { defaultValue: "Network" }) },
    { id: "danger", label: t("settings.danger") },
  ] as const;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-1 flex-col overflow-y-auto bg-[var(--color-surface-muted)]/98 p-6 backdrop-blur-sm md:p-10">
      <div className="pointer-events-auto mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white">{t("settings.title")}</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-dim)]">
              {t("settings.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="motion-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-dim)] hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
            aria-label={t("setup.close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Section navigation */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--color-border-light)] pb-3">
          {sectionNav.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                document
                  .getElementById(`settings-section-${s.id}`)
                  ?.scrollIntoView({ block: "start" })
              }
              className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Section cards */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            <ModelsSection />
            <CliPathSection />
            <DefaultsSection
              draft={draft}
              setDraft={setDraft}
              defaultPaths={defaultPaths}
              modelDirectoryLocked={modelDirectoryLocked}
              showModelDirRestartHint={showModelDirRestartHint}
              onPickDirectory={pickDirectory}
            />
          </div>
          <div className="space-y-6">
            <GeneralSection
              draftCheckForUpdates={draft.checkForUpdates}
              onDraftChange={(p) => setDraft((c) => ({ ...c, ...p }))}
              configDir={configDir}
              saveNotice={saveNotice}
            />
            <BackendSection
              draft={draft}
              setDraft={setDraft}
              defaultPaths={defaultPaths}
              backendPortValid={backendPortValid}
              onPickDirectory={pickDirectory}
              onShowNotice={setSaveNotice}
            />
            <NetworkActivitySection />
            <DangerZoneSection
              historyCount={history.length}
              downloadedModelsCount={settings.downloadedModels.length}
              onClearHistory={() => setClearHistoryOpen(true)}
              onClearCache={() => setClearCacheOpen(true)}
              onDeleteAllModels={() => setDeleteModelsOpen(true)}
            />
          </div>
        </div>

        {/* Save bar */}
        <SettingsSaveBar
          hasUnsavedChanges={hasUnsavedChanges}
          saveNotice={saveNotice}
          backendPortValid={backendPortValid}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />

        {/* Confirmation dialogs */}
        <SettingsDialogs
          clearHistoryOpen={clearHistoryOpen}
          clearCacheOpen={clearCacheOpen}
          deleteAllModelsOpen={deleteModelsOpen}
          historyCount={history.length}
          downloadedModelsCount={settings.downloadedModels.length}
          onDismissClearHistory={() => setClearHistoryOpen(false)}
          onDismissClearCache={() => setClearCacheOpen(false)}
          onDismissDeleteAllModels={() => setDeleteModelsOpen(false)}
          onConfirmClearHistory={() => {
            setClearHistoryOpen(false);
            void clearGenerationHistory().then(() => setSaveNotice(t("settings.historyCleared")));
          }}
          onConfirmClearCache={() => {
            setClearCacheOpen(false);
            void api
              .clearBackendCache()
              .then(() => setSaveNotice(t("settings.backendCacheCleared")));
          }}
          onConfirmDeleteAllModels={() => {
            setDeleteModelsOpen(false);
            void deleteAllModels().then(() => setSaveNotice(t("settings.modelsDeleted")));
          }}
        />
      </div>
    </div>
  );
}
