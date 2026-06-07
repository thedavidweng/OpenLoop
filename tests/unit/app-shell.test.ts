import { describe, expect, it } from "vitest";
import { resolveCurrentAppShellMode } from "@/app/lib/app-shell";

describe("resolveCurrentAppShellMode", () => {
  it("returns full-app", () => {
    expect(resolveCurrentAppShellMode()).toBe("full-app");
  });
});
