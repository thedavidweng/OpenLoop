import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

import { StateBadge } from "@/app/components/settings/SettingsOverlay/StateBadge";
import { ModelVariantCard } from "@/app/components/settings/SettingsOverlay/ModelVariantCard";
import { ModelPackCard } from "@/app/components/settings/SettingsOverlay/ModelPackCard";
import { CatalogPackCard } from "@/app/components/settings/SettingsOverlay/CatalogPackCard";
import { DirectoryPickerRow } from "@/app/components/settings/SettingsOverlay/DirectoryPickerRow";
import type { ModelPackDescriptor } from "@/app/lib/types";

// ---------------------------------------------------------------------------
// StateBadge
// ---------------------------------------------------------------------------

describe("StateBadge", () => {
  it("renders the ready state with correct label", () => {
    render(<StateBadge state="ready" />);
    expect(screen.getByText("model.ready")).toBeTruthy();
  });

  it("renders the downloading state with correct label", () => {
    render(<StateBadge state="downloading" />);
    expect(screen.getByText("model.downloading")).toBeTruthy();
  });

  it("renders the failed state with correct label", () => {
    render(<StateBadge state="failed" />);
    expect(screen.getByText("model.failed")).toBeTruthy();
  });

  it("renders the not_installed state with correct label", () => {
    render(<StateBadge state="not_installed" />);
    expect(screen.getByText("model.notInstalled")).toBeTruthy();
  });

  it("applies animate-spin class only for downloading state", () => {
    const { container, rerender } = render(<StateBadge state="downloading" />);
    const icon = container.querySelector(".animate-spin");
    expect(icon).not.toBeNull();

    rerender(<StateBadge state="ready" />);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DirectoryPickerRow
// ---------------------------------------------------------------------------

describe("DirectoryPickerRow", () => {
  const baseProps = {
    label: "Output Folder",
    value: "",
    defaultValue: "/default/path",
    onPick: vi.fn(),
    onReset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the label", () => {
    render(<DirectoryPickerRow {...baseProps} />);
    expect(screen.getByText("Output Folder")).toBeTruthy();
  });

  it("shows default path when value is empty", () => {
    render(<DirectoryPickerRow {...baseProps} />);
    expect(screen.getByText("/default/path")).toBeTruthy();
    expect(screen.getByText("settings.defaultPath")).toBeTruthy();
  });

  it("shows custom value and use-default button when value is set", () => {
    render(<DirectoryPickerRow {...baseProps} value="/custom/path" />);
    expect(screen.getByText("/custom/path")).toBeTruthy();
    expect(screen.queryByText("settings.defaultPath")).toBeNull();
    expect(screen.getByText("settings.useDefault")).toBeTruthy();
  });

  it("calls onPick when choose folder button is clicked", async () => {
    const user = userEvent.setup();
    render(<DirectoryPickerRow {...baseProps} />);
    await user.click(screen.getByText("settings.chooseFolder"));
    expect(baseProps.onPick).toHaveBeenCalledTimes(1);
  });

  it("calls onReset when use default button is clicked", async () => {
    const user = userEvent.setup();
    render(<DirectoryPickerRow {...baseProps} value="/custom/path" />);
    await user.click(screen.getByText("settings.useDefault"));
    expect(baseProps.onReset).toHaveBeenCalledTimes(1);
  });

  it("disables pick button when disabled prop is true", () => {
    render(<DirectoryPickerRow {...baseProps} disabled />);
    const button = screen.getByText("settings.chooseFolder").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("shows dash when both value and defaultValue are empty", () => {
    render(<DirectoryPickerRow {...baseProps} value="" defaultValue="" />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ModelVariantCard
// ---------------------------------------------------------------------------

describe("ModelVariantCard", () => {
  const baseProps = {
    variant: "turbo" as const,
    selected: false,
    packReady: true,
    packState: "ready" as const,
    busy: false,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders variant label and description", () => {
    render(<ModelVariantCard {...baseProps} />);
    expect(screen.getByText("Turbo")).toBeTruthy();
    expect(screen.getByText("modelProfiles.turbo.description")).toBeTruthy();
  });

  it("shows active badge when selected", () => {
    render(<ModelVariantCard {...baseProps} selected />);
    expect(screen.getByText("model.active")).toBeTruthy();
  });

  it("hides active badge when not selected", () => {
    render(<ModelVariantCard {...baseProps} />);
    expect(screen.queryByText("model.active")).toBeNull();
  });

  it("shows select button label when not selected", () => {
    render(<ModelVariantCard {...baseProps} />);
    expect(screen.getByText("model.select")).toBeTruthy();
  });

  it("shows selected button label when selected", () => {
    render(<ModelVariantCard {...baseProps} selected />);
    expect(screen.getByText("model.selected")).toBeTruthy();
  });

  it("calls onSelect when select button is clicked", async () => {
    const user = userEvent.setup();
    render(<ModelVariantCard {...baseProps} />);
    await user.click(screen.getByText("model.select"));
    expect(baseProps.onSelect).toHaveBeenCalledTimes(1);
  });

  it("disables select button when busy", () => {
    render(<ModelVariantCard {...baseProps} busy />);
    const button = screen.getByText("model.select").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("disables select button when pack is not ready and not selected", () => {
    render(<ModelVariantCard {...baseProps} packReady={false} packState="not_installed" />);
    const button = screen.getByText("model.select").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("does not disable when selected even if pack is not ready", () => {
    render(
      <ModelVariantCard {...baseProps} selected packReady={false} packState="not_installed" />,
    );
    const button = screen.getByText("model.selected").closest("button")!;
    expect(button.disabled).toBe(false);
  });

  it("shows pack state info", () => {
    render(<ModelVariantCard {...baseProps} />);
    expect(screen.getByText(/Standard/)).toBeTruthy();
  });

  it("renders pro variant correctly", () => {
    render(<ModelVariantCard {...baseProps} variant="pro" />);
    expect(screen.getByText("XL Turbo")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ModelPackCard
// ---------------------------------------------------------------------------

describe("ModelPackCard", () => {
  const baseProps = {
    packId: "standard" as const,
    state: "not_installed" as const,
    downloadedBytes: 0,
    totalBytes: 8 * 1024 * 1024 * 1024,
    busy: false,
    onDownload: vi.fn(),
    onDelete: vi.fn(),
    onCancel: vi.fn(),
    onClearPartial: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pack label and description", () => {
    render(<ModelPackCard {...baseProps} />);
    expect(screen.getByText("Standard")).toBeTruthy();
    expect(screen.getByText("modelPacks.standard.description")).toBeTruthy();
  });

  it("shows download button for not_installed state", () => {
    render(<ModelPackCard {...baseProps} />);
    expect(screen.getByText("model.download")).toBeTruthy();
  });

  it("shows delete button for ready state", () => {
    render(<ModelPackCard {...baseProps} state="ready" />);
    expect(screen.getByText("model.delete")).toBeTruthy();
  });

  it("shows cancel and downloading indicator for downloading state", () => {
    render(
      <ModelPackCard {...baseProps} state="downloading" downloadedBytes={1024 * 1024 * 1024} />,
    );
    expect(screen.getByText("model.cancel")).toBeTruthy();
    expect(screen.getByText("Downloading…")).toBeTruthy();
  });

  it("shows retry and clear cache button for failed state", () => {
    render(<ModelPackCard {...baseProps} state="failed" />);
    expect(screen.getByText("model.retry")).toBeTruthy();
    expect(screen.getByText("model.clearCache")).toBeTruthy();
  });

  it("displays progress bar when downloading", () => {
    const { container } = render(
      <ModelPackCard {...baseProps} state="downloading" downloadedBytes={4 * 1024 * 1024 * 1024} />,
    );
    const progressBar = container.querySelector("[style]");
    expect(progressBar).not.toBeNull();
  });

  it("shows error message when provided", () => {
    render(
      <ModelPackCard
        {...baseProps}
        state="failed"
        errorMessage="Download failed"
        errorDetails="Network timeout"
      />,
    );
    expect(screen.getByText("Download failed")).toBeTruthy();
    expect(screen.getByText("Network timeout")).toBeTruthy();
  });

  it("does not show error section when no errorMessage", () => {
    render(<ModelPackCard {...baseProps} />);
    expect(screen.queryByText("Download failed")).toBeNull();
  });

  it("calls onDownload when download button is clicked", async () => {
    const user = userEvent.setup();
    render(<ModelPackCard {...baseProps} />);
    await user.click(screen.getByText("model.download"));
    expect(baseProps.onDownload).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<ModelPackCard {...baseProps} state="ready" />);
    await user.click(screen.getByText("model.delete"));
    expect(baseProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ModelPackCard {...baseProps} state="downloading" />);
    await user.click(screen.getByText("model.cancel"));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onClearPartial when clear cache button is clicked", async () => {
    const user = userEvent.setup();
    render(<ModelPackCard {...baseProps} state="failed" />);
    await user.click(screen.getByText("model.clearCache"));
    expect(baseProps.onClearPartial).toHaveBeenCalledTimes(1);
  });

  it("disables buttons when busy", () => {
    render(<ModelPackCard {...baseProps} busy />);
    const button = screen.getByText("model.download").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("formats byte sizes correctly", () => {
    render(
      <ModelPackCard
        {...baseProps}
        downloadedBytes={2 * 1024 * 1024 * 1024}
        totalBytes={8 * 1024 * 1024 * 1024}
      />,
    );
    expect(screen.getByText(/2\.0 GB/)).toBeTruthy();
    expect(screen.getByText(/8\.0 GB/)).toBeTruthy();
  });

  it("shows percentage during download", () => {
    render(
      <ModelPackCard
        {...baseProps}
        state="downloading"
        downloadedBytes={4 * 1024 * 1024 * 1024}
        totalBytes={8 * 1024 * 1024 * 1024}
      />,
    );
    expect(screen.getByText(/50%/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// CatalogPackCard
// ---------------------------------------------------------------------------

const announcedPack: ModelPackDescriptor = {
  id: "minimax-music3/turbo",
  engine: "minimax-music3",
  label: "Turbo",
  description: "Reserved distilled pack.",
  installPolicy: "announced",
  estimatedSizeBytes: 0,
  recommendedMemoryGb: 16,
  capabilities: {
    supportsBpm: false,
    supportsKey: false,
    supportsTimeSignature: false,
    supportsThinking: false,
    supportsLyrics: true,
    promptRole: "caption-and-lyrics",
    maxDurationSeconds: 360,
  },
  acePack: null,
};

const installablePack: ModelPackDescriptor = {
  ...announcedPack,
  id: "ace-step/standard",
  engine: "ace-step",
  label: "Standard",
  description: "Installable catalog pack.",
  installPolicy: "installable",
  estimatedSizeBytes: 8 * 1024 * 1024 * 1024,
  recommendedMemoryGb: 16,
  acePack: "standard",
};

describe("CatalogPackCard", () => {
  it("shows an announced badge and recommended memory", () => {
    render(<CatalogPackCard pack={announcedPack} />);
    expect(screen.getByText("Turbo")).toBeTruthy();
    expect(screen.getByText("Reserved distilled pack.")).toBeTruthy();
    expect(screen.getByText("model.announced")).toBeTruthy();
    expect(screen.getByText("model.recommendedMemory")).toBeTruthy();
  });

  it("shows download progress for an installable pack", () => {
    render(
      <CatalogPackCard
        pack={installablePack}
        state="downloading"
        downloadedBytes={2 * 1024 * 1024 * 1024}
        totalBytes={8 * 1024 * 1024 * 1024}
      />,
    );
    expect(screen.getByText("model.downloading")).toBeTruthy();
    expect(screen.getByText(/2\.0 GB/)).toBeTruthy();
    expect(screen.getByText(/8\.0 GB/)).toBeTruthy();
  });

  it("renders an em dash when no bytes have been downloaded", () => {
    render(<CatalogPackCard pack={installablePack} downloadedBytes={0} totalBytes={0} />);
    expect(screen.getByText("— / —")).toBeTruthy();
  });
});
