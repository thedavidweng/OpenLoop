import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppReadyRuntime } from "@/app/runtime/app-ready-runtime";

const mockWindowReady = vi.fn<() => Promise<void>>();

vi.mock("@/app/lib/api", () => ({
  windowReady: () => mockWindowReady(),
}));

describe("useAppReadyRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWindowReady.mockReset();
    mockWindowReady.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not reveal the window before the app is ready", () => {
    renderHook(() => useAppReadyRuntime(false));

    vi.advanceTimersByTime(500);

    expect(mockWindowReady).not.toHaveBeenCalled();
  });

  it("reveals exactly once when ready, via the timer backstop even without frames", () => {
    const { rerender } = renderHook(({ ready }) => useAppReadyRuntime(ready), {
      initialProps: { ready: false },
    });

    rerender({ ready: true });
    // jsdom's requestAnimationFrame is timer-backed; advancing time fires both
    // the frame and the 120ms backstop — the reveal must still go out once.
    vi.advanceTimersByTime(500);

    expect(mockWindowReady).toHaveBeenCalledTimes(1);
  });

  it("reveals after the hard limit even if the app never becomes ready", () => {
    renderHook(() => useAppReadyRuntime(false));

    vi.advanceTimersByTime(10_000);

    expect(mockWindowReady).toHaveBeenCalledTimes(1);
  });

  it("does not double-reveal when readiness lands after the hard limit", () => {
    const { rerender } = renderHook(({ ready }) => useAppReadyRuntime(ready), {
      initialProps: { ready: false },
    });

    vi.advanceTimersByTime(10_000);
    rerender({ ready: true });
    vi.advanceTimersByTime(500);

    expect(mockWindowReady).toHaveBeenCalledTimes(1);
  });
});
