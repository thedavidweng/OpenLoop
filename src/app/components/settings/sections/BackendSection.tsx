import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { DirectoryPickerRow } from "@/app/components/settings/SettingsOverlay/DirectoryPickerRow";
import { useGenerationStore } from "@/app/lib/store";
import * as api from "@/app/lib/api";
import { DEFAULT_APP_SETTINGS } from "@/app/lib/model-bootstrap";
import type { SettingsDraft, DirectorySettingKey } from "../hooks/useSettingsDraft";
import { Loader2 } from "lucide-react";

interface BackendSectionProps {
  draft: SettingsDraft;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
  defaultPaths: api.DefaultAppPaths | null;
  backendPortValid: boolean;
  onPickDirectory: (key: DirectorySettingKey) => void;
  onShowNotice: (msg: string | null) => void;
}

export function BackendSection({
  draft,
  setDraft,
  defaultPaths,
  backendPortValid,
  onPickDirectory,
  onShowNotice,
}: BackendSectionProps) {
  const { t } = useTranslation();
  const hydrateFromPersistence = useGenerationStore(
    (state) => state.hydrateFromPersistence,
  );
  const backendProvisionStatus = useGenerationStore(
    (state) => state.backendProvisionStatus,
  );
  const updateBackend = useGenerationStore((state) => state.updateBackend);
  const refreshBackendProvisionStatus = useGenerationStore(
    (state) => state.refreshBackendProvisionStatus,
  );

  return (
    <SettingsSectionCard
      id="settings-section-backend"
      title={t("settings.backend")}
      description={t("settings.backendDescription")}
      headerAction={
        <button
          type="button"
          onClick={() => {
            setDraft((current) => ({
              ...current,
              backendPort: String(DEFAULT_APP_SETTINGS.backendPort),
              logDirectory: "",
            }));
          }}
          className="text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-white"
        >
          {t("settings.resetToDefaults")}
        </button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
            {t("settings.backendPort")}
          </span>
          <input
            className="w-full rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--color-accent)]"
            type="number"
            min="1024"
            max="65535"
            value={draft.backendPort}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                backendPort: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <DirectoryPickerRow
        label={t("settings.logDirectory")}
        value={draft.logDirectory}
        defaultValue={defaultPaths?.logDirectory ?? ""}
        onPick={() => {
          void onPickDirectory("logDirectory");
        }}
        onReset={() =>
          setDraft((current) => ({ ...current, logDirectory: "" }))
        }
      />

      {!backendPortValid ? (
        <p className="text-[11px] text-amber-300">
          {t("settings.backendPortInvalid", {
            defaultValue: "Backend port must be between 1024 and 65535.",
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void api
              .restartBackend()
              .then(() => onShowNotice(t("settings.backendRestarted")));
          }}
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
        >
          {t("settings.restartBackend")}
        </button>
        <button
          type="button"
          onClick={() => {
            void api.getBackendLogsPath().then((path) => {
              if (path) {
                void api.revealInFinder(path);
              } else {
                onShowNotice(t("settings.noBackendLog"));
              }
            });
          }}
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
        >
          {t("settings.openBackendLog")}
        </button>
        <button
          type="button"
          onClick={() => {
            void api.setSetting("backendPort", 8001).then(async () => {
              await hydrateFromPersistence();
              onShowNotice(
                t("settings.backendPortReset", {
                  defaultValue: "Backend port reset to 8001.",
                }),
              );
            });
          }}
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
        >
          {t("settings.resetDefaultPort", {
            defaultValue: "Reset default port",
          })}
        </button>
        <button
          type="button"
          onClick={() => {
            void api.resetRuntimeSettings().then(async () => {
              await hydrateFromPersistence();
              onShowNotice(
                t("settings.runtimeSettingsRepaired", {
                  defaultValue: "Runtime configuration repaired.",
                }),
              );
            });
          }}
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/15 px-3 text-[11px] text-white transition-colors hover:bg-[var(--color-accent)]/25"
        >
          {t("settings.repairRuntime", {
            defaultValue: "Repair runtime config",
          })}
        </button>
      </div>

      {/* Backend engine version and update */}
      <div className="mt-2 space-y-3 border-t border-[var(--color-border-light)] pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
          {t("settings.backendEngine")}
        </p>
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-[var(--color-text)]">
              {backendProvisionStatus.installedTag ??
                backendProvisionStatus.installedCommit ??
                t("common.notInstalled", { defaultValue: "Not installed" })}
            </p>
            {backendProvisionStatus.updateAvailable ? (
              <p className="text-[11px] text-[var(--color-accent)]">
                {t("settings.updateAvailable", {
                  version: backendProvisionStatus.latestTag ?? "",
                })}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            {backendProvisionStatus.state === "downloading" ||
            backendProvisionStatus.state === "extracting" ? (
              <button
                type="button"
                disabled
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] opacity-60"
              >
                <Loader2 size={12} className="animate-spin" />
                {t("settings.provisioningBackend")}
              </button>
            ) : backendProvisionStatus.updateAvailable ? (
              <button
                type="button"
                onClick={() => void updateBackend()}
                className="inline-flex h-8 items-center rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/15 px-3 text-[11px] text-white transition-colors hover:bg-[var(--color-accent)]/25"
              >
                {t("settings.updateBackend")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void refreshBackendProvisionStatus()}
                className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
              >
                {t("settings.checkForBackendUpdates")}
              </button>
            )}
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
