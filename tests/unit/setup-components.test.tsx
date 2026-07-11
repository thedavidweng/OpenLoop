import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Mocks – declared before imports so vitest hoists them
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  STEP_ORDER,
  StepIndicator,
  SetupActionCard,
  bytesToLabel,
  progressPercent,
  etaFromBytes,
  formatEta,
  PackDownloadCard,
  VariantPickerCard,
} from "@/app/components/settings/setup-components";
import { MODEL_PACKS, MODEL_VARIANTS, packIdForVariant } from "@/app/lib/model-packs";

// ===========================================================================
// Pure helper functions
// ===========================================================================

describe("bytesToLabel", () => {
  it("returns '0 GB' for zero bytes", () => {
    expect(bytesToLabel(0)).toBe("0 GB");
  });

  it("returns '0 GB' for falsy bytes", () => {
    expect(bytesToLabel(0)).toBe("0 GB");
  });

  it("formats bytes into GB with one decimal", () => {
    expect(bytesToLabel(8 * 1024 * 1024 * 1024)).toBe("8.0 GB");
  });

  it("formats fractional GB values", () => {
    expect(bytesToLabel(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });

  it("formats the XL pack estimated size", () => {
    expect(bytesToLabel(22 * 1024 * 1024 * 1024)).toBe("22.0 GB");
  });
});

describe("progressPercent", () => {
  it("returns 0 when totalBytes is falsy", () => {
    expect(progressPercent(100, 0)).toBe(0);
    expect(progressPercent(100, null)).toBe(0);
    expect(progressPercent(100, undefined)).toBe(0);
  });

  it("returns 0 when nothing downloaded", () => {
    expect(progressPercent(0, 100)).toBe(0);
  });

  it("computes the rounded percentage", () => {
    expect(progressPercent(50, 100)).toBe(50);
    expect(progressPercent(33, 100)).toBe(33);
    expect(progressPercent(33.6, 100)).toBe(34);
  });

  it("clamps to a maximum of 100", () => {
    expect(progressPercent(150, 100)).toBe(100);
  });

  it("clamps to a minimum of 0", () => {
    expect(progressPercent(-10, 100)).toBe(0);
  });

  it("returns 100 when fully downloaded", () => {
    expect(progressPercent(100, 100)).toBe(100);
  });
});

describe("etaFromBytes", () => {
  it("returns seconds for small downloads", () => {
    // 5 MB at 10 MB/s = 0.5s -> ceil = 1s
    expect(etaFromBytes(5 * 1024 * 1024)).toBe("1s");
  });

  it("returns minutes for medium downloads", () => {
    // 600 MB at 10 MB/s = 60s -> 1 min
    expect(etaFromBytes(600 * 1024 * 1024)).toBe("1 min");
  });

  it("returns hours and minutes for large downloads", () => {
    // 8 GB at 10 MB/s = 819.2s... wait, 8GB / 10MB/s = 819.2s = ~13.6 min
    // Let me compute: 8 * 1024 * 1024 * 1024 / (10 * 1024 * 1024) = 819.2s -> < 3600 -> minutes
    expect(etaFromBytes(8 * 1024 * 1024 * 1024)).toBe("14 min");
  });

  it("returns hours format for very large downloads", () => {
    // 100 GB at 10 MB/s = 10240s = 2h 507min... wait
    // 100 * 1024 * 1024 * 1024 / (10 * 1024 * 1024) = 10240s
    // hours = floor(10240/3600) = 2, mins = ceil(10240 % 3600 / 60) = ceil(3040/60) = ceil(50.67) = 51
    expect(etaFromBytes(100 * 1024 * 1024 * 1024)).toBe("2h 51m");
  });

  it("respects a custom speed", () => {
    // 600 MB at 1 MB/s = 600s = 10 min
    expect(etaFromBytes(600 * 1024 * 1024, 1 * 1024 * 1024)).toBe("10 min");
  });
});

describe("formatEta", () => {
  it("clamps negative seconds to 0", () => {
    expect(formatEta(-10)).toBe("~0 sec");
  });

  it("formats seconds under 60", () => {
    expect(formatEta(30)).toBe("~30 sec");
    expect(formatEta(0)).toBe("~0 sec");
    expect(formatEta(59.5)).toBe("~60 sec");
  });

  it("formats minutes and seconds", () => {
    expect(formatEta(60)).toBe("~1 min 0 sec");
    expect(formatEta(125)).toBe("~2 min 5 sec");
  });
});

// ===========================================================================
// STEP_ORDER constant
// ===========================================================================

describe("STEP_ORDER", () => {
  it("contains all five setup steps in order", () => {
    expect(STEP_ORDER).toEqual(["welcome", "device", "model", "output", "done"]);
  });
});

// ===========================================================================
// StepIndicator
// ===========================================================================

describe("StepIndicator", () => {
  it("renders one dot per step", () => {
    const { container } = render(<StepIndicator current="welcome" />);
    const dots = container.querySelectorAll(".h-1.rounded-full");
    expect(dots.length).toBe(STEP_ORDER.length);
  });

  it("marks the current step as active with the wide class", () => {
    const { container } = render(<StepIndicator current="model" />);
    const dots = Array.from(container.querySelectorAll(".h-1.rounded-full"));
    const activeIndex = STEP_ORDER.indexOf("model");
    const activeDot = dots[activeIndex];
    expect(activeDot.className).toContain("w-6");
    expect(activeDot.className).toContain("bg-[var(--color-accent)]");
  });

  it("marks steps before the current as done", () => {
    const { container } = render(<StepIndicator current="output" />);
    const dots = Array.from(container.querySelectorAll(".h-1.rounded-full"));
    const currentIndex = STEP_ORDER.indexOf("output");
    for (let i = 0; i < currentIndex; i++) {
      expect(dots[i].className).toContain("bg-[var(--color-accent)]/60");
      expect(dots[i].className).toContain("w-1.5");
    }
  });

  it("marks steps after the current as pending", () => {
    const { container } = render(<StepIndicator current="device" />);
    const dots = Array.from(container.querySelectorAll(".h-1.rounded-full"));
    const currentIndex = STEP_ORDER.indexOf("device");
    for (let i = currentIndex + 1; i < dots.length; i++) {
      expect(dots[i].className).toContain("bg-[var(--color-border)]");
      expect(dots[i].className).toContain("w-1.5");
    }
  });

  it("marks all dots as done when current is the last step", () => {
    const { container } = render(<StepIndicator current="done" />);
    const dots = Array.from(container.querySelectorAll(".h-1.rounded-full"));
    const doneIndex = STEP_ORDER.indexOf("done");
    // active dot is the last one
    expect(dots[doneIndex].className).toContain("w-6");
    // all others are done
    for (let i = 0; i < doneIndex; i++) {
      expect(dots[i].className).toContain("bg-[var(--color-accent)]/60");
    }
  });
});

// ===========================================================================
// SetupActionCard
// ===========================================================================

describe("SetupActionCard", () => {
  it("renders the title and description", () => {
    render(
      <SetupActionCard
        icon={CheckCircle2}
        title="Download model"
        description="Pick and download a model pack."
      />,
    );

    expect(screen.getByText("Download model")).toBeTruthy();
    expect(screen.getByText("Pick and download a model pack.")).toBeTruthy();
  });

  it("renders the icon", () => {
    const { container } = render(
      <SetupActionCard icon={AlertCircle} title="Alert" description="Something happened." />,
    );
    // lucide icons render as <svg>
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders the card container with empty strings", () => {
    const { container } = render(<SetupActionCard icon={CheckCircle2} title="" description="" />);
    // The card container still renders
    const card = container.querySelector("div.flex.w-full");
    expect(card).not.toBeNull();
    // svg icon still renders
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

// ===========================================================================
// PackDownloadCard
// ===========================================================================

describe("PackDownloadCard", () => {
  const standardPack = MODEL_PACKS.standard;
  const totalBytes = standardPack.estimatedSizeBytes;

  function renderCard(overrides?: Record<string, unknown>) {
    const onDownload = vi.fn();
    const props = {
      packId: "standard" as const,
      state: "not_installed" as const,
      downloadedBytes: 0,
      totalBytes,
      busy: false,
      onDownload,
      ...overrides,
    };
    const result = render(<PackDownloadCard {...props} />);
    return { ...result, onDownload, props };
  }

  it("renders the pack label", () => {
    renderCard();
    expect(screen.getByText(standardPack.label)).toBeTruthy();
  });

  it("renders the pack description via translation key", () => {
    renderCard();
    expect(screen.getByText(`modelPacks.standard.description`)).toBeTruthy();
  });

  it("renders the byte progress label", () => {
    renderCard({ downloadedBytes: 0, totalBytes });
    expect(screen.getByText(`0 GB / ${bytesToLabel(totalBytes)}`)).toBeTruthy();
  });

  // -- not_installed state --------------------------------------------------

  it("shows the download button in not_installed state", () => {
    renderCard({ state: "not_installed" });
    expect(screen.getByText("setup.downloadModelButton")).toBeTruthy();
  });

  it("shows an ETA estimate for not_installed with totalBytes", () => {
    renderCard({ state: "not_installed", totalBytes });
    expect(screen.getByText(`~${etaFromBytes(totalBytes)}`)).toBeTruthy();
  });

  it("does not show ETA when totalBytes is 0 in not_installed state", () => {
    renderCard({ state: "not_installed", totalBytes: 0 });
    expect(screen.queryByText(/~.*min|~.*s/)).toBeNull();
  });

  it("calls onDownload when the download button is clicked", async () => {
    const user = userEvent.setup();
    const { onDownload } = renderCard({ state: "not_installed" });
    await user.click(screen.getByText("setup.downloadModelButton"));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  // -- downloading state ----------------------------------------------------

  it("shows the downloading button and progress bar in downloading state", () => {
    const { container } = renderCard({
      state: "downloading",
      downloadedBytes: totalBytes / 2,
    });
    expect(screen.getByText("setup.downloadingButton")).toBeTruthy();
    // progress bar
    const bar = container.querySelector(".h-1\\.5");
    expect(bar).not.toBeNull();
  });

  it("shows the percentage during downloading", () => {
    renderCard({
      state: "downloading",
      downloadedBytes: totalBytes / 2,
    });
    expect(screen.getByText(/50%/)).toBeTruthy();
  });

  it("disables the button while downloading", () => {
    renderCard({ state: "downloading", downloadedBytes: 0 });
    const button = screen.getByText("setup.downloadingButton").closest("button");
    expect(button?.disabled).toBe(true);
  });

  it("does not call onDownload when clicking the disabled downloading button", async () => {
    const user = userEvent.setup();
    const { onDownload } = renderCard({
      state: "downloading",
      downloadedBytes: 0,
    });
    const button = screen.getByText("setup.downloadingButton").closest("button")!;
    await user.click(button);
    expect(onDownload).not.toHaveBeenCalled();
  });

  // -- ready state ----------------------------------------------------------

  it("shows the downloaded badge and button in ready state", () => {
    renderCard({ state: "ready", downloadedBytes: totalBytes });
    expect(screen.getByText("setup.downloadedBadge")).toBeTruthy();
    expect(screen.getByText("setup.downloaded")).toBeTruthy();
  });

  it("disables the button when ready", () => {
    renderCard({ state: "ready", downloadedBytes: totalBytes });
    const button = screen.getByText("setup.downloaded").closest("button");
    expect(button?.disabled).toBe(true);
  });

  it("does not render the progress bar when ready", () => {
    const { container } = renderCard({
      state: "ready",
      downloadedBytes: totalBytes,
    });
    const bar = container.querySelector(".h-1\\.5");
    expect(bar).toBeNull();
  });

  // -- failed state ---------------------------------------------------------

  it("shows the failed badge and retry button in failed state", () => {
    renderCard({ state: "failed", downloadedBytes: 0 });
    expect(screen.getByText("model.failed")).toBeTruthy();
    expect(screen.getByText("model.retry")).toBeTruthy();
  });

  it("calls onDownload when retry is clicked in failed state", async () => {
    const user = userEvent.setup();
    const { onDownload } = renderCard({ state: "failed", downloadedBytes: 0 });
    await user.click(screen.getByText("model.retry"));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("renders the error message when provided", () => {
    renderCard({
      state: "failed",
      errorMessage: "Network error occurred",
    });
    expect(screen.getByText("Network error occurred")).toBeTruthy();
  });

  it("does not render an error message when none is provided", () => {
    renderCard({ state: "failed" });
    expect(screen.queryByText("Network error occurred")).toBeNull();
  });

  // -- busy prop ------------------------------------------------------------

  it("disables the button and shows spinner when busy is true", () => {
    renderCard({ state: "not_installed", busy: true });
    const button = screen.getByText("setup.downloadingButton").closest("button");
    expect(button?.disabled).toBe(true);
  });

  it("does not call onDownload when busy", async () => {
    const user = userEvent.setup();
    const { onDownload } = renderCard({ state: "not_installed", busy: true });
    const button = screen.getByText("setup.downloadingButton").closest("button")!;
    await user.click(button);
    expect(onDownload).not.toHaveBeenCalled();
  });

  // -- XL pack --------------------------------------------------------------

  it("renders the XL pack label and description", () => {
    render(
      <PackDownloadCard
        packId="xl"
        state="not_installed"
        downloadedBytes={0}
        totalBytes={MODEL_PACKS.xl.estimatedSizeBytes}
        busy={false}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText(MODEL_PACKS.xl.label)).toBeTruthy();
    expect(screen.getByText("modelPacks.xl.description")).toBeTruthy();
  });
});

// ===========================================================================
// VariantPickerCard
// ===========================================================================

describe("VariantPickerCard", () => {
  function renderCard(overrides?: Record<string, unknown>) {
    const onSelect = vi.fn();
    const props = {
      variant: "turbo" as const,
      selected: false,
      packState: "not_installed" as const,
      busy: false,
      onSelect,
      ...overrides,
    };
    const result = render(<VariantPickerCard {...props} />);
    return { ...result, onSelect, props };
  }

  it("renders the variant label", () => {
    renderCard({ variant: "turbo" });
    expect(screen.getByText(MODEL_VARIANTS.turbo.label)).toBeTruthy();
  });

  it("renders the variant description via translation key", () => {
    renderCard({ variant: "turbo" });
    expect(screen.getByText("modelProfiles.turbo.description")).toBeTruthy();
  });

  it("renders the pack label for the variant's pack", () => {
    renderCard({ variant: "turbo" });
    const packId = packIdForVariant("turbo");
    expect(screen.getByText(MODEL_PACKS[packId].label)).toBeTruthy();
  });

  it("renders the XL pack label for the pro variant", () => {
    renderCard({ variant: "pro" });
    expect(screen.getByText(MODEL_PACKS.xl.label)).toBeTruthy();
  });

  // -- selected state -------------------------------------------------------

  it("renders a checkmark indicator when selected", () => {
    const { container } = renderCard({ selected: true });
    const check = container.querySelector("svg");
    expect(check).not.toBeNull();
  });

  it("does not render a checkmark when not selected", () => {
    const { container } = renderCard({ selected: false });
    // The card itself has no svg when not selected
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(0);
  });

  it("applies the selected border class when selected", () => {
    const { container } = renderCard({ selected: true });
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-[var(--color-accent)]");
  });

  it("applies the default border class when not selected", () => {
    const { container } = renderCard({ selected: false });
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-[var(--color-border)]");
  });

  // -- click interactions ---------------------------------------------------

  it("calls onSelect when the card is clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderCard({ selected: true, packState: "ready" });
    await user.click(screen.getByText(MODEL_VARIANTS.turbo.label));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("is enabled when pack is ready and not selected", () => {
    renderCard({ selected: false, packState: "ready" });
    const button = screen.getByText(MODEL_VARIANTS.turbo.label).closest("button");
    expect(button?.disabled).toBe(false);
  });

  it("is enabled when selected even if pack is not ready", () => {
    renderCard({ selected: true, packState: "not_installed" });
    const button = screen.getByText(MODEL_VARIANTS.turbo.label).closest("button");
    expect(button?.disabled).toBe(false);
  });

  it("is disabled when not selected and pack is not ready", () => {
    renderCard({ selected: false, packState: "not_installed" });
    const button = screen.getByText(MODEL_VARIANTS.turbo.label).closest("button");
    expect(button?.disabled).toBe(true);
  });

  it("is disabled when busy", () => {
    renderCard({ selected: true, packState: "ready", busy: true });
    const button = screen.getByText(MODEL_VARIANTS.turbo.label).closest("button");
    expect(button?.disabled).toBe(true);
  });

  it("does not call onSelect when the disabled card is clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderCard({
      selected: false,
      packState: "not_installed",
    });
    const button = screen.getByText(MODEL_VARIANTS.turbo.label).closest("button")!;
    await user.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call onSelect when busy", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderCard({
      selected: true,
      packState: "ready",
      busy: true,
    });
    const button = screen.getByText(MODEL_VARIANTS.turbo.label).closest("button")!;
    await user.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // -- all variants ---------------------------------------------------------

  it("renders the lite variant correctly", () => {
    renderCard({ variant: "lite" });
    expect(screen.getByText(MODEL_VARIANTS.lite.label)).toBeTruthy();
    expect(screen.getByText("modelProfiles.lite.description")).toBeTruthy();
    expect(screen.getByText(MODEL_PACKS.standard.label)).toBeTruthy();
  });

  it("renders the pro variant correctly", () => {
    renderCard({ variant: "pro" });
    expect(screen.getByText(MODEL_VARIANTS.pro.label)).toBeTruthy();
    expect(screen.getByText("modelProfiles.pro.description")).toBeTruthy();
    expect(screen.getByText(MODEL_PACKS.xl.label)).toBeTruthy();
  });
});
