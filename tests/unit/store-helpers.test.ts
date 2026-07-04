import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/i18n", () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    if (opts && "defaultValue" in opts) return opts.defaultValue as string;
    if (key === "generation.variationProgress") {
      return `${opts?.current}/${opts?.total}`;
    }
    if (key === "status.ready") return "Ready";
    return key;
  };
  return { default: { t }, tr: t };
});

const { PREVIEW_DELAY_MS, sleep, variationLabel, createIdleGenerationState } =
  await import("@/app/lib/store-helpers");

describe("PREVIEW_DELAY_MS", () => {
  it("has expected delay values", () => {
    expect(PREVIEW_DELAY_MS.validating).toBe(350);
    expect(PREVIEW_DELAY_MS.running).toBe(1100);
  });
});

describe("variationLabel", () => {
  it("returns empty string when variationCurrent is missing", () => {
    expect(variationLabel({ variationTotal: 3 })).toBe("");
  });

  it("returns empty string when variationTotal is missing", () => {
    expect(variationLabel({ variationCurrent: 1 })).toBe("");
  });

  it("returns empty string when variationTotal is 1", () => {
    expect(variationLabel({ variationCurrent: 1, variationTotal: 1 })).toBe("");
  });

  it("returns a label with current/total when both are present and total > 1", () => {
    const label = variationLabel({
      variationCurrent: 2,
      variationTotal: 4,
    });
    expect(label).toBe(" 2/4");
  });

  it("returns empty string when variationCurrent is 0", () => {
    expect(variationLabel({ variationCurrent: 0, variationTotal: 3 })).toBe("");
  });
});

describe("createIdleGenerationState", () => {
  it("returns an idle generation state", () => {
    const state = createIdleGenerationState();
    expect(state.status).toBe("idle");
    expect(state.phase).toBe("idle");
    expect(state.error).toBeNull();
    expect(typeof state.statusMessage).toBe("string");
  });
});

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the specified delay", async () => {
    const spy = vi.fn();
    const promise = sleep(500).then(spy);

    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(spy).toHaveBeenCalledOnce();
  });

  it("does not resolve before the delay", async () => {
    const spy = vi.fn();
    sleep(1000).then(spy);

    await vi.advanceTimersByTimeAsync(500);
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(spy).toHaveBeenCalledOnce();
  });
});
