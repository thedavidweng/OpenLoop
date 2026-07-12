import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Tooltip } from "@/app/components/overlay/Tooltip";

// Tooltip uses createPortal — ensure document.body is available (jsdom provides it)
// No mocks needed — we test the real Tooltip component.

describe("Tooltip — aria-describedby cloneElement (lines 47-48)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("sets aria-describedby on the child element when tooltip is opened via focus", () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    // Focus the child to open the tooltip (dispatches focus event)
    fireEvent.focus(button);

    // The tooltip should be open and the child should have aria-describedby
    expect(button.getAttribute("aria-describedby")).not.toBeNull();
    expect(button.getAttribute("aria-describedby")?.length).toBeGreaterThan(0);
  });

  it("does not set aria-describedby when tooltip is closed", () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    // Tooltip is closed initially — no aria-describedby
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("sets aria-describedby when tooltip is opened via mouse enter", () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    const anchorSpan = button.parentElement!;
    fireEvent.mouseEnter(anchorSpan);

    expect(button.getAttribute("aria-describedby")).not.toBeNull();
  });

  it("removes aria-describedby when tooltip closes after blur", () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    // Open via focus
    fireEvent.focus(button);
    expect(button.getAttribute("aria-describedby")).not.toBeNull();

    // Close via blur (with no relatedTarget, so it's not contained)
    fireEvent.blur(button);
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("Tooltip — onBlurCapture relatedTarget containment (lines 107-110)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps tooltip open when blur relatedTarget is contained within the anchor", () => {
    render(
      <Tooltip label="Help text">
        <button type="button" id="child-btn">
          Hover me
        </button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    const anchorSpan = button.parentElement!;

    // Open the tooltip via focus
    fireEvent.focus(button);
    expect(button.getAttribute("aria-describedby")).not.toBeNull();

    // Create a FocusEvent with relatedTarget pointing to the anchor span itself
    // (which is contained within the anchor ref).  We use fireEvent with a
    // pre-constructed FocusEvent so React's event delegation picks it up.
    const focusOutEvent = new FocusEvent("focusout", {
      bubbles: true,
      cancelable: true,
      relatedTarget: anchorSpan,
    });
    fireEvent(button, focusOutEvent);

    // Tooltip should remain open because relatedTarget is contained
    expect(button.getAttribute("aria-describedby")).not.toBeNull();
  });

  it("closes tooltip when blur relatedTarget is outside the anchor", () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");

    // Open the tooltip via focus
    fireEvent.focus(button);
    expect(button.getAttribute("aria-describedby")).not.toBeNull();

    // fireEvent.blur dispatches a blur event; relatedTarget will be null
    // (not an instance of Node), so the handler proceeds to close the tooltip
    fireEvent.blur(button);

    // Tooltip should close because relatedTarget is not a contained Node
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("closes tooltip on Escape key when open", () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");

    // Open via focus
    fireEvent.focus(button);
    expect(button.getAttribute("aria-describedby")).not.toBeNull();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });

    // Tooltip should close
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("closes tooltip on pointer leave", () => {
    render(
      <Tooltip label="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    const anchorSpan = button.parentElement!;

    // Open via mouse enter
    fireEvent.mouseEnter(anchorSpan);
    expect(button.getAttribute("aria-describedby")).not.toBeNull();

    // Close via mouse leave
    fireEvent.mouseLeave(anchorSpan);
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("renders the label text in the portal when open", () => {
    render(
      <Tooltip label="My tooltip label">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    fireEvent.focus(button);

    // The tooltip content is portaled to document.body
    expect(screen.getByText("My tooltip label")).toBeTruthy();
  });

  it("renders the shortcut text when provided", () => {
    render(
      <Tooltip label="My tooltip" shortcut="⌘K">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const button = screen.getByText("Hover me");
    fireEvent.focus(button);

    expect(screen.getByText("⌘K")).toBeTruthy();
  });
});
