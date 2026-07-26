import userEvent from "@testing-library/user-event";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Tooltip, TooltipProvider } from "@/app/components/overlay/Tooltip";
import { createTooltipScheduleController } from "@/app/components/overlay/Tooltip.utils";

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("createTooltipScheduleController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("shows after the delay and cancels a pending show on hide", () => {
    vi.useFakeTimers();
    const onShow = vi.fn();
    const controller = createTooltipScheduleController({
      delayDuration: 600,
      hideGraceDuration: 120,
      skipDelay: false,
    });

    controller.scheduleShow(onShow);
    expect(onShow).not.toHaveBeenCalled();

    vi.advanceTimersByTime(599);
    expect(onShow).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  test("shows immediately when skipDelay is active", () => {
    const onShow = vi.fn();
    const controller = createTooltipScheduleController({
      delayDuration: 600,
      hideGraceDuration: 120,
      skipDelay: true,
    });

    controller.scheduleShow(onShow);
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  test("hides after the grace window and cancelAll clears pending timers", () => {
    vi.useFakeTimers();
    const onShow = vi.fn();
    const onHide = vi.fn();
    const controller = createTooltipScheduleController({
      delayDuration: 600,
      hideGraceDuration: 120,
      skipDelay: false,
    });

    controller.scheduleShow(onShow);
    controller.scheduleHide(onHide);

    vi.advanceTimersByTime(119);
    // scheduleHide clears the pending show, so onShow never fires
    expect(onShow).not.toHaveBeenCalled();
    expect(onHide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onHide).toHaveBeenCalledTimes(1);

    controller.scheduleShow(onShow);
    controller.cancelAll();
    vi.advanceTimersByTime(1000);
    expect(onShow).not.toHaveBeenCalled();
  });
});

describe("Tooltip delay behavior", () => {
  let container: HTMLDivElement;
  let root: Root;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    user = userEvent.setup();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.querySelectorAll('[role="tooltip"]').forEach((node) => node.remove());
    vi.restoreAllMocks();
  });

  function renderTooltip(ui: ReactNode, options?: { withProvider?: boolean }) {
    const withProvider = options?.withProvider ?? true;
    act(() => {
      root.render(withProvider ? <TooltipProvider>{ui}</TooltipProvider> : ui);
    });
  }

  function getTooltip() {
    return document.body.querySelector('[role="tooltip"]');
  }

  test("renders children without a tooltip anchor when disabled", () => {
    renderTooltip(
      <Tooltip label="Play" disabled>
        <button type="button">Play</button>
      </Tooltip>,
    );

    expect(container.querySelector("span.inline-flex")).toBeNull();
    expect(container.querySelector("button")).not.toBeNull();
    expect(getTooltip()).toBeNull();
  });

  test("shows after the hover delay and hides after pointer leave", async () => {
    renderTooltip(
      <Tooltip label="Import files" delayDuration={300}>
        <button type="button">Import</button>
      </Tooltip>,
    );

    const wrapper = container.querySelector("span.inline-flex") as HTMLElement;
    await user.hover(wrapper);
    expect(getTooltip()).toBeNull();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(getTooltip()?.textContent).toContain("Import files");

    await user.unhover(wrapper);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(getTooltip()).toBeNull();
  });

  test("shows immediately on keyboard focus", async () => {
    renderTooltip(
      <Tooltip label="Settings" shortcut="⌘,">
        <button type="button">Settings</button>
      </Tooltip>,
    );

    act(() => {
      container
        .querySelector("button")
        ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    await flushEffects();

    expect(getTooltip()?.textContent).toContain("Settings");
    expect(getTooltip()?.textContent).toContain("⌘,");
  });

  test("works with the fallback coordinator when no provider is mounted", async () => {
    renderTooltip(
      <Tooltip label="Offline tooltip">
        <button type="button">Action</button>
      </Tooltip>,
      { withProvider: false },
    );

    act(() => {
      container
        .querySelector("button")
        ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    await flushEffects();

    expect(getTooltip()?.textContent).toContain("Offline tooltip");
  });

  test("force-hides the previous tooltip when another one opens", async () => {
    renderTooltip(
      <>
        <Tooltip label="First action">
          <button type="button">First</button>
        </Tooltip>
        <Tooltip label="Second action">
          <button type="button">Second</button>
        </Tooltip>
      </>,
    );

    const buttons = container.querySelectorAll("button");
    act(() => {
      buttons[0]?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    await flushEffects();
    expect(getTooltip()?.textContent).toContain("First action");

    act(() => {
      buttons[1]?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    await flushEffects();

    const tooltips = document.body.querySelectorAll('[role="tooltip"]');
    expect(tooltips.length).toBe(1);
    expect(tooltips[0]?.textContent).toContain("Second action");
  });

  test("does not error when leaving before a delayed hover tooltip opens", async () => {
    renderTooltip(
      <Tooltip label="Late tooltip" delayDuration={50}>
        <button type="button">Late</button>
      </Tooltip>,
    );

    const wrapper = container.querySelector("span.inline-flex") as HTMLElement;
    await user.hover(wrapper);
    await user.unhover(wrapper);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 130));
    });

    expect(getTooltip()).toBeNull();
  });
});
