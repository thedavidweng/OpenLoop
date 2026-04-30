import { describe, expect, it } from "vitest";
import {
  APP_SHORTCUTS,
  shouldHandleGlobalShortcut,
} from "@/app/lib/app-shortcuts";

function keyboardEvent(init: KeyboardEventInit) {
  return new KeyboardEvent("keydown", init);
}

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
});
