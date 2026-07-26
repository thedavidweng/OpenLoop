import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom lacks setPointerCapture — stub it for drag tests
vi.hoisted(() => {
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockRevealInFinder = vi.fn<(path: string) => Promise<void>>();
const mockOpenExternalUrl = vi.fn<(url: string) => Promise<void>>();

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => true,
  revealInFinder: (path: string) => mockRevealInFinder(path),
  openExternalUrl: (url: string) => mockOpenExternalUrl(url),
  getWindowShellState: () =>
    Promise.resolve({
      chrome_variant: "mac",
      tier: "mac",
      toolbar_height: 48,
      traffic_light_inset_leading: 78,
      sidebar_header_height: 28,
      sidebar_width: 260,
    }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/components/overlay/Tooltip", () => ({
  Tooltip: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <span data-tooltip-label={label}>{children}</span>
  ),
}));

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/app/components/history/HistorySidebar", () => ({
  HistorySidebar: () => <div data-testid="history-sidebar" />,
}));

vi.mock("@/app/components/player/PlaybackBar", () => ({
  PlaybackBar: () => <div data-testid="playback-bar" />,
}));

vi.mock("@/app/components/bootstrap/DemoBanner", () => ({
  DemoBanner: () => <div data-testid="demo-banner" />,
}));

vi.mock("@/app/components/bootstrap/ModelBootstrapBanner", () => ({
  ModelBootstrapBanner: () => <div data-testid="model-bootstrap-banner" />,
}));

vi.mock("@/app/components/settings/SettingsOverlay", () => ({
  SettingsOverlay: () => <div data-testid="settings-overlay" />,
}));

vi.mock("@/app/components/generation/GenerationPanel", () => ({
  GenerationPanel: () => <div data-testid="generation-panel" />,
}));

// ---------------------------------------------------------------------------
// Store mock
// ---------------------------------------------------------------------------

const mockToggleSidebar = vi.fn();
const mockToggleSettings = vi.fn();
const mockResetForm = vi.fn();
const mockRunGeneration = vi.fn(() => Promise.resolve());
const mockRequestPlaybackToggle = vi.fn();
const mockToggleCompareTarget = vi.fn();
const mockSetSidebarWidth = vi.fn();
const mockReopenSetup = vi.fn();

interface StoreState {
  sidebarVisible: boolean;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  toggleSidebar: () => void;
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  resetForm: () => void;
  runGeneration: () => Promise<void>;
  requestPlaybackToggle: () => void;
  generationState: {
    status: string;
    phase: string;
    statusMessage: string;
    error: { code: string; message: string; details?: string } | null;
  };
  compareModeActive: boolean;
  toggleCompareTarget: () => void;
  demoMode: boolean;
  settings: { outputDirectory: string };
  reopenSetup: () => void;
}

let currentStoreState: StoreState;

function makeStoreOverrides(overrides: Partial<StoreState> = {}): StoreState {
  return {
    sidebarVisible: true,
    sidebarWidth: 260,
    setSidebarWidth: mockSetSidebarWidth,
    toggleSidebar: mockToggleSidebar,
    isSettingsOpen: false,
    toggleSettings: mockToggleSettings,
    resetForm: mockResetForm,
    runGeneration: mockRunGeneration,
    requestPlaybackToggle: mockRequestPlaybackToggle,
    generationState: {
      status: "idle",
      phase: "idle",
      statusMessage: "Ready",
      error: null,
    },
    compareModeActive: false,
    toggleCompareTarget: mockToggleCompareTarget,
    demoMode: false,
    settings: { outputDirectory: "/tmp/output" },
    reopenSetup: mockReopenSetup,
    ...overrides,
  };
}

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: StoreState) => unknown) => selector(currentStoreState),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

const { WindowChrome } = await import("@/app/components/layout/WindowChrome");
const { Toolbar } = await import("@/app/components/layout/Toolbar");
const { SidebarRail } = await import("@/app/components/layout/SidebarRail");
const { MainContentView } = await import("@/app/components/layout/MainContentView");
const { OpenLoopStage } = await import("@/app/components/layout/OpenLoopStage");
const { AppLayout } = await import("@/app/components/layout/AppLayout");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const macShellState = {
  chromeVariant: "mac" as const,
  tier: "mac" as const,
  toolbarHeight: 48,
  trafficLightInsetLeading: 78,
  sidebarHeaderHeight: 28,
  sidebarWidth: 260,
};

