import { type RefObject } from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "@/app/components/overlay/Toast";

type ToastApi = ReturnType<typeof useToast>;

function Harness({ apiRef }: { apiRef: RefObject<ToastApi | null> }) {
  const api = useToast();
  apiRef.current = api;
  return <div />;
}

function renderWithProvider() {
  const apiRef: RefObject<ToastApi | null> = { current: null };
  const result = render(
    <ToastProvider>
      <Harness apiRef={apiRef} />
    </ToastProvider>,
  );
  return { ...result, api: apiRef as RefObject<ToastApi> };
}

describe("Toast", () => {
  it("renders the toast message", () => {
    const { api } = renderWithProvider();

    act(() => {
      api.current!.addToast("success", "It worked");
    });

    expect(screen.getByText("It worked")).toBeTruthy();
  });

  it("renders different toast types", () => {
    const { api } = renderWithProvider();

    act(() => {
      api.current!.addToast("success", "It worked");
      api.current!.addToast("error", "Something broke");
      api.current!.addToast("info", "Heads up");
    });

    expect(screen.getByText("It worked")).toBeTruthy();
    expect(screen.getByText("Something broke")).toBeTruthy();
    expect(screen.getByText("Heads up")).toBeTruthy();
  });

  it("dismisses when the close button is clicked", () => {
    const { api } = renderWithProvider();

    act(() => {
      api.current!.addToast("success", "It worked");
    });

    const message = screen.getByText("It worked");
    const toastDiv = message.closest("div")!;
    const dismissButton = toastDiv.querySelector("button:last-child")!;

    act(() => {
      fireEvent.click(dismissButton);
    });

    expect(screen.queryByText("It worked")).toBeNull();
  });

  it("auto-closes after the default duration (3000ms)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { api } = renderWithProvider();

    act(() => {
      api.current!.addToast("success", "It worked");
    });
    expect(screen.getByText("It worked")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByText("It worked")).toBeNull();
    });

    vi.useRealTimers();
  });

  it("auto-closes after a custom duration", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { api } = renderWithProvider();

    act(() => {
      api.current!.addToast("info", "Custom duration", { duration: 5000 });
    });
    expect(screen.getByText("Custom duration")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText("Custom duration")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(screen.queryByText("Custom duration")).toBeNull();
    });

    vi.useRealTimers();
  });

  it("renders an action button and calls its onClick", () => {
    const onClick = vi.fn();
    const { api } = renderWithProvider();

    act(() => {
      api.current!.addToast("success", "Saved", { action: { label: "Undo", onClick } });
    });

    const undoButton = screen.getByText("Undo");
    act(() => {
      fireEvent.click(undoButton);
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("cleans up timers on unmount", () => {
    const { api, unmount } = renderWithProvider();

    act(() => {
      api.current!.addToast("success", "Gone soon");
    });

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
