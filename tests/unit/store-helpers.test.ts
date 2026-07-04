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

const {
  PREVIEW_DELAY_MS,
  sleep,
  variationLabel,
  createIdleGenerationState,
  createFailedGenerationState,
  prependRecentPrompt,
} = await import("@/app/lib/store-helpers");

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

describe("createFailedGenerationState", () => {
  it("returns a failed generation state with the given message and error", () => {
    const error = {
      code: "generation_failed",
      message: "Something went wrong",
      recoverable: true,
    };
    const state = createFailedGenerationState("Generation failed", error);
    expect(state.status).toBe("failed");
    expect(state.phase).toBe("failed");
    expect(state.statusMessage).toBe("Generation failed");
    expect(state.error).toBe(error);
  });
});

describe("prependRecentPrompt", () => {
  it("returns the same list when prompt is empty", () => {
    const list = ["a", "b"];
    expect(prependRecentPrompt(list, "")).toBe(list);
  });

  it("prepends a new prompt and deduplicates", () => {
    expect(prependRecentPrompt(["b", "c"], "a")).toEqual(["a", "b", "c"]);
    expect(prependRecentPrompt(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("caps the list at max entries", () => {
    const list = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const result = prependRecentPrompt(list, "new");
    expect(result).toHaveLength(20);
    expect(result[0]).toBe("new");
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