// ===========================================================================
// WindowChrome
// ===========================================================================

describe("WindowChrome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = makeStoreOverrides();
  });

  it("renders a toolbar element", () => {
    const { container } = render(
      <WindowChrome
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    // WindowChrome delegates to Toolbar which renders a div
    expect(container.querySelector("[data-window-shell-tier]")).toBeTruthy();
  });

  it("forwards props to Toolbar", () => {
    const onToggleSidebar = vi.fn();
    const onToggleSettings = vi.fn();
    render(
      <WindowChrome
        onToggleSidebar={onToggleSidebar}
        onToggleSettings={onToggleSettings}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    // Sidebar toggle button should be present
    expect(screen.getByLabelText("toolbar.toggleSidebar")).toBeTruthy();
    // Settings button should be present
    expect(screen.getByLabelText("toolbar.settings")).toBeTruthy();
  });
});

// ===========================================================================
// Toolbar
// ===========================================================================

describe("Toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = makeStoreOverrides();
    mockRevealInFinder.mockResolvedValue(undefined);
    mockOpenExternalUrl.mockResolvedValue(undefined);
  });

  it("renders sidebar toggle, new generation, reveal output, open setup, and settings buttons", () => {
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    expect(screen.getByLabelText("toolbar.toggleSidebar")).toBeTruthy();
    expect(screen.getByLabelText("toolbar.revealOutput")).toBeTruthy();
    expect(screen.getByLabelText("toolbar.openSetup")).toBeTruthy();
    expect(screen.getByLabelText("toolbar.settings")).toBeTruthy();
    expect(screen.getByText("toolbar.newGeneration")).toBeTruthy();
  });

  it("applies active style to sidebar toggle when sidebar is visible", () => {
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    const sidebarBtn = screen.getByLabelText("toolbar.toggleSidebar");
    expect(sidebarBtn.className).toContain("bg-[var(--color-control-selected-bg)]");
    expect(sidebarBtn.className).toContain("text-[var(--color-text)]");
  });

  it("applies inactive style to sidebar toggle when sidebar is hidden", () => {
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible={false}
      />,
    );
    const sidebarBtn = screen.getByLabelText("toolbar.toggleSidebar");
    expect(sidebarBtn.className).toContain("text-[var(--color-text-dim)]");
  });

  it("applies active style to settings button when settings are open", () => {
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen
        sidebarVisible
      />,
    );
    const settingsBtn = screen.getByLabelText("toolbar.settings");
    expect(settingsBtn.className).toContain("bg-[var(--color-control-selected-bg)]");
    expect(settingsBtn.className).toContain("text-[var(--color-text)]");
  });

  it("applies inactive style to settings button when settings are closed", () => {
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    const settingsBtn = screen.getByLabelText("toolbar.settings");
    expect(settingsBtn.className).toContain("text-[var(--color-text-dim)]");
  });

  it("calls onToggleSidebar when sidebar button is clicked", async () => {
    const user = userEvent.setup();
    const onToggleSidebar = vi.fn();
    render(
      <Toolbar
        onToggleSidebar={onToggleSidebar}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    await user.click(screen.getByLabelText("toolbar.toggleSidebar"));
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("calls onToggleSettings when settings button is clicked", async () => {
    const user = userEvent.setup();
    const onToggleSettings = vi.fn();
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={onToggleSettings}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    await user.click(screen.getByLabelText("toolbar.settings"));
    expect(onToggleSettings).toHaveBeenCalledOnce();
  });

  it("calls resetForm when new generation button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    await user.click(screen.getByText("toolbar.newGeneration"));
    expect(mockResetForm).toHaveBeenCalledOnce();
  });

  it("calls reopenSetup when open setup button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    await user.click(screen.getByLabelText("toolbar.openSetup"));
    expect(mockReopenSetup).toHaveBeenCalledOnce();
  });

  it("calls revealInFinder with output directory when reveal button is clicked", async () => {
    const user = userEvent.setup();
    currentStoreState = makeStoreOverrides({
      settings: { outputDirectory: "/Users/test/music" },
    });
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    await user.click(screen.getByLabelText("toolbar.revealOutput"));
    expect(mockRevealInFinder).toHaveBeenCalledWith("/Users/test/music");
  });

  it("does not call revealInFinder when output directory is empty", async () => {
    const user = userEvent.setup();
    currentStoreState = makeStoreOverrides({
      settings: { outputDirectory: "" },
    });
    render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    await user.click(screen.getByLabelText("toolbar.revealOutput"));
    expect(mockRevealInFinder).not.toHaveBeenCalled();
  });

  it("renders with a data-tauri-drag-region element", () => {
    const { container } = render(
      <Toolbar
        onToggleSidebar={vi.fn()}
        onToggleSettings={vi.fn()}
        shellState={macShellState}
        settingsOpen={false}
        sidebarVisible
      />,
    );
    expect(container.querySelector("[data-tauri-drag-region]")).toBeTruthy();
  });
});

