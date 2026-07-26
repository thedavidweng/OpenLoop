import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const getNetworkLog = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => true,
  getNetworkLog: (...args: unknown[]) => getNetworkLog(...args),
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
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

import { NetworkActivitySection } from "@/app/components/settings/sections/NetworkActivitySection";

describe("NetworkActivitySection", () => {
  beforeEach(() => {
    getNetworkLog.mockReset();
  });

  it("renders empty state when no entries exist", async () => {
    getNetworkLog.mockResolvedValue([]);

    render(<NetworkActivitySection />);

    await waitFor(() => {
      expect(screen.getByText("settings.noNetworkActivity")).toBeTruthy();
    });
  });

  it("renders network entries in a table", async () => {
    getNetworkLog.mockResolvedValue([
      {
        timestamp: "2026-06-10T12:00:00Z",
        url: "https://huggingface.co/ACE-Step/model/resolve/main/weights.bin",
        method: "GET",
        status: 200,
      },
      {
        timestamp: "2026-06-10T12:01:00Z",
        url: "https://api.github.com/repos/ACE-Step/ACE-Step-1.5/releases/latest",
        method: "GET",
        status: 200,
      },
    ]);

    render(<NetworkActivitySection />);

    await waitFor(() => {
      const methodCells = screen.getAllByText("GET");
      expect(methodCells).toHaveLength(2);
      expect(screen.getByText(/huggingface/)).toBeTruthy();
      expect(screen.getByText(/api\.github/)).toBeTruthy();
    });
  });

  it("refreshes when refresh button is clicked", async () => {
    getNetworkLog.mockResolvedValue([]);

    render(<NetworkActivitySection />);

    await waitFor(() => {
      expect(getNetworkLog).toHaveBeenCalledTimes(1);
    });

    const refreshButton = screen.getByText("settings.refresh");
    await userEvent.click(refreshButton);

    await waitFor(() => {
      expect(getNetworkLog).toHaveBeenCalledTimes(2);
    });
  });

  it("displays status codes with appropriate color", async () => {
    getNetworkLog.mockResolvedValue([
      {
        timestamp: "2026-06-10T12:00:00Z",
        url: "https://ok.example.com",
        method: "GET",
        status: 200,
      },
      {
        timestamp: "2026-06-10T12:01:00Z",
        url: "https://err.example.com",
        method: "POST",
        status: 404,
      },
    ]);

    render(<NetworkActivitySection />);

    await waitFor(() => {
      const okStatus = screen.getByText("200");
      expect(okStatus.className).toContain("text-green-400");
      const errStatus = screen.getByText("404");
      expect(errStatus.className).toContain("text-[var(--color-destructive)]");
    });
  });
});
