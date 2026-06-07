import { describe, expect, it } from "vitest";
import {
  getErrorHelp,
  buildGitHubIssueUrl,
} from "@/app/lib/error-help";

describe("getErrorHelp", () => {
  it("returns backend start failure help for BACKEND_START_FAILED", () => {
    const result = getErrorHelp("BACKEND_START_FAILED");
    expect(result.title).toBe("Backend failed to start");
    expect(result.url).toContain("github.com");
    expect(result.url).toContain("labels=backend");
  });

  it("returns model help for MODEL_NOT_FOUND", () => {
    const result = getErrorHelp("MODEL_NOT_FOUND");
    expect(result.title).toBe("Model not found");
    expect(result.url).toContain("labels=model");
  });

  it("returns generation help for GENERATION_FAILED", () => {
    const result = getErrorHelp("GENERATION_FAILED");
    expect(result.title).toBe("Generation failed");
    expect(result.url).toContain("labels=generation");
  });

  it("returns fallback for unknown error codes", () => {
    const result = getErrorHelp("UNKNOWN_CODE");
    expect(result.title).toBe("Report an issue");
    expect(result.url).toContain("labels=bug");
  });

  it("returns fallback for empty string", () => {
    const result = getErrorHelp("");
    expect(result.title).toBe("Report an issue");
  });

  it("returns distinct titles for every known code", () => {
    const codes = [
      "BACKEND_START_FAILED",
      "BACKEND_HEALTH_TIMEOUT",
      "MODEL_NOT_FOUND",
      "MODEL_DOWNLOAD_FAILED",
      "TASK_SUBMIT_FAILED",
      "TASK_FAILED",
      "AUDIO_DOWNLOAD_FAILED",
      "OUTPUT_WRITE_FAILED",
      "OUTPUT_READ_FAILED",
      "DB_WRITE_FAILED",
      "DB_READ_FAILED",
      "VALIDATION_FAILED",
      "MODEL_REQUIRED",
      "GENERATION_FAILED",
    ];
    for (const code of codes) {
      const result = getErrorHelp(code);
      expect(result.title).toBeTruthy();
      expect(result.url).toBeTruthy();
    }
  });
});

describe("buildGitHubIssueUrl", () => {
  it("builds a URL with code and message in the body", () => {
    const url = buildGitHubIssueUrl({
      code: "MODEL_NOT_FOUND",
      message: "Model not found on disk",
    });
    expect(url).toContain("github.com");
    expect(url).toContain("issues/new");
    expect(url).toContain("MODEL_NOT_FOUND");
    expect(url).toContain("Model+not+found+on+disk");
  });

  it("includes details when provided", () => {
    const url = buildGitHubIssueUrl({
      code: "ERR",
      message: "Something broke",
      details: "Stack trace here",
    });
    expect(url).toContain("Stack+trace+here");
  });

  it("omits details line when not provided", () => {
    const withDetails = buildGitHubIssueUrl({
      code: "ERR",
      message: "msg",
      details: "extra",
    });
    const withoutDetails = buildGitHubIssueUrl({
      code: "ERR",
      message: "msg",
    });
    expect(withoutDetails.length).toBeLessThan(withDetails.length);
  });

  it("includes the bug_report template and bug label", () => {
    const url = buildGitHubIssueUrl({
      code: "X",
      message: "Y",
    });
    expect(url).toContain("template=bug_report.md");
    expect(url).toContain("labels=bug");
  });
});
