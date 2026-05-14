import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    check()
      .then((update) => {
        if (cancelled) return;
        if (update) {
          setUpdateAvailable(true);
          setVersion(update.version);
        }
      })
      .catch(() => {
        // Silently ignore updater errors (e.g. no network, dev mode)
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateAvailable) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">
          Update available{version ? ` (${version})` : ""}
        </span>
        <span className="opacity-90">Restart to apply the latest fixes.</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          disabled={installing}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {installing ? "Installing..." : "Restart Now"}
        </button>
        <button
          onClick={handleDismiss}
          className="px-2 py-1 text-white/70 hover:text-white text-xs transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