// ===========================================================================
// SidebarRail
// ===========================================================================

describe("SidebarRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <SidebarRail visible width={260} onResize={vi.fn()}>
        <div data-testid="child-content">Child</div>
      </SidebarRail>,
    );
    expect(screen.getByTestId("child-content")).toBeTruthy();
    expect(screen.getByText("Child")).toBeTruthy();
  });

  it("renders the resize separator when visible", () => {
    render(
      <SidebarRail visible width={260} onResize={vi.fn()}>
        <div>Child</div>
      </SidebarRail>,
    );
    const separator = screen.getByRole("separator");
    expect(separator).toBeTruthy();
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("does not render the resize separator when hidden", () => {
    render(
      <SidebarRail visible={false} width={260} onResize={vi.fn()}>
        <div>Child</div>
      </SidebarRail>,
    );
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("applies w-0 class when not visible", () => {
    const { container } = render(
      <SidebarRail visible={false} width={260} onResize={vi.fn()}>
        <div>Child</div>
      </SidebarRail>,
    );
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("w-0");
  });

  it("applies variable width class when visible", () => {
    const { container } = render(
      <SidebarRail visible width={260} onResize={vi.fn()}>
        <div>Child</div>
      </SidebarRail>,
    );
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("w-[var(--window-shell-sidebar-width)]");
  });

  it("applies translate and opacity classes when visible", () => {
    render(
      <SidebarRail visible width={260} onResize={vi.fn()}>
        <div data-testid="inner">Child</div>
      </SidebarRail>,
    );
    const inner = screen.getByTestId("inner").parentElement as HTMLElement;
    expect(inner.className).toContain("translate-x-0");
    expect(inner.className).toContain("opacity-100");
  });

  it("applies hidden translate and opacity when not visible", () => {
    render(
      <SidebarRail visible={false} width={260} onResize={vi.fn()}>
        <div data-testid="inner">Child</div>
      </SidebarRail>,
    );
    const inner = screen.getByTestId("inner").parentElement as HTMLElement;
    expect(inner.className).toContain("-translate-x-3");
    expect(inner.className).toContain("opacity-0");
  });

  it("calls onResize with clamped width during drag", () => {
    const onResize = vi.fn();
    render(
      <SidebarRail visible width={300} onResize={onResize}>
        <div>Child</div>
      </SidebarRail>,
    );
    const separator = screen.getByRole("separator");

    // Simulate pointer down then pointer move
    fireEvent.pointerDown(separator, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 150 });

    // Delta = 50, new width = 300 + 50 = 350, clamped to max 420
    expect(onResize).toHaveBeenCalledWith(350);
  });

  it("clamps resize to minimum width", () => {
    const onResize = vi.fn();
    render(
      <SidebarRail visible width={260} onResize={onResize}>
        <div>Child</div>
      </SidebarRail>,
    );
    const separator = screen.getByRole("separator");

    fireEvent.pointerDown(separator, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50 });

    // Delta = -150, new width = 260 - 150 = 110, clamped to min 240
    expect(onResize).toHaveBeenCalledWith(240);
  });

  it("clamps resize to maximum width", () => {
    const onResize = vi.fn();
    render(
      <SidebarRail visible width={400} onResize={onResize}>
        <div>Child</div>
      </SidebarRail>,
    );
    const separator = screen.getByRole("separator");

    fireEvent.pointerDown(separator, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 200 });

    // Delta = 100, new width = 400 + 100 = 500, clamped to max 420
    expect(onResize).toHaveBeenCalledWith(420);
  });
});

// ===========================================================================
// MainContentView
// ===========================================================================

