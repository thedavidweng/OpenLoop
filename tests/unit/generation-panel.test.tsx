import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GenerationFormValues } from "@/app/lib/types";
import { DEFAULT_GENERATION_FORM_VALUES } from "@/app/lib/validation";

const getRandomPromptExample = vi.fn(() => "lo-fi warm piano, 90 BPM");

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => false,
  openFileDialog: vi.fn(),
}));

vi.mock("@/app/lib/prompt-examples", () => ({
  getRandomPromptExample: () => getRandomPromptExample(),
}));

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      if (opts?.time !== undefined) return `${key}:${opts.time}`;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

const mockRunGeneration = vi.fn();
const mockCancelGeneration = vi.fn();
const mockEnhancePrompt = vi.fn();
const mockResetForm = vi.fn();
const mockSetField = vi.fn();
const mockOpenSettings = vi.fn();
const mockResumeActiveTask = vi.fn();
const mockDiscardActiveTask = vi.fn();

function makeStoreOverrides(
  overrides: Partial<{
    form: GenerationFormValues;
    generationState: {
      status: string;
      phase: string;
      statusMessage: string;
      error: null;
    };
    validationErrors: Record<string, string>;
    settings: Record<string, unknown>;
    activeTasks: unknown[];
    modelStatuses: unknown[];
  }> = {},
) {
  return {
    form: overrides.form ?? {
      ...DEFAULT_GENERATION_FORM_VALUES,
      prompt: "ambient piano",
    },
    modelStatuses: overrides.modelStatuses ?? [],
    validationErrors: overrides.validationErrors ?? {},
    generationState: overrides.generationState ?? {
      status: "idle",
      phase: "idle",
      statusMessage: "Ready",
      error: null,
    },
    currentRequest: null,
    settings: overrides.settings ?? {
      firstRunCompleted: true,
      modelVariant: "turbo",
      downloadedModels: ["turbo"],
    },
    runGeneration: mockRunGeneration,
    cancelGeneration: mockCancelGeneration,
    enhancePrompt: mockEnhancePrompt,
    activeTasks: overrides.activeTasks ?? [],
    resumeActiveTask: mockResumeActiveTask,
    discardActiveTask: mockDiscardActiveTask,
    resetForm: mockResetForm,
    setField: mockSetField,
    openSettings: mockOpenSettings,
  };
}

let currentStoreState: ReturnType<typeof makeStoreOverrides>;

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: ReturnType<typeof makeStoreOverrides>) => unknown) =>
    selector(currentStoreState),
  MODEL_VARIANTS: {
    turbo: { label: "ACE-Step Turbo" },
    lite: { label: "ACE-Step Lite" },
    pro: { label: "ACE-Step Pro" },
  },
  isModelDownloaded: (settings: Record<string, unknown>) =>
    (settings.downloadedModels as string[])?.includes(settings.modelVariant as string),
  modelDownloadStateForVariant: () => "ready",
}));

const { GenerationPanel } = await import("@/app/components/generation/GenerationPanel");

describe("GenerationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = makeStoreOverrides();
  });

  it("renders the prompt textarea with the current form value", () => {
    render(<GenerationPanel />);
    const textarea = screen.getByPlaceholderText("generation.promptPlaceholder");
    expect(textarea).toHaveValue("ambient piano");
  });

  it("calls setField when user types in the prompt", async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    const textarea = screen.getByPlaceholderText("generation.promptPlaceholder");
    await user.clear(textarea);
    await user.type(textarea, "jazz");
    expect(mockSetField).toHaveBeenCalledWith("prompt", expect.any(String));
  });

  it("renders the generate button with the generate label", () => {
    render(<GenerationPanel />);
    const submitButton = screen.getByRole("button", {
      name: /generation\.generate/i,
    });
    expect(submitButton).toBeInTheDocument();
  });

  it("disables the generate button when generation is running", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "running",
        phase: "running",
        statusMessage: "Generating...",
        error: null,
      },
    });
    render(<GenerationPanel />);
    const submitButton = screen.getByRole("button", {
      name: /generation\.generatingElapsed/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it("shows cancel button when generation is running", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "running",
        phase: "running",
        statusMessage: "Generating...",
        error: null,
      },
    });
    render(<GenerationPanel />);
    expect(screen.getByRole("button", { name: /common\.cancel/i })).toBeInTheDocument();
  });

  it("calls resetForm when reset button is clicked", async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    const resetButton = screen.getByRole("button", {
      name: /generation\.reset/i,
    });
    await user.click(resetButton);
    expect(mockResetForm).toHaveBeenCalledOnce();
  });

  it("calls getRandomPromptExample and sets prompt on dice button click", async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    const diceButton = screen.getByRole("button", {
      name: /generation\.randomInspiration/i,
    });
    await user.click(diceButton);
    expect(getRandomPromptExample).toHaveBeenCalledOnce();
    expect(mockSetField).toHaveBeenCalledWith("prompt", "lo-fi warm piano, 90 BPM");
  });

  it("shows retry button when generation has failed", () => {
    currentStoreState = makeStoreOverrides({
      generationState: {
        status: "failed",
        phase: "failed",
        statusMessage: "Failed",
        error: null,
      },
    });
    render(<GenerationPanel />);
    expect(screen.getByRole("button", { name: /generation\.retry/i })).toBeInTheDocument();
  });

  it("renders variation selector buttons", () => {
    render(<GenerationPanel />);
    expect(
      screen.getByRole("button", { name: /generation\.variationOption:1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generation\.variationOption:2/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generation\.variationOption:3/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generation\.variationOption:4/i }),
    ).toBeInTheDocument();
  });

  it("calls setField when a variation button is clicked", async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    const variation3 = screen.getByRole("button", {
      name: /generation\.variationOption:3/i,
    });
    await user.click(variation3);
    expect(mockSetField).toHaveBeenCalledWith("variations", 3);
  });

  it("renders the instrumental checkbox", () => {
    render(<GenerationPanel />);
    const checkbox = screen.getByRole("checkbox", {
      name: /generation\.instrumental/i,
    });
    expect(checkbox).not.toBeChecked();
  });

  it("shows recovery banner when active tasks exist", () => {
    currentStoreState = makeStoreOverrides({
      activeTasks: [{ id: "task-1", taskId: "t-1" }],
    });
    render(<GenerationPanel />);
    expect(screen.getByText(/generation\.recoveryAvailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generation\.resumeTask/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generation\.discardTask/i })).toBeInTheDocument();
  });

  it("renders validation errors when present", () => {
    currentStoreState = makeStoreOverrides({
      validationErrors: { prompt: "Prompt is required" },
    });
    render(<GenerationPanel />);
    expect(screen.getByText("Prompt is required")).toBeInTheDocument();
  });
});
