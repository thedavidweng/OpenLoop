import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_SHORTCUTS,
  getShortcutDisplay,
  getShortcutPlatform,
  isInputFocused,
  matchesShortcut,
  shouldHandleGlobalShortcut,
  type ShortcutDefinition,
} from "@/app/lib/app-shortcuts";

function keyboardEvent(init: KeyboardEventInit) {
  return new KeyboardEvent("keydown", init);
}

const originalActiveElementDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  "activeElement",
);

function mockActiveElement(el: Element | null) {
  Object.defineProperty(Document.prototype, "activeElement", {
    get: () => el,
    configurable: true,
  });
}

function restoreActiveElement() {
  if (originalActiveElementDescriptor) {
    Object.defineProperty(Document.prototype, "activeElement", originalActiveElementDescriptor);
  }
}

afterEach(() => {
  document.body.innerHTML = "";
  restoreActiveElement();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getShortcutPlatform
// ---------------------------------------------------------------------------
describe("getShortcutPlatform", () => {
  it("returns mac when userAgentData.platform contains mac", () => {
    vi.stubGlobal("navigator", {
      userAgentData: { platform: "macOS" },
      platform: "MacIntel",
    });
    expect(getShortcutPlatform()).toBe("mac");
  });

  it("returns mac when userAgentData is absent and navigator.platform contains mac", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(getShortcutPlatform()).toBe("mac");
  });

  it("returns windows when userAgentData.platform contains win", () => {
    vi.stubGlobal("navigator", {
      userAgentData: { platform: "Windows" },
      platform: "Win32",
    });
    expect(getShortcutPlatform()).toBe("windows");
  });

  it("returns windows when userAgentData is absent and navigator.platform contains win", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(getShortcutPlatform()).toBe("windows");
  });

  it("returns linux for an unrecognized platform", () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    expect(getShortcutPlatform()).toBe("linux");
  });

  it("returns linux when navigator is unavailable (SSR-like)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(getShortcutPlatform()).toBe("linux");
  });
});

// ---------------------------------------------------------------------------
// getShortcutDisplay
// ---------------------------------------------------------------------------
describe("getShortcutDisplay", () => {
  it("returns only displayKey when requiresPrimaryModifier is false", () => {
    expect(getShortcutDisplay(APP_SHORTCUTS.togglePlayback, "mac")).toBe("Space");
    expect(getShortcutDisplay(APP_SHORTCUTS.togglePlayback, "windows")).toBe("Space");
  });

  it("prepends ⌘ on mac", () => {
    expect(getShortcutDisplay(APP_SHORTCUTS.toggleSidebar, "mac")).toBe("⌘B");
  });

  it("prepends Ctrl+ on windows", () => {
    expect(getShortcutDisplay(APP_SHORTCUTS.toggleSidebar, "windows")).toBe("Ctrl+B");
  });

  it("prepends Ctrl+ on linux", () => {
    expect(getShortcutDisplay(APP_SHORTCUTS.newGeneration, "linux")).toBe("Ctrl+N");
  });

  it("detects platform automatically when platform arg is omitted", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(getShortcutDisplay(APP_SHORTCUTS.toggleSidebar)).toBe("⌘B");
  });
});

