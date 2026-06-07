import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/i18n", () => ({
  default: {
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "defaultValue" in opts) return opts.defaultValue as string;
      return key;
    },
  },
}));

const {
  stringifyUnknownError,
  localizeAppError,
  createValidationError,
  createPreviewRuntimeError,
  createModelRequiredError,
} = await import("@/app/lib/errors");

describe("stringifyUnknownError", () => {
  it("returns message from an Error object", () => {
    expect(stringifyUnknownError(new Error("boom"))).toBe("boom");
  });

  it("returns the string itself when given a string", () => {
    expect(stringifyUnknownError("oops")).toBe("oops");
  });

  it("stringifies a number", () => {
    expect(stringifyUnknownError(42)).toBe("42");
  });

  it("stringifies null", () => {
    expect(stringifyUnknownError(null)).toBe("null");
  });

  it("stringifies undefined", () => {
    expect(stringifyUnknownError(undefined)).toBe(undefined);
  });

  it("stringifies a plain object", () => {
    expect(stringifyUnknownError({ foo: "bar" })).toBe('{"foo":"bar"}');
  });

  it("falls back to String() for objects with circular references", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = stringifyUnknownError(circular);
    expect(result).toBe(String(circular));
  });
});

describe("localizeAppError", () => {
  it("coerces an Error into an AppError with default code", () => {
    const err = localizeAppError(new Error("bad"));
    expect(err.code).toBe("GENERATION_FAILED");
    expect(err.message).toBeDefined();
    expect(err.recoverable).toBe(true);
  });

  it("uses the fallback code when provided", () => {
    const err = localizeAppError("fail", "CUSTOM_CODE");
    expect(err.code).toBe("CUSTOM_CODE");
  });

  it("preserves code and message from an object with those properties", () => {
    const err = localizeAppError({
      code: "SOME_CODE",
      message: "some message",
    });
    expect(err.code).toBe("SOME_CODE");
    expect(err.message).toBe("some message");
  });

  it("sets details from object when present", () => {
    const err = localizeAppError({
      code: "X",
      message: "msg",
      details: "extra info",
    });
    expect(err.details).toBe("extra info");
  });

  it("handles non-object errors by stringifying them as details", () => {
    const err = localizeAppError(404);
    expect(err.code).toBe("GENERATION_FAILED");
    expect(err.details).toBe("404");
  });

  it("marks recoverable from the source object when present", () => {
    const err = localizeAppError({
      code: "X",
      message: "msg",
      recoverable: false,
    });
    expect(err.recoverable).toBe(false);
  });
});

describe("createValidationError", () => {
  it("returns an AppError with VALIDATION_FAILED code", () => {
    const err = createValidationError("prompt required");
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.message).toBe("prompt required");
    expect(err.recoverable).toBe(true);
  });

  it("populates details via i18n", () => {
    const err = createValidationError("test");
    expect(err.details).toBeDefined();
    expect(typeof err.details).toBe("string");
  });
});

describe("createPreviewRuntimeError", () => {
  it("returns an AppError with PREVIEW_GENERATION_FAILED code", () => {
    const err = createPreviewRuntimeError();
    expect(err.code).toBe("PREVIEW_GENERATION_FAILED");
    expect(err.recoverable).toBe(true);
    expect(typeof err.message).toBe("string");
    expect(typeof err.details).toBe("string");
  });
});

describe("createModelRequiredError", () => {
  it("returns an AppError with MODEL_REQUIRED code", () => {
    const err = createModelRequiredError();
    expect(err.code).toBe("MODEL_REQUIRED");
    expect(err.recoverable).toBe(true);
    expect(typeof err.message).toBe("string");
    expect(typeof err.details).toBe("string");
  });
});
