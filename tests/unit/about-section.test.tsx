import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const collectDiagnostics = vi.fn();
const copyDebugInfo = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: vi.fn(),
}));

vi.mock("@/app/lib/diagnostics", () => ({
  collectDiagnostics: (...args: unknown[]) => collectDiagnostics(...args),
  copyDebugInfo: (...args: unknown[]) => copyDebugInfo(...args),
  formatBackendStatus: (status: unknown) =>
    status && typeof status === "object" && "state" in status
      ? String((status as { state: unknown }).state)
      : "unknown",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

import { useGenerationStore } from "@/app/lib/store";
import { AboutSection } from "@/app/components/settings/sections/AboutSection";

function setupStore(deviceInfo: unknown) {
  (vi.mocked(useGenerationStore) as any).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) => selector({ deviceInfo }),
  );
}

describe("AboutSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectDiagnostics.mockResolvedValue({
      appVersion: "1.2.3",
      os: "macos",
      arch: "aarch64",
      isAppleSilicon: true,
      totalMemoryGb: 16,
      buildSha: "abc1234",
      appLogDir: "/logs/openloop",
      backendStatus: { state: "healthy", port: 8001 },
      recentErrors: null,
    });
    setupStore({ os: "macOS", arch: "aarch64", isAppleSilicon: true, totalMemoryGb: 16 });
  });

  it("renders the about card with version, system, and repository", async () => {
    render(<AboutSection />);
    expect(screen.getByText("settings.about.title")).toBeTruthy();
    expect(screen.getByText(/OpenLoop unknown|OpenLoop /)).toBeTruthy();
    expect(screen.getByText(/macOS · aarch64 · Apple Silicon/)).toBeTruthy();
    const link = screen.getByText("https://github.com/thedavidweng/OpenLoop");
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "https://github.com/thedavidweng/OpenLoop",
    );
    await waitFor(() => expect(screen.getByText("abc1234")).toBeTruthy());
  });

  it("flips the copy button label to copied after a successful copy", async () => {
    const user = userEvent.setup();
    render(<AboutSection />);
    const button = screen.getByText("settings.about.copyDebugInfo");
    await user.click(button);
    expect(copyDebugInfo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("settings.about.copied")).toBeTruthy());
  });
});
