import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  GenerationFormValues,
  ValidationErrors,
  ModelCatalogItem,
  ModelDownloadState,
  GenerationState,
  ActiveGenerationTask,
} from "@/app/lib/types";
import { DEFAULT_GENERATION_FORM_VALUES } from "@/app/lib/validation";
import type { TextField } from "@/app/components/generation/GenerationPanel/shared";
import {
  SELECT_OPTIONS,
  STRUCTURE_TAGS,
} from "@/app/components/generation/generation-panel-options";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const getRandomPromptExample = vi.fn(() => "lo-fi warm piano, 90 BPM");
const getRandomPromptByCategory = vi.fn((cat: string) => `a ${cat} track`);
const PROMPT_CATEGORIES = ["pop", "cinematic", "edm"];

vi.mock("@/app/lib/prompt-examples", () => ({
  getRandomPromptExample: (...args: unknown[]) => getRandomPromptExample(...args),
  getRandomPromptByCategory: (...args: unknown[]) => getRandomPromptByCategory(...args),
  PROMPT_CATEGORIES,
}));

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: () => false,
  openFileDialog: vi.fn(),
}));

vi.mock("@/app/components/overlay/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/app/components/overlay/Tooltip", () => ({
  Tooltip: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <span data-testid="tooltip" data-label={label}>
      {children}
    </span>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      if (opts?.time !== undefined) return `${key}:${opts.time}`;
      if (opts?.defaultValue) return opts.defaultValue as string;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Store mock with controllable state
const mockToggleFavoritePrompt = vi.fn();
const mockRemoveRecentPrompt = vi.fn();
let storeState: {
  recentPrompts: string[];
  favoritePrompts: string[];
  toggleFavoritePrompt: typeof mockToggleFavoritePrompt;
  removeRecentPrompt: typeof mockRemoveRecentPrompt;
};

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: (selector: (state: typeof storeState) => unknown) =>
    selector(storeState),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

const { FieldError, FieldLabel, FilePickerField, handleTextFieldChange } = await import(
  "@/app/components/generation/GenerationPanel/shared"
);
const { Header } = await import("@/app/components/generation/GenerationPanel/Header");
const { FormBody } = await import("@/app/components/generation/GenerationPanel/FormBody");
const { ActionFooter } = await import(
  "@/app/components/generation/GenerationPanel/ActionFooter"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeForm(overrides: Partial<GenerationFormValues> = {}): GenerationFormValues {
  return { ...DEFAULT_GENERATION_FORM_VALUES, ...overrides };
}

function makeModel(overrides: Partial<ModelCatalogItem> = {}): ModelCatalogItem {
  return {
    variant: "turbo",
    label: "ACE-Step Turbo",
    modelName: "ace-step-turbo",
    lmModel: null,
    lmBackend: "mlx",
    estimatedSizeBytes: 1_000_000_000,
    description: "Fast generation",
    recommendedMemoryGb: 8,
    ...overrides,
  };
}

function makeHeaderProps(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
  return {
    isBusy: false,
    activeTasks: [] as ActiveGenerationTask[],
    prompt: "",
    onSetField: vi.fn(),
    onEnhancePrompt: vi.fn().mockResolvedValue(undefined),
    onResumeTask: vi.fn().mockResolvedValue(undefined),
    onDiscardTask: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFormBodyProps(overrides: Partial<Parameters<typeof FormBody>[0]> = {}) {
  return {
    form: makeForm(),
    isBusy: false,
    validationErrors: {} as ValidationErrors,
    selectedModel: makeModel(),
    modelReady: true,
    selectedModelState: "ready" as ModelDownloadState,
    tweakOpen: false,
    setTweakOpen: vi.fn(),
    expertOpen: false,
    setExpertOpen: vi.fn(),
    openSettings: vi.fn(),
    lyricsRef: { current: null },
    setField: vi.fn(),
    ...overrides,
  };
}

function makeGenerationState(
  status: GenerationState["status"] = "idle",
): GenerationState {
  return {
    status,
    phase: status === "idle" ? "idle" : "running",
    statusMessage: "",
    error: null,
  };
}

function makeFooterProps(overrides: Partial<Parameters<typeof ActionFooter>[0]> = {}) {
  return {
    isBusy: false,
    isFailed: false,
    canSubmit: true,
    generationState: makeGenerationState(),
    elapsedTime: 0,
    modelReady: true,
    onCancelGeneration: vi.fn(),
    onResetForm: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

// ===========================================================================
// shared.tsx
// ===========================================================================

describe("shared: FieldError", () => {
  it("renders nothing when message is undefined", () => {
    const { container } = render(<FieldError />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing when message is empty string", () => {
    const { container } = render(<FieldError message="" />);
    expect(container.textContent).toBe("");
  });

  it("renders the error message text", () => {
    render(<FieldError message="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });
});

describe("shared: FieldLabel", () => {
  it("renders children text", () => {
    render(<FieldLabel>Prompt</FieldLabel>);
    expect(screen.getByText("Prompt")).toBeInTheDocument();
  });
});

describe("shared: FilePickerField", () => {
  it("renders the label and an empty input", () => {
    render(<FilePickerField label="Reference Audio" value="" onChange={vi.fn()} />);
    expect(screen.getByText("Reference Audio")).toBeInTheDocument();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("displays the current value in the input", () => {
    render(<FilePickerField label="Source" value="/path/to/file.mp3" onChange={vi.fn()} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("/path/to/file.mp3");
  });

  it("calls onChange when typing into the input", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilePickerField label="Source" value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("shows a clear button when value is non-empty", () => {
    render(<FilePickerField label="Ref" value="/some/path.wav" onChange={vi.fn()} />);
    const clearButton = screen.getAllByRole("button").find((btn) => {
      const svg = btn.querySelector("svg");
      return svg !== null;
    });
    expect(clearButton).toBeDefined();
  });

  it("calls onChange('') when the clear button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilePickerField label="Ref" value="/some/path.wav" onChange={onChange} />);
    const buttons = screen.getAllByRole("button");
    // The clear button is the last one with an X icon (no text label)
    const clearButton = buttons[buttons.length - 1];
    await user.click(clearButton);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not show the browse button when not in Tauri runtime", () => {
    render(<FilePickerField label="Ref" value="" onChange={vi.fn()} />);
    // Only the label text should be present, no "chooseFile" button since isTauriRuntime is false
    expect(screen.queryByText("generation.chooseFile")).not.toBeInTheDocument();
  });

  it("disables the input when disabled prop is true", () => {
    render(<FilePickerField label="Ref" value="" onChange={vi.fn()} disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });
});

describe("shared: handleTextFieldChange", () => {
  it("returns a function that calls setField with the event value", () => {
    const setField = vi.fn();
    const handler = handleTextFieldChange("prompt" as TextField, setField);
    handler({ target: { value: "new prompt" } } as never);
    expect(setField).toHaveBeenCalledWith("prompt", "new prompt");
  });
});

// ===========================================================================
// Header
// ===========================================================================

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      recentPrompts: [],
      favoritePrompts: [],
      toggleFavoritePrompt: mockToggleFavoritePrompt,
      removeRecentPrompt: mockRemoveRecentPrompt,
    };
  });

  it("renders the composer title and description", () => {
    render(<Header {...makeHeaderProps()} />);
    expect(screen.getByText("generation.composerTitle")).toBeInTheDocument();
    expect(screen.getByText("generation.composerDescription")).toBeInTheDocument();
  });

  it("renders the dice, enhance, and favorite buttons", () => {
    render(<Header {...makeHeaderProps()} />);
    expect(
      screen.getByRole("button", { name: "generation.randomInspiration" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "generation.enhancePrompt" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "generation.addFavorite" }),
    ).toBeInTheDocument();
  });

  it("calls onSetField with a random prompt when dice button is clicked", async () => {
    const onSetField = vi.fn();
    const user = userEvent.setup();
    render(<Header {...makeHeaderProps({ onSetField })} />);
    await user.click(screen.getByRole("button", { name: "generation.randomInspiration" }));
    expect(getRandomPromptExample).toHaveBeenCalled();
    expect(onSetField).toHaveBeenCalledWith("prompt", "lo-fi warm piano, 90 BPM");
  });

  it("calls onEnhancePrompt when the enhance button is clicked", async () => {
    const onEnhancePrompt = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Header {...makeHeaderProps({ onEnhancePrompt })} />);
    await user.click(screen.getByRole("button", { name: "generation.enhancePrompt" }));
    expect(onEnhancePrompt).toHaveBeenCalled();
  });

  it("disables dice and enhance buttons when isBusy", () => {
    render(<Header {...makeHeaderProps({ isBusy: true })} />);
    expect(screen.getByRole("button", { name: "generation.randomInspiration" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "generation.enhancePrompt" })).toBeDisabled();
  });

  it("disables favorite button when isBusy", () => {
    render(<Header {...makeHeaderProps({ isBusy: true })} />);
    expect(screen.getByRole("button", { name: "generation.addFavorite" })).toBeDisabled();
  });

  it("renders recent prompt chips when store has recent prompts", () => {
    storeState = {
      ...storeState,
      recentPrompts: ["dark synthwave", "jazz piano trio"],
    };
    render(<Header {...makeHeaderProps()} />);
    expect(screen.getByText("generation.recentPrompts")).toBeInTheDocument();
    expect(screen.getByText("dark synthwave")).toBeInTheDocument();
    expect(screen.getByText("jazz piano trio")).toBeInTheDocument();
  });

  it("sets prompt to recent chip value when clicked", async () => {
    const onSetField = vi.fn();
    storeState = {
      ...storeState,
      recentPrompts: ["chill lo-fi beat"],
    };
    const user = userEvent.setup();
    render(<Header {...makeHeaderProps({ onSetField })} />);
    await user.click(screen.getByText("chill lo-fi beat"));
    expect(onSetField).toHaveBeenCalledWith("prompt", "chill lo-fi beat");
  });

  it("renders favorite prompt chips when store has favorites", () => {
    storeState = {
      ...storeState,
      favoritePrompts: ["epic orchestral"],
    };
    render(<Header {...makeHeaderProps()} />);
    expect(screen.getByText("generation.favoritePrompts")).toBeInTheDocument();
    expect(screen.getByText("epic orchestral")).toBeInTheDocument();
  });

  it("sets prompt to favorite chip value when clicked", async () => {
    const onSetField = vi.fn();
    storeState = {
      ...storeState,
      favoritePrompts: ["ambient drone"],
    };
    const user = userEvent.setup();
    render(<Header {...makeHeaderProps({ onSetField })} />);
    await user.click(screen.getByText("ambient drone"));
    expect(onSetField).toHaveBeenCalledWith("prompt", "ambient drone");
  });

  it("shows recovery banner with resume and discard buttons when active tasks exist", () => {
    const activeTasks: ActiveGenerationTask[] = [
      {
        id: "rec-1",
        taskId: "task-1",
        request: {} as never,
        variationIndex: 0,
        variationTotal: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    render(<Header {...makeHeaderProps({ activeTasks })} />);
    expect(screen.getByText(/generation\.recoveryAvailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generation\.resumeTask/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generation\.discardTask/ })).toBeInTheDocument();
  });

  it("calls onResumeTask when resume button is clicked", async () => {
    const onResumeTask = vi.fn().mockResolvedValue(undefined);
    const activeTasks: ActiveGenerationTask[] = [
      {
        id: "rec-1",
        taskId: "task-1",
        request: {} as never,
        variationIndex: 0,
        variationTotal: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const user = userEvent.setup();
    render(<Header {...makeHeaderProps({ activeTasks, onResumeTask })} />);
    await user.click(screen.getByRole("button", { name: /generation\.resumeTask/ }));
    expect(onResumeTask).toHaveBeenCalledWith("rec-1");
  });

  it("calls onDiscardTask when discard button is clicked", async () => {
    const onDiscardTask = vi.fn().mockResolvedValue(undefined);
    const activeTasks: ActiveGenerationTask[] = [
      {
        id: "rec-2",
        taskId: "task-2",
        request: {} as never,
        variationIndex: 0,
        variationTotal: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const user = userEvent.setup();
    render(<Header {...makeHeaderProps({ activeTasks, onDiscardTask })} />);
    await user.click(screen.getByRole("button", { name: /generation\.discardTask/ }));
    expect(onDiscardTask).toHaveBeenCalledWith("rec-2");
  });

  it("does not render recovery banner when no active tasks", () => {
    render(<Header {...makeHeaderProps({ activeTasks: [] })} />);
    expect(screen.queryByText(/generation\.recoveryAvailable/)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// FormBody
// ===========================================================================

describe("FormBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      recentPrompts: [],
      favoritePrompts: [],
      toggleFavoritePrompt: mockToggleFavoritePrompt,
      removeRecentPrompt: mockRemoveRecentPrompt,
    };
  });

  it("renders the task type select with current value", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ taskType: "cover" }) })} />);
    const select = screen.getByDisplayValue("generation.taskTypes.cover");
    expect(select).toBeInTheDocument();
  });

  it("renders all task type options", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    const options = screen.getAllByRole("option");
    const taskTypeOptions = options.filter((opt) =>
      SELECT_OPTIONS.taskType.some((t) => opt.getAttribute("value") === t),
    );
    expect(taskTypeOptions).toHaveLength(SELECT_OPTIONS.taskType.length);
  });

  it("renders the prompt textarea with current value", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ prompt: "my song" }) })} />);
    const textarea = screen.getByPlaceholderText("generation.promptPlaceholder");
    expect(textarea).toHaveValue("my song");
  });

  it("calls setField when typing in prompt textarea", async () => {
    const setField = vi.fn();
    const user = userEvent.setup();
    render(<FormBody {...makeFormBodyProps({ setField })} />);
    const textarea = screen.getByPlaceholderText("generation.promptPlaceholder");
    await user.type(textarea, "x");
    expect(setField).toHaveBeenCalledWith("prompt", expect.any(String));
  });

  it("renders model label when a model is selected", () => {
    render(
      <FormBody
        {...makeFormBodyProps({ selectedModel: makeModel({ label: "ACE-Step Turbo" }) })}
      />,
    );
    expect(screen.getByText("ACE-Step Turbo")).toBeInTheDocument();
  });

  it("renders 'no model' text when selectedModel is null", () => {
    render(<FormBody {...makeFormBodyProps({ selectedModel: null })} />);
    expect(screen.getByText("model.noModel")).toBeInTheDocument();
  });

  it("shows model ready badge when modelReady is true", () => {
    render(<FormBody {...makeFormBodyProps({ modelReady: true })} />);
    expect(screen.getByText("model.ready")).toBeInTheDocument();
  });

  it("shows downloading badge when model state is downloading", () => {
    render(
      <FormBody
        {...makeFormBodyProps({
          modelReady: false,
          selectedModelState: "downloading" as ModelDownloadState,
        })}
      />,
    );
    expect(screen.getByText("model.downloading")).toBeInTheDocument();
  });

  it("shows failed badge when model state is failed", () => {
    render(
      <FormBody
        {...makeFormBodyProps({
          modelReady: false,
          selectedModelState: "failed" as ModelDownloadState,
        })}
      />,
    );
    expect(screen.getByText("model.failed")).toBeInTheDocument();
  });

  it("shows not installed badge when model state is not_installed", () => {
    render(
      <FormBody
        {...makeFormBodyProps({
          modelReady: false,
          selectedModelState: "not_installed" as ModelDownloadState,
        })}
      />,
    );
    expect(screen.getByText("model.notInstalled")).toBeInTheDocument();
  });

  it("calls openSettings when model settings button is clicked", async () => {
    const openSettings = vi.fn();
    const user = userEvent.setup();
    render(<FormBody {...makeFormBodyProps({ openSettings })} />);
    await user.click(screen.getByText(/model\.openSettings/));
    expect(openSettings).toHaveBeenCalled();
  });

  it("renders the instrumental checkbox unchecked by default", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    const checkbox = screen.getByRole("checkbox", { name: /generation\.instrumental/i });
    expect(checkbox).not.toBeChecked();
  });

  it("calls setField when instrumental checkbox is toggled", async () => {
    const setField = vi.fn();
    const user = userEvent.setup();
    render(<FormBody {...makeFormBodyProps({ setField })} />);
    const checkbox = screen.getByRole("checkbox", { name: /generation\.instrumental/i });
    await user.click(checkbox);
    expect(setField).toHaveBeenCalledWith("instrumental", true);
    // Also clears lyrics
    expect(setField).toHaveBeenCalledWith("lyrics", "");
  });

  it("disables lyrics textarea when instrumental is checked", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ instrumental: true }) })} />);
    const textarea = screen.getByPlaceholderText("generation.instrumentalDesc");
    expect(textarea).toBeDisabled();
  });

  it("hides structure tags when instrumental is on", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ instrumental: true }) })} />);
    // Structure tag buttons should not be rendered
    const tagButtons = STRUCTURE_TAGS.map((tag) =>
      screen.queryByText(`generation.${tag}`),
    );
    tagButtons.forEach((btn) => expect(btn).not.toBeInTheDocument());
  });

  it("renders structure tags when instrumental is off", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ instrumental: false }) })} />);
    STRUCTURE_TAGS.forEach((tag) => {
      expect(screen.getByText(`generation.${tag}`)).toBeInTheDocument();
    });
  });

  it("renders duration input with current value", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ durationSeconds: "120" }) })} />);
    const input = screen.getByDisplayValue("120");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "number");
  });

  it("renders BPM mode select with auto selected by default", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    // Both BPM mode and keyScale selects default to "auto" which displays as "generation.auto"
    const autoSelects = screen.getAllByDisplayValue("generation.auto");
    expect(autoSelects.length).toBeGreaterThanOrEqual(2);
  });

  it("disables BPM input when bpmMode is auto", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ bpmMode: "auto" }) })} />);
    const bpmInput = screen.getByPlaceholderText("generation.optional");
    expect(bpmInput).toBeDisabled();
  });

  it("enables BPM input when bpmMode is manual", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ bpmMode: "manual" }) })} />);
    const bpmInput = screen.getByPlaceholderText("generation.optional");
    expect(bpmInput).not.toBeDisabled();
  });

  it("renders key scale select with options", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    // "generation.auto" is the display text for the auto option in both selects
    const autoSelects = screen.getAllByDisplayValue("generation.auto");
    expect(autoSelects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders time signature select", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ timeSignature: "4" }) })} />);
    const options = screen.getAllByRole("option").filter((o) => o.textContent?.includes("/4"));
    expect(options.length).toBe(SELECT_OPTIONS.timeSignature.length);
  });

  it("renders vocal language select with options", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    const enOption = screen.getByText("EN");
    expect(enOption).toBeInTheDocument();
  });

  it("disables vocal language select when instrumental is on", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ instrumental: true }) })} />);
    // Find the language select by its options
    const selects = screen.getAllByRole("combobox");
    // The language select is one of the comboboxes
    const langSelect = selects.find((s) =>
      within(s).queryByText("EN"),
    );
    expect(langSelect).toBeDefined();
    expect(langSelect).toBeDisabled();
  });

  it("renders audio format select", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ audioFormat: "wav" }) })} />);
    expect(screen.getByText("WAV")).toBeInTheDocument();
  });

  it("renders variation selector buttons 1-4", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    [1, 2, 3, 4].forEach((n) => {
      expect(
        screen.getByRole("button", { name: `generation.variationOption:${n}` }),
      ).toBeInTheDocument();
    });
  });

  it("calls setField when a variation button is clicked", async () => {
    const setField = vi.fn();
    const user = userEvent.setup();
    render(<FormBody {...makeFormBodyProps({ setField })} />);
    await user.click(screen.getByRole("button", { name: "generation.variationOption:2" }));
    expect(setField).toHaveBeenCalledWith("variations", 2);
  });

  it("marks the current variation button as pressed", () => {
    render(<FormBody {...makeFormBodyProps({ form: makeForm({ variations: 3 }) })} />);
    const btn3 = screen.getByRole("button", { name: "generation.variationOption:3" });
    expect(btn3).toHaveAttribute("aria-pressed", "true");
    const btn1 = screen.getByRole("button", { name: "generation.variationOption:1" });
    expect(btn1).toHaveAttribute("aria-pressed", "false");
  });

  it("disables form fields when isBusy is true", () => {
    render(<FormBody {...makeFormBodyProps({ isBusy: true })} />);
    const taskTypeSelect = screen.getByDisplayValue("generation.taskTypes.text2music");
    expect(taskTypeSelect).toBeDisabled();
    const promptTextarea = screen.getByPlaceholderText("generation.promptPlaceholder");
    expect(promptTextarea).toBeDisabled();
  });

  it("renders validation error for prompt field", () => {
    render(
      <FormBody
        {...makeFormBodyProps({ validationErrors: { prompt: "Prompt is required" } })}
      />,
    );
    expect(screen.getByText("Prompt is required")).toBeInTheDocument();
  });

  it("renders validation error for lyrics field", () => {
    render(
      <FormBody
        {...makeFormBodyProps({ validationErrors: { lyrics: "Lyrics too long" } })}
      />,
    );
    expect(screen.getByText("Lyrics too long")).toBeInTheDocument();
  });

  it("shows 'needsReview' badge on tweak section when tweak fields have errors", () => {
    render(
      <FormBody
        {...makeFormBodyProps({
          validationErrors: { seed: "Invalid seed" } as ValidationErrors,
        })}
      />,
    );
    expect(screen.getByText("generation.needsReview")).toBeInTheDocument();
  });

  it("does not show 'needsReview' badge when no tweak errors", () => {
    render(<FormBody {...makeFormBodyProps({ validationErrors: {} })} />);
    expect(screen.queryByText("generation.needsReview")).not.toBeInTheDocument();
  });

  it("renders the tweak sound collapsible section", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    expect(screen.getByText("generation.tweakSound")).toBeInTheDocument();
  });

  it("renders the expert mode collapsible section", () => {
    render(<FormBody {...makeFormBodyProps()} />);
    expect(screen.getByText("generation.expertMode")).toBeInTheDocument();
  });

  it("calls setTweakOpen when tweak collapsible is toggled", async () => {
    const setTweakOpen = vi.fn();
    const user = userEvent.setup();
    render(<FormBody {...makeFormBodyProps({ setTweakOpen })} />);
    await user.click(screen.getByText("generation.tweakSound"));
    expect(setTweakOpen).toHaveBeenCalledWith(true);
  });

  it("calls setExpertOpen when expert collapsible is toggled", async () => {
    const setExpertOpen = vi.fn();
    const user = userEvent.setup();
    render(<FormBody {...makeFormBodyProps({ setExpertOpen })} />);
    await user.click(screen.getByText("generation.expertMode"));
    expect(setExpertOpen).toHaveBeenCalledWith(true);
  });

  it("renders negative prompt textarea inside tweak section when open", () => {
    render(<FormBody {...makeFormBodyProps({ tweakOpen: true })} />);
    expect(
      screen.getByPlaceholderText("generation.negativePromptPlaceholder"),
    ).toBeInTheDocument();
  });

  it("renders inference steps and guidance scale inputs when tweak is open", () => {
    render(<FormBody {...makeFormBodyProps({ tweakOpen: true })} />);
    expect(screen.getByText("generation.inferenceSteps")).toBeInTheDocument();
    expect(screen.getByText("generation.guidanceScale")).toBeInTheDocument();
  });

  it("renders random seed checkbox inside tweak section when open", () => {
    render(<FormBody {...makeFormBodyProps({ tweakOpen: true })} />);
    const checkbox = screen.getByRole("checkbox", { name: /generation\.randomSeed/i });
    expect(checkbox).toBeInTheDocument();
  });

  it("renders expert mode checkboxes when expert section is open", () => {
    render(<FormBody {...makeFormBodyProps({ expertOpen: true })} />);
    expect(screen.getByText("generation.thinking")).toBeInTheDocument();
    expect(screen.getByText("generation.useFormat")).toBeInTheDocument();
    expect(screen.getByText("generation.cotCaption")).toBeInTheDocument();
    expect(screen.getByText("generation.cotLanguage")).toBeInTheDocument();
    expect(screen.getByText("generation.constrained")).toBeInTheDocument();
  });

  it("disables lmModel and lmBackend selects when thinking is off", () => {
    render(
      <FormBody
        {...makeFormBodyProps({ expertOpen: true, form: makeForm({ thinking: false }) })}
      />,
    );
    const selects = screen.getAllByRole("combobox");
    // LM selects should be disabled when thinking is false
    const lmModelSelect = selects.find((s) =>
      within(s).queryByText("None"),
    );
    expect(lmModelSelect).toBeDefined();
    expect(lmModelSelect).toBeDisabled();
  });
});

