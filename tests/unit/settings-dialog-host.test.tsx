import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { SettingsDialogHost } from "@/app/components/settings/SettingsDialogHost";
import { SettingsDialogs } from "@/app/components/settings/SettingsDialogs";
import { SettingsSaveBar } from "@/app/components/settings/SettingsSaveBar";

// ---------------------------------------------------------------------------
// SettingsDialogHost
// ---------------------------------------------------------------------------

describe("SettingsDialogHost", () => {
  const baseProps = {
    open: true,
    title: "Confirm Action",
    message: "Are you sure?",
    confirmLabel: "Delete",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and message when open", () => {
    render(<SettingsDialogHost {...baseProps} />);
    expect(screen.getByText("Confirm Action")).toBeTruthy();
    expect(screen.getByText("Are you sure?")).toBeTruthy();
  });

  it("renders nothing when not open", () => {
    const { container } = render(<SettingsDialogHost {...baseProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders confirm and cancel buttons", () => {
    render(<SettingsDialogHost {...baseProps} />);
    expect(screen.getByText("Delete")).toBeTruthy();
    expect(screen.getByText("common.cancel")).toBeTruthy();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsDialogHost {...baseProps} />);
    await user.click(screen.getByText("Delete"));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsDialogHost {...baseProps} />);
    await user.click(screen.getByText("common.cancel"));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("autofocuses the cancel button on mount", () => {
    render(<SettingsDialogHost {...baseProps} />);
    const cancelButton = screen.getByText("common.cancel").closest("button")!;
    expect(document.activeElement).toBe(cancelButton);
  });

  it("calls onCancel when Escape is pressed", () => {
    render(<SettingsDialogHost {...baseProps} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not listen for Escape while closed", () => {
    render(<SettingsDialogHost {...baseProps} open={false} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the backdrop is clicked", () => {
    render(<SettingsDialogHost {...baseProps} />);
    const backdrop = screen.getByRole("dialog").parentElement!;
    fireEvent.click(backdrop);
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not cancel when the panel itself is clicked", () => {
    render(<SettingsDialogHost {...baseProps} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  it("renders into a portal on document.body", () => {
    const { container } = render(<SettingsDialogHost {...baseProps} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SettingsDialogs
// ---------------------------------------------------------------------------

describe("SettingsDialogs", () => {
  const baseProps = {
    clearHistoryOpen: false,
    clearCacheOpen: false,
    deleteAllModelsOpen: false,
    historyCount: 5,
    downloadedModelsCount: 2,
    onDismissClearHistory: vi.fn(),
    onConfirmClearHistory: vi.fn(),
    onDismissClearCache: vi.fn(),
    onConfirmClearCache: vi.fn(),
    onDismissDeleteAllModels: vi.fn(),
    onConfirmDeleteAllModels: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing visible when all dialogs are closed", () => {
    const { container } = render(<SettingsDialogs {...baseProps} />);
    // No dialog content should be visible
    expect(container.querySelector(".fixed")).toBeNull();
  });

  it("shows clear history dialog when clearHistoryOpen is true", () => {
    render(<SettingsDialogs {...baseProps} clearHistoryOpen />);
    expect(screen.getByText("settings.clearHistoryTitle")).toBeTruthy();
  });

  it("shows clear cache dialog when clearCacheOpen is true", () => {
    render(<SettingsDialogs {...baseProps} clearCacheOpen />);
    expect(screen.getByText("settings.clearBackendCacheTitle")).toBeTruthy();
  });

  it("shows delete all models dialog when deleteAllModelsOpen is true", () => {
    render(<SettingsDialogs {...baseProps} deleteAllModelsOpen />);
    expect(screen.getByText("settings.deleteAllModelsTitle")).toBeTruthy();
  });

  it("calls confirm callback from clear history dialog", async () => {
    const user = userEvent.setup();
    render(<SettingsDialogs {...baseProps} clearHistoryOpen />);
    await user.click(screen.getByText("settings.clearHistory"));
    expect(baseProps.onConfirmClearHistory).toHaveBeenCalledTimes(1);
  });

  it("calls dismiss callback from clear history dialog", async () => {
    const user = userEvent.setup();
    render(<SettingsDialogs {...baseProps} clearHistoryOpen />);
    await user.click(screen.getByText("common.cancel"));
    expect(baseProps.onDismissClearHistory).toHaveBeenCalledTimes(1);
  });

  it("calls confirm callback from clear cache dialog", async () => {
    const user = userEvent.setup();
    render(<SettingsDialogs {...baseProps} clearCacheOpen />);
    await user.click(screen.getByText("settings.clearBackendCache"));
    expect(baseProps.onConfirmClearCache).toHaveBeenCalledTimes(1);
  });

  it("calls confirm callback from delete all models dialog", async () => {
    const user = userEvent.setup();
    render(<SettingsDialogs {...baseProps} deleteAllModelsOpen />);
    await user.click(screen.getByText("settings.deleteAllModels"));
    expect(baseProps.onConfirmDeleteAllModels).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SettingsSaveBar
// ---------------------------------------------------------------------------

describe("SettingsSaveBar", () => {
  const baseProps = {
    hasUnsavedChanges: false,
    saveNotice: null,
    backendPortValid: true,
    onSave: vi.fn(),
    onDiscard: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders save and discard buttons", () => {
    render(<SettingsSaveBar {...baseProps} />);
    expect(screen.getByText("settings.save")).toBeTruthy();
    expect(screen.getByText("settings.discardChanges")).toBeTruthy();
  });

  it("shows unsaved changes indicator when hasUnsavedChanges is true", () => {
    render(<SettingsSaveBar {...baseProps} hasUnsavedChanges />);
    expect(screen.getByText("settings.unsavedChanges")).toBeTruthy();
  });

  it("hides unsaved changes indicator when hasUnsavedChanges is false", () => {
    render(<SettingsSaveBar {...baseProps} />);
    expect(screen.queryByText("settings.unsavedChanges")).toBeNull();
  });

  it("shows save notice when provided and no unsaved changes", () => {
    render(<SettingsSaveBar {...baseProps} saveNotice="Settings saved." />);
    expect(screen.getByText("Settings saved.")).toBeTruthy();
  });

  it("prefers unsaved indicator over save notice", () => {
    render(<SettingsSaveBar {...baseProps} hasUnsavedChanges saveNotice="Settings saved." />);
    expect(screen.getByText("settings.unsavedChanges")).toBeTruthy();
    expect(screen.queryByText("Settings saved.")).toBeNull();
  });

  it("disables discard button when no unsaved changes", () => {
    render(<SettingsSaveBar {...baseProps} />);
    const button = screen.getByText("settings.discardChanges").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("enables discard button when there are unsaved changes", () => {
    render(<SettingsSaveBar {...baseProps} hasUnsavedChanges />);
    const button = screen.getByText("settings.discardChanges").closest("button")!;
    expect(button.disabled).toBe(false);
  });

  it("disables save button when no unsaved changes", () => {
    render(<SettingsSaveBar {...baseProps} />);
    const button = screen.getByText("settings.save").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("disables save button when backend port is invalid", () => {
    render(<SettingsSaveBar {...baseProps} hasUnsavedChanges backendPortValid={false} />);
    const button = screen.getByText("settings.save").closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("enables save button when there are unsaved changes and port is valid", () => {
    render(<SettingsSaveBar {...baseProps} hasUnsavedChanges />);
    const button = screen.getByText("settings.save").closest("button")!;
    expect(button.disabled).toBe(false);
  });

  it("calls onSave when save button is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsSaveBar {...baseProps} hasUnsavedChanges />);
    await user.click(screen.getByText("settings.save"));
    expect(baseProps.onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onDiscard when discard button is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsSaveBar {...baseProps} hasUnsavedChanges />);
    await user.click(screen.getByText("settings.discardChanges"));
    expect(baseProps.onDiscard).toHaveBeenCalledTimes(1);
  });
});
