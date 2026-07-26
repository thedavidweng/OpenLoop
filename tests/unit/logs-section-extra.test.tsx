import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogsSection } from "@/app/components/settings/sections/LogsSection";

vi.mock("@/app/lib/api", () => ({
  getAppLogs: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

import * as api from "@/app/lib/api";

const mockGetAppLogs = vi.mocked(api.getAppLogs);

describe("LogsSection — isLevel type guard and level color branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Covers isLevel function (lines 9, 11-12) and onChange handler (lines 53, 55)
  it("calls getAppLogs with the new level when a valid level is selected", async () => {
    const user = userEvent.setup();
    mockGetAppLogs.mockResolvedValue([]);
    render(<LogsSection />);
    await screen.findByText("settings.noLogs");
    expect(mockGetAppLogs).toHaveBeenCalledWith("info", 200);

    const select = screen.getByDisplayValue("info");
    await user.selectOptions(select, "debug");

    expect(mockGetAppLogs).toHaveBeenLastCalledWith("debug", 200);
  });

  it("calls getAppLogs with trace level when trace is selected", async () => {
    const user = userEvent.setup();
    mockGetAppLogs.mockResolvedValue([]);
    render(<LogsSection />);
    await screen.findByText("settings.noLogs");

    const select = screen.getByDisplayValue("info");
    await user.selectOptions(select, "trace");

    expect(mockGetAppLogs).toHaveBeenLastCalledWith("trace", 200);
  });

  // Covers line 90 — isLevel(entry.level) true branch with various valid levels
  it("renders entries with valid levels using level-specific colors", async () => {
    mockGetAppLogs.mockResolvedValue([
      {
        timestamp: "2026-07-04T12:00:00Z",
        level: "error",
        target: "backend",
        fields: { message: "error msg" },
        raw: '{"level":"error"}',
      },
      {
        timestamp: "2026-07-04T12:01:00Z",
        level: "warn",
        target: "app",
        fields: { message: "warn msg" },
        raw: '{"level":"warn"}',
      },
      {
        timestamp: "2026-07-04T12:02:00Z",
        level: "debug",
        target: "app",
        fields: { message: "debug msg" },
        raw: '{"level":"debug"}',
      },
      {
        timestamp: "2026-07-04T12:03:00Z",
        level: "trace",
        target: "app",
        fields: { message: "trace msg" },
        raw: '{"level":"trace"}',
      },
    ]);
    render(<LogsSection />);
    await screen.findByText("error msg");
    expect(screen.getByText("warn msg")).toBeInTheDocument();
    expect(screen.getByText("debug msg")).toBeInTheDocument();
    expect(screen.getByText("trace msg")).toBeInTheDocument();

    // Verify level badges are rendered as spans
    const levelBadges = screen
      .getAllByText(/^(error|warn|debug|trace)$/)
      .filter((el) => el.tagName === "SPAN");
    expect(levelBadges).toHaveLength(4);
  });

  // Covers line 90 — isLevel(entry.level) false branch (invalid level)
  it("renders entries with invalid levels using fallback white color", async () => {
    mockGetAppLogs.mockResolvedValue([
      {
        timestamp: "2026-07-04T12:00:00Z",
        level: "fatal",
        target: "backend",
        fields: { message: "fatal msg" },
        raw: '{"level":"fatal"}',
      },
    ]);
    render(<LogsSection />);
    await screen.findByText("fatal msg");

    // The level badge span should exist for the invalid level
    const levelBadge = screen.getAllByText("fatal").find((el) => el.tagName === "SPAN");
    expect(levelBadge).toBeTruthy();
    // The className should contain the default text token (fallback for invalid level)
    expect(levelBadge?.className).toContain("text-[var(--color-text)]");
  });

  // Covers line 90 — isLevel true branch with info level (levelColor[entry.level])
  it("renders info level entries with white text color", async () => {
    mockGetAppLogs.mockResolvedValue([
      {
        timestamp: "2026-07-04T12:00:00Z",
        level: "info",
        target: "app",
        fields: { message: "info msg" },
        raw: '{"level":"info"}',
      },
    ]);
    render(<LogsSection />);
    await screen.findByText("info msg");

    const infoBadge = screen.getAllByText("info").find((el) => el.tagName === "SPAN");
    expect(infoBadge).toBeTruthy();
    expect(infoBadge?.className).toContain("text-[var(--color-text)]");
  });

  // Covers line 90 — isLevel true branch with error level (red color)
  it("renders error level entries with red text color", async () => {
    mockGetAppLogs.mockResolvedValue([
      {
        timestamp: "2026-07-04T12:00:00Z",
        level: "error",
        target: "backend",
        fields: { message: "error msg" },
        raw: '{"level":"error"}',
      },
    ]);
    render(<LogsSection />);
    await screen.findByText("error msg");

    const errorBadge = screen.getAllByText("error").find((el) => el.tagName === "SPAN");
    expect(errorBadge).toBeTruthy();
    expect(errorBadge?.className).toContain("text-[var(--color-destructive)]");
  });

  // Covers line 90 — isLevel true branch with warn level (yellow color)
  it("renders warn level entries with yellow text color", async () => {
    mockGetAppLogs.mockResolvedValue([
      {
        timestamp: "2026-07-04T12:00:00Z",
        level: "warn",
        target: "app",
        fields: { message: "warn msg" },
        raw: '{"level":"warn"}',
      },
    ]);
    render(<LogsSection />);
    await screen.findByText("warn msg");

    const warnBadge = screen.getAllByText("warn").find((el) => el.tagName === "SPAN");
    expect(warnBadge).toBeTruthy();
    expect(warnBadge?.className).toContain("text-yellow-400");
  });
});
