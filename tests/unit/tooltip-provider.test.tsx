import { act, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  useTooltipDelayCoordinator,
  type TooltipDelayCoordinator,
} from "@/app/components/overlay/Tooltip.context";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { TooltipProvider } from "@/app/components/overlay/TooltipProvider";

describe("useTooltipDelayCoordinator (fallback)", () => {
  let container: HTMLDivElement;
  let coordinator: TooltipDelayCoordinator | null = null;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    coordinator = null;
  });

  afterEach(() => {
    container.remove();
  });

  test("returns a no-op fallback coordinator outside a provider", () => {
    function Probe() {
      const value = useTooltipDelayCoordinator();
      useEffect(() => {
        coordinator = value;
      }, [value]);
      return null;
    }

    const root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });

    expect(coordinator?.isSkipDelayActive()).toBe(false);

    expect(() => {
      coordinator?.registerTooltip("tooltip-1", () => {});
      coordinator?.markOpened("tooltip-1");
      coordinator?.markClosed();
      coordinator?.cancelClose();
      coordinator?.unregisterTooltip("tooltip-1");
    }).not.toThrow();

    expect(coordinator?.isSkipDelayActive()).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  test("returns the same fallback coordinator across re-renders", () => {
    function Probe() {
      const value = useTooltipDelayCoordinator();
      useEffect(() => {
        coordinator = value;
      }, [value]);
      return null;
    }

    const root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
    const firstCoordinator = coordinator;

    act(() => {
      root.render(<Probe />);
    });

    expect(coordinator).toBe(firstCoordinator);

    act(() => {
      root.unmount();
    });
  });
});

describe("TooltipProvider", () => {
  let container: HTMLDivElement;
  let coordinator: TooltipDelayCoordinator | null = null;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    coordinator = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
  });

  function renderProviderTree(children: ReactNode) {
    function Probe() {
      const value = useTooltipDelayCoordinator();
      useEffect(() => {
        coordinator = value;
      }, [value]);
      return null;
    }

    const root = createRoot(container);
    act(() => {
      root.render(
        <TooltipProvider>
          {children}
          <Probe />
        </TooltipProvider>,
      );
    });
    return root;
  }

  function renderProvider() {
    return renderProviderTree(null);
  }

  test("activates skip-delay after a tooltip opens and force-hides others", () => {
    const root = renderProvider();
    const forceHide = vi.fn();

    coordinator?.registerTooltip("tooltip-a", forceHide);
    expect(coordinator?.isSkipDelayActive()).toBe(false);

    coordinator?.markOpened("tooltip-a");
    expect(coordinator?.isSkipDelayActive()).toBe(true);
    expect(forceHide).not.toHaveBeenCalled();

    coordinator?.markOpened("tooltip-b");
    expect(forceHide).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  test("resets skip-delay after the configured close window", () => {
    vi.useFakeTimers();
    const root = renderProvider();

    coordinator?.markOpened("tooltip-a");
    expect(coordinator?.isSkipDelayActive()).toBe(true);

    coordinator?.markClosed();
    expect(coordinator?.isSkipDelayActive()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(coordinator?.isSkipDelayActive()).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  test("cancelClose keeps skip-delay active while moving between triggers", () => {
    vi.useFakeTimers();
    const root = renderProvider();

    coordinator?.markOpened("tooltip-a");
    coordinator?.markClosed();
    coordinator?.cancelClose();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(coordinator?.isSkipDelayActive()).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  test("unregisters tooltip force-hide handlers", () => {
    const root = renderProvider();
    const forceHide = vi.fn();

    coordinator?.registerTooltip("tooltip-a", forceHide);
    coordinator?.unregisterTooltip("tooltip-a");
    coordinator?.markOpened("tooltip-b");

    expect(forceHide).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  test("resets bookkeeping when the provider unmounts", () => {
    vi.useFakeTimers();
    const root = renderProvider();

    coordinator?.markOpened("tooltip-a");
    expect(coordinator?.isSkipDelayActive()).toBe(true);

    act(() => {
      root.unmount();
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const remounted = renderProvider();
    expect(coordinator?.isSkipDelayActive()).toBe(false);

    act(() => {
      remounted.unmount();
    });
  });

  test("resets skip-delay when a visible tooltip unmounts", () => {
    vi.useFakeTimers();

    function RemovableTooltip() {
      const [mounted, setMounted] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setMounted(false)}>
            Remove
          </button>
          {mounted ? (
            <Tooltip label="Temporary">
              <button type="button">Trigger</button>
            </Tooltip>
          ) : null}
        </>
      );
    }

    const root = renderProviderTree(<RemovableTooltip />);

    const trigger = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Trigger",
    );
    act(() => {
      trigger?.focus();
    });
    expect(coordinator?.isSkipDelayActive()).toBe(true);

    act(() => {
      container.querySelector("button")?.click();
    });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(coordinator?.isSkipDelayActive()).toBe(false);

    act(() => {
      root.unmount();
    });
  });
});
