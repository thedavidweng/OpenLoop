import { afterEach, describe, expect, it } from "vitest";

const { getWindowChromeVariant } = await import("@/app/lib/window-chrome");

describe("getWindowChromeVariant", () => {
  const originalPlatform = navigator.platform;

  afterEach(() => {
    Object.defineProperty(navigator, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('returns "mac" when platform contains "Mac"', () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });
    expect(getWindowChromeVariant()).toBe("mac");
  });

  it('returns "mac" for lowercase "mac" in platform', () => {
    Object.defineProperty(navigator, "platform", {
      value: "macOS",
      configurable: true,
    });
    expect(getWindowChromeVariant()).toBe("mac");
  });

  it('returns "desktop" for Windows platform', () => {
    Object.defineProperty(navigator, "platform", {
      value: "Win32",
      configurable: true,
    });
    expect(getWindowChromeVariant()).toBe("desktop");
  });

  it('returns "desktop" for Linux platform', () => {
    Object.defineProperty(navigator, "platform", {
      value: "Linux x86_64",
      configurable: true,
    });
    expect(getWindowChromeVariant()).toBe("desktop");
  });
});
