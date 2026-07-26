import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ExternalLink, Download, X } from "lucide-react";
import { useGenerationStore } from "@/app/lib/store";

export function UpdateBanner() {
  const { t } = useTranslation();
  const checkForUpdates = useGenerationStore((state) => state.settings.checkForUpdates);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (checkForUpdates === false) return;
    let cancelled = false;
    check()
      .then((update) => {
        if (cancelled) return;
        if (update) {
          setUpdateAvailable(true);
          setVersion(update.version);
          setNotes(update.body ?? null);
          setShowModal(true);
        }
      })
      .catch(() => {
        // Silently ignore updater errors (e.g. no network, dev mode)
      });
    return () => {
      cancelled = true;
    };
  }, [checkForUpdates]);

  if (!updateAvailable) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (error) {
      console.warn("Update install failed:", error);
      setInstalling(false);
      setInstallError(
        t("update.installFailed", {
          defaultValue: "Update failed. Try downloading from the releases page.",
        }),
      );
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
  };

  const handleSkip = () => {
    setShowModal(false);
    setUpdateAvailable(false);
  };

  return (
    <>
      {/* Compact banner when modal dismissed but not skipped */}
      {!showModal && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2 text-sm text-[var(--color-text)]">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {t("update.available", {
                version: version ?? "",
                defaultValue: `Update available${version ? ` · ${version}` : ""}`,
              })}
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded px-3 py-1 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)]"
          >
            {t("update.view")}
          </button>
        </div>
      )}

      {/* Full modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--color-scrim)] p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-dialog)]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text)]">
                  {t("update.title", {
                    version: version ?? "",
                    defaultValue: `Update available · ${version ?? ""}`,
                  })}
                </h3>
                <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
                  {t("update.description", {
                    defaultValue:
                      "A new version of OpenLoop is available. Install now to get the latest features and fixes.",
                  })}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="motion-icon-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-[var(--color-text)]"
                aria-label={t("common.close")}
              >
                <X size={16} />
              </button>
            </div>

            {notes && (
              <div className="mb-4 max-h-40 overflow-auto rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] p-3 text-[12px] leading-relaxed text-[var(--color-text)]">
                <pre className="whitespace-pre-wrap font-sans">{notes}</pre>
              </div>
            )}

            {installError && (
              <p className="mb-3 text-[12px] text-[var(--color-destructive)]">{installError}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/thedavidweng/OpenLoop/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
              >
                <ExternalLink size={14} />
                {t("update.releaseNotes", { defaultValue: "Release notes" })}
              </a>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)] px-3.5 text-[12px] font-semibold text-[var(--color-on-accent)] shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={14} />
                {installing
                  ? t("update.installing", { defaultValue: "Installing…" })
                  : t("update.installOnRestart", {
                      defaultValue: "Install on restart",
                    })}
              </button>
              <button
                onClick={handleSkip}
                className="inline-flex h-9 items-center rounded-md border border-[var(--color-border-light)] bg-transparent px-3.5 text-[12px] text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
              >
                {t("update.skip", { defaultValue: "Skip" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
