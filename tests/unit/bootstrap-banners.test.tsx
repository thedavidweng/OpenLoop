import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// -- Store mock state (mutable per test) ----------------------------------

let storeState: Record<string, any> = {};

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: Record<string, any>) => unknown) => selector(storeState),
}));

// -- Tauri updater mock ---------------------------------------------------

const mockCheck = vi.fn();
const mockDownloadAndInstall = vi.fn();
const mockRelaunch = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

// -- i18n mock (returns defaultValue when provided, else the key) ---------

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

// -- Default store state --------------------------------------------------

function defaultStoreState() {
  return {
    demoMode: false,
    settings: {
      modelVariant: null,
      firstRunCompleted: false,
      checkForUpdates: true,
    },
    bootstrapStatus: { state: "ready", message: "" },
    dismissDemoMode: vi.fn(),
    openSettings: vi.fn(),
    reopenSetup: vi.fn(),
  };
}

// -- Imports (must come after mocks) --------------------------------------

import { DemoBanner } from "@/app/components/bootstrap/DemoBanner";
import { ModelBootstrapBanner } from "@/app/components/bootstrap/ModelBootstrapBanner";
import { UpdateBanner } from "@/app/components/bootstrap/UpdateBanner";

// ==========================================================================
// DemoBanner
// ==========================================================================

