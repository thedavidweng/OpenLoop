import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { isTauriRuntime } from "@/app/lib/api";

/**
 * Post a native notification, but only when the window is not focused —
 * generation runs for minutes and users switch away; a focused window
 * already shows the in-app toast, so notifying would be double noise.
 */
export async function notifyWhenUnfocused(title: string, body: string): Promise<void> {
  if (!isTauriRuntime() || document.hasFocus()) {
    return;
  }

  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({ title, body });
  }
}
