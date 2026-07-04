import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationRequest } from "@/app/lib/types";

vi.mock("@/app/lib/i18n", () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    if (opts && "defaultValue" in opts) return opts.defaultValue as string;
    return key;
  };
  return { default: { t }, tr: t };
});

const { shouldPreviewFail, createGenerationRecord } = await import("@/app/lib/preview-record");

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    prompt: "ambient piano",
    lyrics: "",
    vocalLanguage: "en",
    durationSeconds: 30,
    timeSignature: "4",
    audioFormat: "wav",
    taskType: "text2music",
    thinking: true,
    inferenceSteps: 8,
    guidanceScale: 7,
    useFormat: false,
    useCotCaption: true,
    useCotLanguage: true,
    constrainedDecoding: true,
    useRandomSeed: false,
    variationCount: 1,
    ...overrides,
  };
}

describe("shouldPreviewFail", () => {
  it("returns false for a normal request", () => {
    expect(shouldPreviewFail(makeRequest())).toBe(false);
  });

  it('returns true when prompt contains "fail"', () => {
    expect(shouldPreviewFail(makeRequest({ prompt: "fail this test" }))).toBe(true);
  });

  it('returns true when lyrics contain "fail"', () => {
    expect(shouldPreviewFail(makeRequest({ lyrics: "I will fail" }))).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(shouldPreviewFail(makeRequest({ prompt: "FAIL" }))).toBe(true);
    expect(shouldPreviewFail(makeRequest({ prompt: "Fail" }))).toBe(true);
  });

  it('returns true when "fail" is part of a larger word', () => {
    expect(shouldPreviewFail(makeRequest({ prompt: "failure is ok" }))).toBe(true);
  });

  it("returns false when neither prompt nor lyrics contain fail", () => {
    expect(shouldPreviewFail(makeRequest({ prompt: "happy", lyrics: "success" }))).toBe(false);
  });
});

describe("createGenerationRecord", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid-0000-0000-000000000000");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("generates an id and createdAt from crypto and Date", () => {
    const record = createGenerationRecord(makeRequest());
    expect(record.id).toBe("test-uuid-0000-0000-000000000000");
    expect(record.createdAt).toBe("2026-01-15T12:00:00.000Z");
  });

  it("copies prompt and lyrics from the request", () => {
    const record = createGenerationRecord(makeRequest({ prompt: "jazz", lyrics: "la la la" }));
    expect(record.prompt).toBe("jazz");
    expect(record.lyrics).toBe("la la la");
  });

  it("copies numeric parameters from the request", () => {
    const record = createGenerationRecord(makeRequest({ durationSeconds: 60, bpm: 120, seed: 42 }));
    expect(record.durationSeconds).toBe(60);
    expect(record.bpm).toBe(120);
    expect(record.seed).toBe(42);
  });

  it("sets default status and error fields", () => {
    const record = createGenerationRecord(makeRequest());
    expect(record.status).toBe("completed");
    expect(record.errorMessage).toBeNull();
    expect(record.isFavorite).toBe(false);
  });

  it("constructs outputPath using the generated id and audio format", () => {
    const record = createGenerationRecord(makeRequest({ audioFormat: "mp3" }));
    expect(record.outputPath).toBe("/preview-output/test-uuid-0000-0000-000000000000.mp3");
  });

  it("sets generationInfo from i18n", () => {
    const record = createGenerationRecord(makeRequest());
    expect(record.generationInfo).toBeDefined();
    expect(typeof record.generationInfo).toBe("string");
  });

  it("copies optional taskType and model fields", () => {
    const record = createGenerationRecord(
      makeRequest({ taskType: "text2music", model: "acestep-v15-turbo" }),
    );
    expect(record.taskType).toBe("text2music");
    expect(record.model).toBe("acestep-v15-turbo");
  });
});