describe("DemoBanner", () => {
  beforeEach(() => {
    storeState = defaultStoreState();
    vi.clearAllMocks();
  });

  it("renders nothing when demoMode is false", () => {
    storeState.demoMode = false;
    const { container } = render(<DemoBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when demoMode is true but modelVariant is set", () => {
    storeState.demoMode = true;
    storeState.settings = { ...storeState.settings, modelVariant: "small" };
    const { container } = render(<DemoBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the banner when demoMode is true and modelVariant is null", () => {
    storeState.demoMode = true;
    render(<DemoBanner />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Demo mode/)).toBeTruthy();
  });

  it("calls openSettings when the choose-model button is clicked", async () => {
    storeState.demoMode = true;
    const user = userEvent.setup();
    render(<DemoBanner />);

    await user.click(screen.getByText("model.chooseModel"));
    expect(storeState.openSettings).toHaveBeenCalledOnce();
  });

  it("calls dismissDemoMode when the dismiss button is clicked", async () => {
    storeState.demoMode = true;
    const user = userEvent.setup();
    render(<DemoBanner />);

    await user.click(screen.getByLabelText("Dismiss"));
    expect(storeState.dismissDemoMode).toHaveBeenCalledOnce();
  });

  it("has a role=status and aria-live=polite", () => {
    storeState.demoMode = true;
    render(<DemoBanner />);
    const banner = screen.getByRole("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });
});

// ==========================================================================
// ModelBootstrapBanner
// ==========================================================================

describe("ModelBootstrapBanner", () => {
  beforeEach(() => {
    storeState = defaultStoreState();
    vi.clearAllMocks();
  });

  it("renders nothing when bootstrap state is ready", () => {
    storeState.bootstrapStatus = { state: "ready", message: "All good" };
    const { container } = render(<ModelBootstrapBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders pending state with a choose-model button (firstRunCompleted=false)", () => {
    storeState.bootstrapStatus = { state: "pending", message: "Setup required" };
    storeState.settings = { ...storeState.settings, firstRunCompleted: false };
    render(<ModelBootstrapBanner />);

    expect(screen.getByText("Setup required")).toBeTruthy();
    expect(screen.getByText("setup.openSetup")).toBeTruthy();
  });

  it("renders pending state with a choose-model button (firstRunCompleted=true)", () => {
    storeState.bootstrapStatus = { state: "pending", message: "Pick a model" };
    storeState.settings = { ...storeState.settings, firstRunCompleted: true };
    render(<ModelBootstrapBanner />);

    expect(screen.getByText("Pick a model")).toBeTruthy();
    expect(screen.getByText("model.chooseModel")).toBeTruthy();
  });

  it("calls reopenSetup when pending and firstRunCompleted is false", async () => {
    storeState.bootstrapStatus = { state: "pending", message: "Setup" };
    storeState.settings = { ...storeState.settings, firstRunCompleted: false };
    const user = userEvent.setup();
    render(<ModelBootstrapBanner />);

    await user.click(screen.getByText("setup.openSetup"));
    expect(storeState.reopenSetup).toHaveBeenCalledOnce();
  });

  it("calls openSettings when pending and firstRunCompleted is true", async () => {
    storeState.bootstrapStatus = { state: "pending", message: "Setup" };
    storeState.settings = { ...storeState.settings, firstRunCompleted: true };
    const user = userEvent.setup();
    render(<ModelBootstrapBanner />);

    await user.click(screen.getByText("model.chooseModel"));
    expect(storeState.openSettings).toHaveBeenCalledOnce();
  });

  it("renders downloading state with progress info", () => {
    storeState.bootstrapStatus = {
      state: "downloading",
      message: "Downloading model...",
      downloadedBytes: 1024 * 1024 * 1024, // 1 GB
      totalBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    };
    render(<ModelBootstrapBanner />);

    expect(screen.getByText("Downloading model...")).toBeTruthy();
    expect(screen.getByText(/1\.0 GB.*2\.0 GB/)).toBeTruthy();
    expect(screen.getByText(/50%/)).toBeTruthy();
  });

  it("renders a progress bar during downloading", () => {
    storeState.bootstrapStatus = {
      state: "downloading",
      message: "Downloading...",
      downloadedBytes: 512 * 1024 * 1024,
      totalBytes: 1024 * 1024 * 1024,
    };
    const { container } = render(<ModelBootstrapBanner />);

    const progressBar = container.querySelector("[style*='width']");
    expect(progressBar).toBeTruthy();
    expect(progressBar?.getAttribute("style")).toContain("50%");
  });

  it("renders provisioning_backend state with progress", () => {
    storeState.bootstrapStatus = {
      state: "provisioning_backend",
      message: "Provisioning backend...",
      downloadedBytes: 256 * 1024 * 1024,
      totalBytes: 512 * 1024 * 1024,
    };
    render(<ModelBootstrapBanner />);

    expect(screen.getByText("Provisioning backend...")).toBeTruthy();
    expect(screen.getByText(/50%/)).toBeTruthy();
  });

  it("renders failed state with error details", () => {
    storeState.bootstrapStatus = {
      state: "failed",
      message: "Model not found",
      error: { code: "MODEL_NOT_FOUND", message: "Model not found", details: "The model file could not be located on disk." },
    };
    render(<ModelBootstrapBanner />);

    expect(screen.getByText("Model not found")).toBeTruthy();
    expect(screen.getByText("The model file could not be located on disk.")).toBeTruthy();
  });

  it("renders failed state without details when details match message", () => {
    storeState.bootstrapStatus = {
      state: "failed",
      message: "Something broke",
      error: { code: "GENERIC", message: "Something broke", details: "Something broke" },
    };
    const { container } = render(<ModelBootstrapBanner />);

    // The details paragraph should not appear when it equals the message
    const detailsEl = container.querySelector(".border-t.border-red-500\\/20");
    expect(detailsEl).toBeNull();
  });

  it("renders experimental state with open-settings button", () => {
    storeState.bootstrapStatus = { state: "experimental", message: "Experimental model" };
    render(<ModelBootstrapBanner />);

    expect(screen.getByText("Experimental model")).toBeTruthy();
    expect(screen.getByText("model.openSettings")).toBeTruthy();
  });

  it("calls openSettings when experimental button is clicked", async () => {
    storeState.bootstrapStatus = { state: "experimental", message: "Experimental" };
    const user = userEvent.setup();
    render(<ModelBootstrapBanner />);

    await user.click(screen.getByText("model.openSettings"));
    expect(storeState.openSettings).toHaveBeenCalledOnce();
  });

  it("has role=status and aria-live=polite", () => {
    storeState.bootstrapStatus = { state: "pending", message: "Setup" };
    render(<ModelBootstrapBanner />);
    const banner = screen.getByRole("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });
});

// ==========================================================================
// UpdateBanner
// ==========================================================================

describe("UpdateBanner", () => {
  beforeEach(() => {
    storeState = defaultStoreState();
    vi.clearAllMocks();
    mockCheck.mockReset();
    mockDownloadAndInstall.mockReset();
    mockRelaunch.mockReset();
  });

  it("renders nothing when no update is available", () => {
    mockCheck.mockResolvedValue(null);
    const { container } = render(<UpdateBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when checkForUpdates is false", () => {
    storeState.settings = { ...storeState.settings, checkForUpdates: false };
    mockCheck.mockResolvedValue({ version: "2.0.0", body: "New stuff" });
    const { container } = render(<UpdateBanner />);
    expect(mockCheck).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe("");
  });

  it("shows the full modal when an update is available", async () => {
    mockCheck.mockResolvedValue({ version: "2.0.0", body: "Bug fixes and improvements" });
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Update available.*2\.0\.0/)).toBeTruthy();
    });
    expect(screen.getByText("Bug fixes and improvements")).toBeTruthy();
    expect(screen.getByText("Install on restart")).toBeTruthy();
    expect(screen.getByText("Skip")).toBeTruthy();
    expect(screen.getByText("Release notes")).toBeTruthy();
  });

  it("shows the modal without release notes when body is null", async () => {
    mockCheck.mockResolvedValue({ version: "2.1.0", body: null });
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Update available.*2\.1\.0/)).toBeTruthy();
    });
    // No release notes box
    expect(screen.queryByText(/Bug fixes/)).toBeNull();
  });

  it("dismisses the modal and shows compact banner", async () => {
    mockCheck.mockResolvedValue({ version: "2.0.0", body: "Notes" });
    const user = userEvent.setup();
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText("Install on restart")).toBeTruthy();
    });

    // Click the close button (X icon, labeled with "common.close")
    await user.click(screen.getByLabelText("common.close"));

    // Modal should be gone, compact banner should appear
    await waitFor(() => {
      expect(screen.queryByText("Install on restart")).toBeNull();
    });
    expect(screen.getByText("update.view")).toBeTruthy();
  });

  it("re-opens the modal from the compact banner", async () => {
    mockCheck.mockResolvedValue({ version: "2.0.0", body: "Notes" });
    const user = userEvent.setup();
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText("Install on restart")).toBeTruthy();
    });

    // Dismiss modal
    await user.click(screen.getByLabelText("common.close"));

    await waitFor(() => {
      expect(screen.getByText("update.view")).toBeTruthy();
    });

    // Re-open
    await user.click(screen.getByText("update.view"));

    await waitFor(() => {
      expect(screen.getByText("Install on restart")).toBeTruthy();
    });
  });

  it("skips the update entirely when skip is clicked", async () => {
    mockCheck.mockResolvedValue({ version: "2.0.0", body: "Notes" });
    const user = userEvent.setup();
    const { container } = render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText("Skip")).toBeTruthy();
    });

    await user.click(screen.getByText("Skip"));

    // Both modal and compact banner should be gone
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("calls downloadAndInstall and relaunch when install is clicked", async () => {
    mockDownloadAndInstall.mockResolvedValue(undefined);
    mockRelaunch.mockResolvedValue(undefined);
    // First call returns the update info, second call (from handleInstall) returns it again
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      body: "Notes",
      downloadAndInstall: mockDownloadAndInstall,
    });
    const user = userEvent.setup();
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText("Install on restart")).toBeTruthy();
    });

    await user.click(screen.getByText("Install on restart"));

    await waitFor(() => {
      expect(mockDownloadAndInstall).toHaveBeenCalledOnce();
      expect(mockRelaunch).toHaveBeenCalledOnce();
    });
  });

  it("shows installing text while installation is in progress", async () => {
    let resolveInstall: () => void;
    const installPromise = new Promise<void>((resolve) => {
      resolveInstall = resolve;
    });
    mockDownloadAndInstall.mockReturnValue(installPromise);
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      body: "Notes",
      downloadAndInstall: mockDownloadAndInstall,
    });
    const user = userEvent.setup();
    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByText("Install on restart")).toBeTruthy();
    });

    await user.click(screen.getByText("Install on restart"));

    await waitFor(() => {
      expect(screen.getByText("Installing…")).toBeTruthy();
    });

    // Resolve to clean up
    resolveInstall!();
  });

  it("handles updater check errors silently", () => {
    mockCheck.mockRejectedValue(new Error("Network error"));
    const { container } = render(<UpdateBanner />);
    // Should not throw; renders nothing since no update was detected
    expect(container.innerHTML).toBe("");
  });

  it("renders the release notes link with correct href", async () => {
    mockCheck.mockResolvedValue({ version: "2.0.0", body: "Notes" });
    render(<UpdateBanner />);

    await waitFor(() => {
      const link = screen.getByText("Release notes").closest("a");
      expect(link).toBeTruthy();
      expect(link?.getAttribute("href")).toBe("https://github.com/thedavidweng/OpenLoop/releases");
      expect(link?.getAttribute("target")).toBe("_blank");
    });
  });
});
