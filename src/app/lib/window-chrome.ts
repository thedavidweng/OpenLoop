export type WindowChromeVariant = "mac" | "desktop";

export function getWindowChromeVariant(): WindowChromeVariant {
  if (typeof navigator === "undefined") {
    return "mac";
  }

  return /mac/i.test(navigator.platform) ? "mac" : "desktop";
}