// ---------------------------------------------------------------------------
// isInputFocused
// ---------------------------------------------------------------------------
describe("isInputFocused", () => {
  it("returns false when no element is focused", () => {
    mockActiveElement(null);
    expect(isInputFocused()).toBe(false);
  });

  it("returns true for an <input>", () => {
    document.body.innerHTML = "<input />";
    document.querySelector("input")!.focus();
    expect(isInputFocused()).toBe(true);
  });

  it("returns true for a <textarea>", () => {
    document.body.innerHTML = "<textarea></textarea>";
    document.querySelector("textarea")!.focus();
    expect(isInputFocused()).toBe(true);
  });

  it("returns true for a <select>", () => {
    document.body.innerHTML = "<select><option>1</option></select>";
    document.querySelector("select")!.focus();
    expect(isInputFocused()).toBe(true);
  });

  it("returns true for a contentEditable element", () => {
    document.body.innerHTML = '<div contenteditable="true"></div>';
    const div = document.querySelector("div")!;
    // jsdom doesn't implement isContentEditable, so mock it
    Object.defineProperty(div, "isContentEditable", { value: true, configurable: true });
    mockActiveElement(div);
    expect(isInputFocused()).toBe(true);
  });

  it("returns false for a plain <button>", () => {
    document.body.innerHTML = "<button>Click</button>";
    mockActiveElement(document.querySelector("button")!);
    // jsdom may return undefined for isContentEditable; function result is still falsy
    expect(isInputFocused()).toBeFalsy();
  });

  it("returns false for a <div> that is not contentEditable", () => {
    document.body.innerHTML = '<div contenteditable="false"></div>';
    mockActiveElement(document.querySelector("div")!);
    expect(isInputFocused()).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// matchesShortcut
// ---------------------------------------------------------------------------
describe("matchesShortcut", () => {
  it("matches by code with modifier on mac (metaKey)", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyB", key: "b", metaKey: true }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(true);
  });

  it("matches by code with modifier on windows (ctrlKey)", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyB", key: "b", ctrlKey: true }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(true);
  });

  it("returns false when modifier is missing", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyB", key: "b", metaKey: false }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(false);
  });

  it("returns false when shift is pressed but allowShift is not set", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyB", key: "B", metaKey: true, shiftKey: true }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(false);
  });

  it("matches with shift when allowShift is true (retry shortcut)", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyR", key: "R", metaKey: true, shiftKey: true }),
        APP_SHORTCUTS.retryGeneration,
      ),
    ).toBe(true);
  });

  it("matches without shift when allowShift is true", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyR", key: "r", metaKey: true, shiftKey: false }),
        APP_SHORTCUTS.retryGeneration,
      ),
    ).toBe(true);
  });

  it("matches by key when code does not match", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    const def: ShortcutDefinition = {
      id: "test",
      key: "z",
      displayKey: "Z",
    };
    expect(
      matchesShortcut(
        keyboardEvent({ code: "Unidentified", key: "z", metaKey: true }),
        def,
      ),
    ).toBe(true);
  });

  it("matches requiresPrimaryModifier === false without any modifier", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "Space", key: " " }),
        APP_SHORTCUTS.togglePlayback,
      ),
    ).toBe(true);
  });

  it("matches requiresPrimaryModifier === false by key fallback", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "Unidentified", key: " " }),
        APP_SHORTCUTS.togglePlayback,
      ),
    ).toBe(true);
  });

  it("returns false for requiresPrimaryModifier === false when neither code nor key matches", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyX", key: "x" }),
        APP_SHORTCUTS.togglePlayback,
      ),
    ).toBe(false);
  });

  it("returns false when only modifier is pressed with no matching key", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyZ", key: "z", metaKey: true }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(false);
  });

  it("returns false when shortcut has neither code nor key defined", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    const def: ShortcutDefinition = { id: "empty", displayKey: "?" };
    expect(
      matchesShortcut(
        keyboardEvent({ code: "KeyA", key: "a", metaKey: true }),
        def,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldHandleGlobalShortcut (extended)
// ---------------------------------------------------------------------------
describe("global shortcuts", () => {
  it("allows Space playback when focus is outside editable controls", () => {
    document.body.innerHTML = "<button>Play</button>";
    document.querySelector("button")?.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "Space", key: " " }),
        APP_SHORTCUTS.togglePlayback,
      ),
    ).toBe(true);
  });

  it("ignores Space playback while typing in a textarea", () => {
    document.body.innerHTML = "<textarea></textarea>";
    document.querySelector("textarea")?.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "Space", key: " " }),
        APP_SHORTCUTS.togglePlayback,
      ),
    ).toBe(false);
  });

  it("blocks modifier shortcut when an input is focused", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    document.body.innerHTML = "<input />";
    document.querySelector("input")!.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "KeyB", key: "b", metaKey: true }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(false);
  });

  it("blocks modifier shortcut when a select is focused", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    document.body.innerHTML = "<select><option>1</option></select>";
    document.querySelector("select")!.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "KeyN", key: "n", metaKey: true }),
        APP_SHORTCUTS.newGeneration,
      ),
    ).toBe(false);
  });

  it("blocks modifier shortcut when a contentEditable element is focused", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    document.body.innerHTML = '<div contenteditable="true"></div>';
    const div = document.querySelector("div")!;
    Object.defineProperty(div, "isContentEditable", { value: true, configurable: true });
    mockActiveElement(div);

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "KeyB", key: "b", metaKey: true }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(false);
  });

  it("allows Cmd+B toggleSidebar on a button", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    document.body.innerHTML = "<button>Go</button>";
    document.querySelector("button")!.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "KeyB", key: "b", metaKey: true }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(true);
  });

  it("allows Ctrl+Enter submitGeneration on windows", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    document.body.innerHTML = "<button>Go</button>";
    document.querySelector("button")!.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "Enter", key: "Enter", ctrlKey: true }),
        APP_SHORTCUTS.submitGeneration,
      ),
    ).toBe(true);
  });

  it("allows Digit1 compareToggle without modifier (requiresPrimaryModifier === false)", () => {
    document.body.innerHTML = "<button>Go</button>";
    document.querySelector("button")!.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "Digit1", key: "1" }),
        APP_SHORTCUTS.compareToggle,
      ),
    ).toBe(true);
  });

  it("returns false when modifier is missing for a normal shortcut", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    document.body.innerHTML = "<button>Go</button>";
    document.querySelector("button")!.focus();

    expect(
      shouldHandleGlobalShortcut(
        keyboardEvent({ code: "KeyB", key: "b", metaKey: false }),
        APP_SHORTCUTS.toggleSidebar,
      ),
    ).toBe(false);
  });
});