describe("MainContentView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = makeStoreOverrides();
  });

  it("renders OpenLoopStage", () => {
    render(<MainContentView />);
    expect(screen.getByTestId("generation-panel")).toBeTruthy();
  });

  it("renders PlaybackBar", () => {
    render(<MainContentView />);
    expect(screen.getByTestId("playback-bar")).toBeTruthy();
  });

  it("renders ModelBootstrapBanner in normal mode", () => {
    currentStoreState = makeStoreOverrides({ demoMode: false });
    render(<MainContentView />);
    expect(screen.getByTestId("model-bootstrap-banner")).toBeTruthy();
    expect(screen.queryByTestId("demo-banner")).toBeNull();
  });

  it("renders DemoBanner in demo mode", () => {
    currentStoreState = makeStoreOverrides({ demoMode: true });
    render(<MainContentView />);
    expect(screen.getByTestId("demo-banner")).toBeTruthy();
    expect(screen.queryByTestId("model-bootstrap-banner")).toBeNull();
  });

  it("does not render SettingsOverlay when settings are closed", () => {
    currentStoreState = makeStoreOverrides({ isSettingsOpen: false });
    render(<MainContentView />);
    expect(screen.queryByTestId("settings-overlay")).toBeNull();
  });

  it("renders SettingsOverlay when settings are open", async () => {
    currentStoreState = makeStoreOverrides({ isSettingsOpen: true });
    render(<MainContentView />);
    expect(await screen.findByTestId("settings-overlay")).toBeTruthy();
  });

  it("applies muted background to the content pocket when settings are open", () => {
    currentStoreState = makeStoreOverrides({ isSettingsOpen: true });
    const { container } = render(<MainContentView />);
    const pocket = container.querySelector("[data-shell-content-pocket]") as HTMLElement;
    expect(pocket.className).toContain("bg-[var(--color-surface-muted)]");
  });

  it("applies normal background to the content pocket when settings are closed", () => {
    currentStoreState = makeStoreOverrides({ isSettingsOpen: false });
    const { container } = render(<MainContentView />);
    const pocket = container.querySelector("[data-shell-content-pocket]") as HTMLElement;
    expect(pocket.className).toContain("bg-[var(--color-surface)]");
  });

  it("keeps the chrome background on the frame around the pocket", () => {
    const { container } = render(<MainContentView />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("bg-[var(--color-sidebar)]");
  });

  it("sets data-main-content-visual-variant attribute", () => {
    const { container } = render(<MainContentView />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-main-content-visual-variant")).toBe("unified");
  });
});

// ===========================================================================
// OpenLoopStage
// ===========================================================================

