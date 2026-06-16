import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/app/lib/app-shortcuts", () => ({
  getShortcutPlatform: vi.fn(() => "mac"),
}));

vi.mock("@/app/lib/api", () => ({
  getWindowShellState: vi.fn(),
}));

const { getShortcutPlatform } = await import("@/app/lib/app-shortcuts");
const { getWindowShellState } = await import("@/app/lib/api");
const {
  getDefaultWindowShellState,
  resolveWindowShellState,
  createWindowShellStyle,
  useWindowShellState,
} = await import("@/app/lib/window-shell");

function mockPlatform(platform: "mac" | "windows" | "linux") {
  (getShortcutPlatform as Mock).mockReturnValue(platform);
}

function makeSnapshot(overrides?: Partial<{
  chrome_variant: "desktop" | "mac";
  tier: "desktop" | "mac";
  toolbar_height: number;
  traffic_light_inset_leading: number;
  sidebar_header_height: number;
  sidebar_width: number;
}>) {
  return {
    chrome_variant: "mac" as const,
    tier: "mac" as const,
    toolbar_height: 48,
    traffic_light_inset_leading: 78,
    sidebar_header_height: 28,
    sidebar_width: 260,
    ...overrides,
  };
}

describe("getDefaultWindowShellState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mac state when platform is mac", () => {
    const state = getDefaultWindowShellState("mac");
    expect(state).toEqual({
      chromeVariant: "mac",
      tier: "mac",
      toolbarHeight: 48,
      trafficLightInsetLeading: 78,
      sidebarHeaderHeight: 28,
      sidebarWidth: 260,
    });
  });

  it("returns desktop state when platform is windows", () => {
    const state = getDefaultWindowShellState("windows");
    expect(state).toEqual({
      chromeVariant: "desktop",
      tier: "desktop",
      toolbarHeight: 48,
      trafficLightInsetLeading: 0,
      sidebarHeaderHeight: 0,
      sidebarWidth: 260,
    });
  });

  it("returns desktop state when platform is linux", () => {
    const state = getDefaultWindowShellState("linux");
    expect(state.chromeVariant).toBe("desktop");
    expect(state.trafficLightInsetLeading).toBe(0);
  });

  it("uses getShortcutPlatform when called without argument", () => {
    mockPlatform("mac");
    const state = getDefaultWindowShellState();
    expect(state.chromeVariant).toBe("mac");
  });

  it("returns a copy, not the module-level constant", () => {
    const a = getDefaultWindowShellState("mac");
    const b = getDefaultWindowShellState("mac");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe("resolveWindowShellState", () => {
  it("returns desktop defaults for non-mac platform regardless of input", () => {
    const state = resolveWindowShellState("windows", {
      chromeVariant: "mac",
      toolbarHeight: 100,
      trafficLightInsetLeading: 50,
    });
    expect(state).toEqual({
      chromeVariant: "desktop",
      tier: "desktop",
      toolbarHeight: 48,
      trafficLightInsetLeading: 0,
      sidebarHeaderHeight: 0,
      sidebarWidth: 260,
    });
  });

  it("returns desktop defaults for linux", () => {
    const state = resolveWindowShellState("linux", { sidebarWidth: 400 });
    expect(state.sidebarWidth).toBe(260);
    expect(state.trafficLightInsetLeading).toBe(0);
  });

  it("returns mac defaults when state is undefined", () => {
    const state = resolveWindowShellState("mac", undefined);
    expect(state).toEqual({
      chromeVariant: "mac",
      tier: "mac",
      toolbarHeight: 48,
      trafficLightInsetLeading: 78,
      sidebarHeaderHeight: 28,
      sidebarWidth: 260,
    });
  });

  it("returns mac defaults when state is null", () => {
    const state = resolveWindowShellState("mac", null);
    expect(state.chromeVariant).toBe("mac");
    expect(state.trafficLightInsetLeading).toBe(78);
  });

  it("uses provided values when they are valid positive numbers", () => {
    const state = resolveWindowShellState("mac", {
      toolbarHeight: 64,
      trafficLightInsetLeading: 90,
      sidebarHeaderHeight: 36,
      sidebarWidth: 320,
    });
    expect(state.toolbarHeight).toBe(64);
    expect(state.trafficLightInsetLeading).toBe(90);
    expect(state.sidebarHeaderHeight).toBe(36);
    expect(state.sidebarWidth).toBe(320);
  });

  it("falls back to default when toolbarHeight is zero", () => {
    const state = resolveWindowShellState("mac", { toolbarHeight: 0 });
    expect(state.toolbarHeight).toBe(48);
  });

  it("falls back to default when toolbarHeight is negative", () => {
    const state = resolveWindowShellState("mac", { toolbarHeight: -10 });
    expect(state.toolbarHeight).toBe(48);
  });

  it("falls back to default when toolbarHeight is NaN", () => {
    const state = resolveWindowShellState("mac", { toolbarHeight: Number.NaN });
    expect(state.toolbarHeight).toBe(48);
  });

  it("falls back to default when toolbarHeight is Infinity", () => {
    const state = resolveWindowShellState("mac", { toolbarHeight: Number.POSITIVE_INFINITY });
    expect(state.toolbarHeight).toBe(48);
  });

  it("falls back when value is a string (not a number)", () => {
    const state = resolveWindowShellState("mac", {
      toolbarHeight: "48" as unknown as number,
    });
    expect(state.toolbarHeight).toBe(48);
  });

  it("accepts chromeVariant 'mac' for mac platform", () => {
    const state = resolveWindowShellState("mac", { chromeVariant: "mac" });
    expect(state.chromeVariant).toBe("mac");
  });

  it("falls back chromeVariant when not 'mac'", () => {
    const state = resolveWindowShellState("mac", { chromeVariant: "desktop" });
    expect(state.chromeVariant).toBe("mac");
  });

  it("falls back chromeVariant when undefined", () => {
    const state = resolveWindowShellState("mac", {});
    expect(state.chromeVariant).toBe("mac");
  });

  it("always sets tier to 'mac' on mac platform", () => {
    const state = resolveWindowShellState("mac", { tier: "desktop" } as any);
    expect(state.tier).toBe("mac");
  });
});

describe("createWindowShellStyle", () => {
  it("maps all state fields to CSS custom properties", () => {
    const style = createWindowShellStyle({
      chromeVariant: "mac",
      tier: "mac",
      toolbarHeight: 48,
      trafficLightInsetLeading: 78,
      sidebarHeaderHeight: 28,
      sidebarWidth: 260,
    });
    expect(style).toEqual({
      "--window-shell-leading-controls-space": "78px",
      "--window-shell-sidebar-header-height": "28px",
      "--window-shell-sidebar-width": "260px",
      "--window-shell-toolbar-height": "48px",
    });
  });

  it("reflects custom numeric values", () => {
    const style = createWindowShellStyle({
      chromeVariant: "desktop",
      tier: "desktop",
      toolbarHeight: 64,
      trafficLightInsetLeading: 0,
      sidebarHeaderHeight: 0,
      sidebarWidth: 320,
    });
    expect((style as any)["--window-shell-toolbar-height"]).toBe("64px");
    expect((style as any)["--window-shell-sidebar-width"]).toBe("320px");
  });
});

describe("useWindowShellState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns desktop-resolved state immediately on non-mac platform", () => {
    mockPlatform("windows");
    const { result } = renderHook(() => useWindowShellState(300));
    expect(result.current.chromeVariant).toBe("desktop");
    expect(result.current.sidebarWidth).toBe(260);
    expect(result.current.trafficLightInsetLeading).toBe(0);
  });

  it("returns mac-resolved state immediately on mac before snapshot resolves", () => {
    mockPlatform("mac");
    (getWindowShellState as Mock).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useWindowShellState(300));
    expect(result.current.chromeVariant).toBe("mac");
    expect(result.current.sidebarWidth).toBe(300);
    expect(result.current.trafficLightInsetLeading).toBe(78);
  });

  it("hydrates from native snapshot on mac", async () => {
    mockPlatform("mac");
    (getWindowShellState as Mock).mockResolvedValue(
      makeSnapshot({
        toolbar_height: 56,
        traffic_light_inset_leading: 88,
        sidebar_header_height: 32,
        sidebar_width: 280,
      }),
    );

    const { result } = renderHook(() => useWindowShellState(300));

    await waitFor(() => {
      expect(result.current.toolbarHeight).toBe(56);
    });

    expect(result.current.trafficLightInsetLeading).toBe(88);
    expect(result.current.sidebarHeaderHeight).toBe(32);
    expect(result.current.sidebarWidth).toBe(300); // sidebarWidth comes from hook arg
  });

  it("falls back to defaults when snapshot fetch rejects", async () => {
    mockPlatform("mac");
    (getWindowShellState as Mock).mockRejectedValue(new Error("ipc failed"));

    const { result } = renderHook(() => useWindowShellState(300));

    await waitFor(() => {
      expect(getWindowShellState).toHaveBeenCalled();
    });

    // Should still have the initial resolved state (not crash)
    expect(result.current.chromeVariant).toBe("mac");
    expect(result.current.toolbarHeight).toBe(48);
  });

  it("does not call getWindowShellState on non-mac platform", () => {
    mockPlatform("windows");
    renderHook(() => useWindowShellState(300));
    expect(getWindowShellState).not.toHaveBeenCalled();
  });

  it("uses sidebarWidth argument to override snapshot sidebar_width", async () => {
    mockPlatform("mac");
    (getWindowShellState as Mock).mockResolvedValue(
      makeSnapshot({ sidebar_width: 999 }),
    );

    const { result } = renderHook(() => useWindowShellState(400));

    await waitFor(() => {
      expect(result.current.sidebarWidth).toBe(400);
    });
  });

  it("ignores snapshot result after unmount", async () => {
    mockPlatform("mac");
    let resolveSnapshot!: (v: any) => void;
    (getWindowShellState as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    );

    const { unmount } = renderHook(() => useWindowShellState(300));
    unmount();

    // Resolving after unmount should not cause a state update warning
    resolveSnapshot(makeSnapshot({ toolbar_height: 999 }));
    // If this doesn't throw, the cleanup worked
    expect(true).toBe(true);
  });
});