// ===========================================================================
// ActionFooter
// ===========================================================================

describe("ActionFooter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      recentPrompts: [],
      favoritePrompts: [],
      toggleFavoritePrompt: mockToggleFavoritePrompt,
      removeRecentPrompt: mockRemoveRecentPrompt,
    };
  });

  it("renders the generate button with generate label when idle", () => {
    render(<ActionFooter {...makeFooterProps()} />);
    const btn = screen.getByRole("button", { name: /generation\.generate/ });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("renders the reset button", () => {
    render(<ActionFooter {...makeFooterProps()} />);
    expect(screen.getByRole("button", { name: /generation\.reset/ })).toBeInTheDocument();
  });

  it("calls onResetForm when reset button is clicked", async () => {
    const onResetForm = vi.fn();
    const user = userEvent.setup();
    render(<ActionFooter {...makeFooterProps({ onResetForm })} />);
    await user.click(screen.getByRole("button", { name: /generation\.reset/ }));
    expect(onResetForm).toHaveBeenCalled();
  });

  it("shows cancel button when isBusy is true", () => {
    render(<ActionFooter {...makeFooterProps({ isBusy: true })} />);
    expect(screen.getByRole("button", { name: /common\.cancel/ })).toBeInTheDocument();
  });

  it("does not show cancel button when not busy", () => {
    render(<ActionFooter {...makeFooterProps({ isBusy: false })} />);
    expect(screen.queryByRole("button", { name: /common\.cancel/ })).not.toBeInTheDocument();
  });

  it("calls onCancelGeneration when cancel button is clicked", async () => {
    const onCancelGeneration = vi.fn();
    const user = userEvent.setup();
    render(<ActionFooter {...makeFooterProps({ isBusy: true, onCancelGeneration })} />);
    await user.click(screen.getByRole("button", { name: /common\.cancel/ }));
    expect(onCancelGeneration).toHaveBeenCalled();
  });

  it("disables the generate button when isBusy is true", () => {
    render(
      <ActionFooter
        {...makeFooterProps({
          isBusy: true,
          generationState: makeGenerationState("running"),
        })}
      />,
    );
    const btn = screen.getByRole("button", { name: /generation\.generatingElapsed/ });
    expect(btn).toBeDisabled();
  });

  it("disables the generate button when canSubmit is false", () => {
    render(<ActionFooter {...makeFooterProps({ canSubmit: false })} />);
    const btn = screen.getByRole("button", { name: /generation\.generate/ });
    expect(btn).toBeDisabled();
  });

  it("shows retry button when isFailed is true and not busy", () => {
    render(<ActionFooter {...makeFooterProps({ isFailed: true })} />);
    expect(screen.getByRole("button", { name: /generation\.retry/ })).toBeInTheDocument();
  });

  it("does not show retry button when isFailed is false", () => {
    render(<ActionFooter {...makeFooterProps({ isFailed: false })} />);
    expect(screen.queryByRole("button", { name: /generation\.retry/ })).not.toBeInTheDocument();
  });

  it("does not show retry button when isFailed but isBusy", () => {
    render(<ActionFooter {...makeFooterProps({ isFailed: true, isBusy: true })} />);
    expect(screen.queryByRole("button", { name: /generation\.retry/ })).not.toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ActionFooter {...makeFooterProps({ isFailed: true, onRetry })} />);
    await user.click(screen.getByRole("button", { name: /generation\.retry/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows 'generatingElapsed' label with formatted time when running", () => {
    render(
      <ActionFooter
        {...makeFooterProps({
          generationState: makeGenerationState("running"),
          elapsedTime: 75,
        })}
      />,
    );
    // formatElapsed(75) => "1:15"
    expect(screen.getByText("generation.generatingElapsed:1:15")).toBeInTheDocument();
  });

  it("shows 'validating' label when validating", () => {
    render(
      <ActionFooter
        {...makeFooterProps({ generationState: makeGenerationState("validating") })}
      />,
    );
    expect(screen.getByText("generation.validating")).toBeInTheDocument();
  });

  it("shows elapsed time with padded seconds", () => {
    render(
      <ActionFooter
        {...makeFooterProps({
          generationState: makeGenerationState("running"),
          elapsedTime: 65,
        })}
      />,
    );
    expect(screen.getByText("generation.generatingElapsed:1:05")).toBeInTheDocument();
  });

  it("shows zero elapsed time correctly", () => {
    render(
      <ActionFooter
        {...makeFooterProps({
          generationState: makeGenerationState("running"),
          elapsedTime: 0,
        })}
      />,
    );
    expect(screen.getByText("generation.generatingElapsed:0:00")).toBeInTheDocument();
  });

  it("shows localReady message when modelReady is true", () => {
    render(<ActionFooter {...makeFooterProps({ modelReady: true })} />);
    expect(screen.getByText("generation.localReady")).toBeInTheDocument();
  });

  it("shows chooseFirst message when modelReady is false", () => {
    render(<ActionFooter {...makeFooterProps({ modelReady: false })} />);
    expect(screen.getByText("model.chooseFirst")).toBeInTheDocument();
  });

  it("disables reset button when isBusy is true", () => {
    render(<ActionFooter {...makeFooterProps({ isBusy: true })} />);
    expect(screen.getByRole("button", { name: /generation\.reset/ })).toBeDisabled();
  });
});
