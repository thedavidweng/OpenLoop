export type ShortcutPlatform = "mac" | "windows" | "linux";

export interface ShortcutDefinition {
  id: string;
  code?: string;
  key?: string;
  displayKey: string;
  acceptedCodes?: string[];
  acceptedKeys?: string[];
  allowShift?: boolean;
  requiresPrimaryModifier?: boolean;
}

export const APP_SHORTCUTS = {
  toggleSidebar: {
    id: "sidebar.toggle",
    code: "KeyB",
    key: "b",
    displayKey: "B",
  },
  newGeneration: {
    id: "generation.new",
    code: "KeyN",
    key: "n",
    displayKey: "N",
  },
  toggleSettings: {
    id: "settings.toggle",
    code: "Comma",
    key: ",",
    displayKey: ",",
  },
  submitGeneration: {
    id: "generation.submit",
    code: "Enter",
    key: "Enter",
    displayKey: "Enter",
  },
  retryGeneration: {
    id: "generation.retry",
    code: "KeyR",
    key: "r",
    displayKey: "R",
    allowShift: true,
  },
  togglePlayback: {
    id: "player.toggle",
    code: "Space",
    key: " ",
    displayKey: "Space",
    requiresPrimaryModifier: false,
  },
  compareToggle: {
    id: "compare.toggle",
    code: "Digit1",
    key: "1",
    displayKey: "1",
    requiresPrimaryModifier: false,
  },
  keyboardHelp: {
    id: "help.shortcuts",
    code: "Slash",
    key: "/",
    displayKey: "/",
  },
} satisfies Record<string, ShortcutDefinition>;

export function getShortcutPlatform(): ShortcutPlatform {
  const platform =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
          ?.platform || navigator.platform
      : "";

  if (/mac|darwin/i.test(platform)) return "mac";
  if (/win/i.test(platform)) return "windows";
  return "linux";
}

export function getShortcutDisplay(
  shortcut: ShortcutDefinition,
  platform: ShortcutPlatform = getShortcutPlatform(),
): string {
  if (shortcut.requiresPrimaryModifier === false) {
    return shortcut.displayKey;
  }

  const modifier = platform === "mac" ? "⌘" : "Ctrl+";
  return `${modifier}${shortcut.displayKey}`;
}

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const platform = getShortcutPlatform();
  const modifierKey = platform === "mac" ? event.metaKey : event.ctrlKey;

  // Space key doesn't require modifier
  if (shortcut.requiresPrimaryModifier === false) {
    if (shortcut.code && event.code === shortcut.code) return true;
    if (shortcut.key && event.key === shortcut.key) return true;
    return false;
  }

  if (!modifierKey) return false;

  // Handle shift for Cmd+Shift+R
  if (shortcut.allowShift && event.shiftKey) {
    if (shortcut.code && event.code === shortcut.code) return true;
    if (shortcut.key && event.key === shortcut.key) return true;
  }

  // Normal modifier + key
  if (!event.shiftKey) {
    if (shortcut.code && event.code === shortcut.code) return true;
    if (shortcut.key && event.key === shortcut.key) return true;
  }

  return false;
}

export function shouldHandleGlobalShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition,
): boolean {
  if (isInputFocused()) {
    return false;
  }

  return matchesShortcut(event, shortcut);
}
