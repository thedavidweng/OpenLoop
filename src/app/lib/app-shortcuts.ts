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
} satisfies Record<string, ShortcutDefinition>;

export function getShortcutPlatform(): ShortcutPlatform {
  const platform =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { userAgentData?: { platform?: string } })
          .userAgentData?.platform || navigator.platform
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