describe("OpenLoopStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = makeStoreOverrides();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    vi.spyOn(window, "open").mockReturnValue(null);
  });

  it("renders GenerationPanel", () => {
    render(<OpenLoopStage />);
    expect(screen.getByTestId("generation-panel")).toBeTruthy();
  });

  it("does not show running banner when idle", () => {
    currentStoreState = makeStoreOverrides({
      generationState: { status: "idle", phase: "idle", statusMessage: "Ready", error: null },
    });
    render(<OpenLoopStage />);
    expect(screen.queryByText("Ready")).toBeNull();
  });

  it("shows running banner with status message when running", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "running",
        phase: "generating",
        statusMessage: "Generating audio...",
        error: null,
      },
    });
    render(<OpenLoopStage />);
    expect(screen.getByText("Generating audio...")).toBeTruthy();
  });

  it("shows running banner when validating", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "validating",
        phase: "validating",
        statusMessage: "Validating inputs...",
        error: null,
      },
    });
    render(<OpenLoopStage />);
    expect(screen.getByText("Validating inputs...")).toBeTruthy();
  });

  it("shows error banner when generation fails", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Failed",
        error: { code: "TASK_FAILED", message: "Generation task failed", details: "timeout" },
      },
    });
    render(<OpenLoopStage />);
    expect(screen.getByText("stage.somethingWentWrong")).toBeTruthy();
  });

  it("does not show error banner when failed but no error object", () => {
    currentStoreState = makeStoreOverrides({
      generationState: { status: "failed", phase: "failed", statusMessage: "Failed", error: null },
    });
    render(<OpenLoopStage />);
    expect(screen.queryByText("stage.somethingWentWrong")).toBeNull();
  });

  it("shows error details in collapsible section", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Failed",
        error: {
          code: "TASK_FAILED",
          message: "Generation task failed",
          details: "model not found",
        },
      },
    });
    render(<OpenLoopStage />);
    expect(screen.getByText("stage.showDetails")).toBeTruthy();
    expect(screen.getByText(/TASK_FAILED/)).toBeTruthy();
    expect(screen.getByText(/Generation task failed/)).toBeTruthy();
    expect(screen.getByText(/model not found/)).toBeTruthy();
  });

  it("shows error details without details field when not provided", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Failed",
        error: { code: "TASK_FAILED", message: "Generation task failed" },
      },
    });
    render(<OpenLoopStage />);
    expect(screen.getByText("stage.showDetails")).toBeTruthy();
    expect(screen.getByText(/TASK_FAILED/)).toBeTruthy();
  });

  it("renders retry, copy details, and get help buttons when failed", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Failed",
        error: { code: "TASK_FAILED", message: "something broke" },
      },
    });
    render(<OpenLoopStage />);
    expect(screen.getByText("stage.retry")).toBeTruthy();
    expect(screen.getByText("stage.copyDetails")).toBeTruthy();
    expect(screen.getByText("stage.getHelp")).toBeTruthy();
  });

  it("calls runGeneration when retry is clicked", async () => {
    const user = userEvent.setup();
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Failed",
        error: { code: "TASK_FAILED", message: "broke" },
      },
    });
    render(<OpenLoopStage />);
    await user.click(screen.getByText("stage.retry"));
    expect(mockRunGeneration).toHaveBeenCalledOnce();
  });

  it("copies error details to clipboard when copy details is clicked", async () => {
    const user = userEvent.setup();
    const error = { code: "TASK_FAILED", message: "broke", details: "extra info" };
    currentStoreState = makeStoreOverrides({
      generationState: { status: "failed", phase: "failed", statusMessage: "Failed", error },
    });
    render(<OpenLoopStage />);
    await user.click(screen.getByText("stage.copyDetails"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(error, null, 2));
  });

  it("opens GitHub issue URL when get help is clicked", async () => {
    const user = userEvent.setup();
    const error = { code: "TASK_FAILED", message: "broke" };
    currentStoreState = makeStoreOverrides({
      generationState: { status: "failed", phase: "failed", statusMessage: "Failed", error },
    });
    render(<OpenLoopStage />);
    await user.click(screen.getByText("stage.getHelp"));
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(expect.stringContaining("github.com"));
  });

  it("renders the generation panel on a flat card without ambience layers", () => {
    const { container } = render(<OpenLoopStage />);
    expect(container.querySelector("[data-native-stage-backdrop]")).toBeNull();
    const card = container.querySelector(".custom-scrollbar") as HTMLElement;
    expect(card.className).toContain("bg-[var(--color-surface-muted)]");
  });
});

