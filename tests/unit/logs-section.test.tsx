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

describe("LogsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no logs", async () => {
    mockGetAppLogs.mockResolvedValue([]);
    render(<LogsSection />);
    await screen.findByText("settings.noLogs");
    expect(mockGetAppLogs).toHaveBeenCalledWith("info", 200);
  });

  it("renders log entries with level and message", async () => {
    mockGetAppLogs.mockResolvedValue([
      {
        timestamp: "2026-07-04T12:00:00Z",
        level: "error",
        target: "backend",
        fields: { message: "backend failed" },
        raw: '{"level":"error"}',
      },
      {
        timestamp: "2026-07-04T11:00:00Z",
        level: "info",
        target: "app",
        fields: { message: "started" },
        raw: '{"level":"info"}',
      },
    ]);
    render(<LogsSection />);
    await screen.findByText("backend failed");
    expect(screen.getByText("started")).toBeInTheDocument();
    // Level badges are in spans with uppercase class (not in the <select> options)
    const levelBadges = screen.getAllByText(/^(error|info)$/).filter((el) => el.tagName === "SPAN");
    expect(levelBadges).toHaveLength(2);
    expect(levelBadges.some((el) => el.textContent === "error")).toBe(true);
    expect(levelBadges.some((el) => el.textContent === "info")).toBe(true);
  });

  it("re-fetches when level filter changes", async () => {
    const user = userEvent.setup();
    mockGetAppLogs.mockResolvedValue([]);
    render(<LogsSection />);
    await screen.findByText("settings.noLogs");
    expect(mockGetAppLogs).toHaveBeenLastCalledWith("info", 200);

    const select = screen.getByDisplayValue("info");
    await user.selectOptions(select, "warn");

    expect(mockGetAppLogs).toHaveBeenLastCalledWith("warn", 200);
  });
});