// ===========================================================================
// AppLayout
// ===========================================================================

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = makeStoreOverrides();
  });

  it("renders the main layout structure", () => {
    render(<AppLayout />);
    // WindowChrome (toolbar)
    expect(screen.getByLabelText("toolbar.toggleSidebar")).toBeTruthy();
    // MainContentView -> OpenLoopStage -> GenerationPanel
    expect(screen.getByTestId("generation-panel")).toBeTruthy();
    // PlaybackBar from MainContentView
    expect(screen.getByTestId("playback-bar")).toBeTruthy();
    // HistorySidebar inside SidebarRail
    expect(screen.getByTestId("history-sidebar")).toBeTruthy();
  });

  it("sets data-window-chrome-platform attribute on root", () => {
    const { container } = render(<AppLayout />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-window-chrome-platform")).toBeTruthy();
  });

  it("sets data-window-shell-tier attribute on root", () => {
    const { container } = render(<AppLayout />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-window-shell-tier")).toBeTruthy();
  });

  it("applies window shell CSS custom properties on root", () => {
    const { container } = render(<AppLayout />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--window-shell-sidebar-width")).toBeTruthy();
    expect(root.style.getPropertyValue("--window-shell-toolbar-height")).toBeTruthy();
  });

  it("toggles sidebar when Ctrl+B shortcut is pressed", () => {
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "b", code: "KeyB", ctrlKey: true });
    expect(mockToggleSidebar).toHaveBeenCalledOnce();
  });

  it("toggles settings when Ctrl+, shortcut is pressed", () => {
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: ",", code: "Comma", ctrlKey: true });
    expect(mockToggleSettings).toHaveBeenCalledOnce();
  });

  it("resets form when Ctrl+N shortcut is pressed", () => {
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "n", code: "KeyN", ctrlKey: true });
    expect(mockResetForm).toHaveBeenCalledOnce();
  });

  it("opens keyboard shortcuts dialog when Ctrl+/ is pressed", () => {
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "/", code: "Slash", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("shortcuts.subtitle")).toBeTruthy();
  });

  it("closes keyboard shortcuts dialog on Escape", () => {
    render(<AppLayout />);
    // Open dialog
    fireEvent.keyDown(window, { key: "/", code: "Slash", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    // Close with Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes keyboard shortcuts dialog on backdrop click", async () => {
    const user = userEvent.setup();
    render(<AppLayout />);
    // Open dialog
    fireEvent.keyDown(window, { key: "/", code: "Slash", ctrlKey: true });
    const dialog = screen.getByRole("dialog");
    // Click backdrop (the fixed overlay parent)
    const backdrop = dialog.closest(".fixed") as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not close keyboard shortcuts dialog when clicking inside dialog", async () => {
    const user = userEvent.setup();
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "/", code: "Slash", ctrlKey: true });
    const dialog = screen.getByRole("dialog");
    await user.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("renders all shortcut rows in the keyboard shortcuts dialog", () => {
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "/", code: "Slash", ctrlKey: true });
    expect(screen.getByText("shortcuts.toggleSidebar")).toBeTruthy();
    expect(screen.getByText("shortcuts.newGeneration")).toBeTruthy();
    expect(screen.getByText("shortcuts.openSettings")).toBeTruthy();
    expect(screen.getByText("shortcuts.generate")).toBeTruthy();
    expect(screen.getByText("shortcuts.retryGeneration")).toBeTruthy();
    expect(screen.getByText("shortcuts.togglePlayback")).toBeTruthy();
    expect(screen.getByText("shortcuts.compareToggle")).toBeTruthy();
    // "Keyboard shortcuts" appears as both the dialog title and a shortcut row label
    expect(screen.getAllByText(/shortcuts\.(title|keyboardHelp)/)).toHaveLength(2);
  });

  it("calls runGeneration on submit shortcut when not already running", () => {
    currentStoreState = makeStoreOverrides({
      generationState: { status: "idle", phase: "idle", statusMessage: "Ready", error: null },
    });
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "Enter", code: "Enter", ctrlKey: true });
    expect(mockRunGeneration).toHaveBeenCalledOnce();
  });

  it("does not call runGeneration on submit shortcut when already running", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "running",
        phase: "generating",
        statusMessage: "Running...",
        error: null,
      },
    });
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "Enter", code: "Enter", ctrlKey: true });
    expect(mockRunGeneration).not.toHaveBeenCalled();
  });

  it("calls runGeneration on retry shortcut when generation has failed", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Failed",
        error: { code: "TASK_FAILED", message: "broke" },
      },
    });
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "r", code: "KeyR", ctrlKey: true, shiftKey: true });
    expect(mockRunGeneration).toHaveBeenCalledOnce();
  });

  it("does not call runGeneration on retry shortcut when not failed", () => {
    currentStoreState = makeStoreOverrides({
      generationState: { status: "idle", phase: "idle", statusMessage: "Ready", error: null },
    });
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "r", code: "KeyR", ctrlKey: true, shiftKey: true });
    expect(mockRunGeneration).not.toHaveBeenCalled();
  });

  it("requests playback toggle on Space shortcut", () => {
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(mockRequestPlaybackToggle).toHaveBeenCalledOnce();
  });

  it("toggles compare target on 1 shortcut when compare mode is active", () => {
    currentStoreState = makeStoreOverrides({ compareModeActive: true });
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "1", code: "Digit1" });
    expect(mockToggleCompareTarget).toHaveBeenCalledOnce();
  });

  it("does not toggle compare target on 1 shortcut when compare mode is inactive", () => {
    currentStoreState = makeStoreOverrides({ compareModeActive: false });
    render(<AppLayout />);
    fireEvent.keyDown(window, { key: "1", code: "Digit1" });
    expect(mockToggleCompareTarget).not.toHaveBeenCalled();
  });
});
