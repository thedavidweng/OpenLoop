import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AppSettings,
  GenerationFormValues,
  GenerationState,
  ModelStatusSnapshot,
  ValidationErrors,
} from "@/app/lib/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const runGeneration = vi.fn();
const cancelGeneration = vi.fn();
const enhancePrompt = vi.fn();
const resumeActiveTask = vi.fn();
const discardActiveTask = vi.fn();
const resetForm = vi.fn();
const setField = vi.fn();
const openSettings = vi.fn();

vi.mock("@/app/lib/store", () => ({
  useGenerationStore: vi.fn(),
  MODEL_VARIANTS: {
    lite: { id: "lite", label: "Lite", modelName: "acestep-v15-turbo", lmModelPath: "acestep-5Hz-lm-0.6B" },
    turbo: { id: "turbo", label: "Turbo", modelName: "acestep-v15-turbo", lmModelPath: "acestep-5Hz-lm-0.6B" },
    pro: { id: "pro", label: "XL Turbo", modelName: "acestep-v15-xl-turbo", lmModelPath: "acestep-5Hz-lm-1.7B" },
  },
  isModelDownloaded: vi.fn(() => true),
  modelDownloadStateForVariant: vi.fn(() => "ready"),
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

// Mock child components to isolate GenerationPanel/index
vi.mock("@/app/components/generation/GenerationPanel/Header", () => ({
  Header: (props: { prompt: string; isBusy: boolean }) => (
    <div data-testid="header">
      <span data-testid="header-prompt">{props.prompt}</span>
      <span data-testid="header-busy">{String(props.isBusy)}</span>
    </div>
  ),
}));

vi.mock("@/app/components/generation/GenerationPanel/FormBody", () => ({
  FormBody: (props: { isBusy: boolean }) => (
    <div data-testid="form-body">
      <span data-testid="form-busy">{String(props.isBusy)}</span>
    </div>
  ),
}));

vi.mock("@/app/components/generation/GenerationPanel/ActionFooter", () => ({
  ActionFooter: (props: {
    isBusy: boolean;
    isFailed: boolean;
    canSubmit: boolean;
    onCancelGeneration: () => void;
    onResetForm: () => void;
    onRetry: () => void;
  }) => (
    <div data-testid="action-footer">
      <span data-testid="footer-busy">{String(props.isBusy)}</span>
      <span data-testid="footer-failed">{String(props.isFailed)}</span>
      <span data-testid="footer-can-submit">{String(props.canSubmit)}</span>
      <button type="button" data-testid="cancel-btn" onClick={props.onCancelGeneration}>
        Cancel
      </button>
      <button type="button" data-testid="reset-btn" onClick={props.onResetForm}>
        Reset
      </button>
      <button type="button" data-testid="retry-btn" onClick={props.onRetry}>
        Retry
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useGenerationStore } from "@/app/lib/store";
import { GenerationPanel } from "@/app/components/generation/GenerationPanel/index";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeForm(overrides?: Partial<GenerationFormValues>): GenerationFormValues {
  return {
    prompt: "lo-fi warm piano",
    negativePrompt: "",
    lyrics: "",
    vocalLanguage: "en",
    durationSeconds: "60",
    bpmMode: "auto",
    bpm: "",
    keyScale: "auto",
    timeSignature: "4",
    audioFormat: "wav",
    model: "acestep-v15-turbo",
    taskType: "text2music",
    lmModelPath: "acestep-5Hz-lm-0.6B",
    lmBackend: "mlx",
    thinking: false,
    inferenceSteps: "30",
    guidanceScale: "7",
    useFormat: false,
    useCotCaption: false,
    useCotLanguage: false,
    constrainedDecoding: false,
    referenceAudioPath: "",
    srcAudioPath: "",
    instruction: "",
    repaintingStart: "",
    repaintingEnd: "",
    audioCoverStrength: "",
    useRandomSeed: true,
    seed: "",
    instrumental: false,
    variations: 1,
    ...overrides,
  };
}

function makeSettings(overrides?: Partial<AppSettings>): AppSettings {
  return {
    profile: "standard",
    modelVariant: "turbo",
    downloadedModels: ["turbo"],
    outputDirectory: null,
    backendPort: 8080,
    defaultDurationSeconds: 60,
    defaultAudioFormat: "wav",
    defaultThinking: false,
    firstRunCompleted: true,
    ...overrides,
  };
}

function makeIdleState(): GenerationState {
  return {
    status: "idle",
    phase: "idle",
    statusMessage: "Ready",
    error: null,
  };
}

function makeModelStatuses(): ModelStatusSnapshot[] {
  return [
    {
      variant: "turbo",
      state: "ready",
      modelName: "acestep-v15-turbo",
      label: "Turbo",
      description: "Turbo model",
      downloadedBytes: 8 * 1024 * 1024 * 1024,
      totalBytes: 8 * 1024 * 1024 * 1024,
    },
  ];
}

function defaultStoreValues(overrides?: Record<string, unknown>) {
  return {
    form: makeForm(),
    modelStatuses: makeModelStatuses(),
    validationErrors: {} as ValidationErrors,
    generationState: makeIdleState(),
    currentRequest: { prompt: "test" },
    settings: makeSettings(),
    runGeneration,
    cancelGeneration,
    enhancePrompt,
    activeTasks: [],
    resumeActiveTask,
    discardActiveTask,
    resetForm,
    setField,
    openSettings,
    ...overrides,
  };
}

function setupMockStore(overrides?: Record<string, unknown>) {
  const values = defaultStoreValues(overrides);
  (vi.mocked(useGenerationStore) as any).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) => selector(values),
  );
}

// ===========================================================================
// GenerationPanel
// ===========================================================================

describe("GenerationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  it("renders the Header, FormBody, and ActionFooter subcomponents", () => {
    render(<GenerationPanel />);
    expect(screen.getByTestId("header")).toBeTruthy();
    expect(screen.getByTestId("form-body")).toBeTruthy();
    expect(screen.getByTestId("action-footer")).toBeTruthy();
  });

  it("passes prompt to Header", () => {
    render(<GenerationPanel />);
    expect(screen.getByTestId("header-prompt").textContent).toBe("lo-fi warm piano");
  });

  it("passes isBusy=false when idle", () => {
    render(<GenerationPanel />);
    expect(screen.getByTestId("header-busy").textContent).toBe("false");
    expect(screen.getByTestId("form-busy").textContent).toBe("false");
    expect(screen.getByTestId("footer-busy").textContent).toBe("false");
  });

  it("passes isBusy=true when running", () => {
    setupMockStore({
      generationState: { ...makeIdleState(), status: "running", phase: "running" },
    });
    render(<GenerationPanel />);
    expect(screen.getByTestId("header-busy").textContent).toBe("true");
    expect(screen.getByTestId("footer-busy").textContent).toBe("true");
  });

  it("passes isBusy=true when validating", () => {
    setupMockStore({
      generationState: { ...makeIdleState(), status: "validating", phase: "validating" },
    });
    render(<GenerationPanel />);
    expect(screen.getByTestId("footer-busy").textContent).toBe("true");
  });

  it("passes isFailed=true when failed", () => {
    setupMockStore({
      generationState: { ...makeIdleState(), status: "failed", phase: "failed" },
    });
    render(<GenerationPanel />);
    expect(screen.getByTestId("footer-failed").textContent).toBe("true");
  });

  it("passes canSubmit=true when model ready and no errors", () => {
    render(<GenerationPanel />);
    expect(screen.getByTestId("footer-can-submit").textContent).toBe("true");
  });

  it("passes canSubmit=false when there are validation errors", () => {
    setupMockStore({
      validationErrors: { prompt: "Prompt is required" },
    });
    render(<GenerationPanel />);
    expect(screen.getByTestId("footer-can-submit").textContent).toBe("false");
  });

  it("passes canSubmit=false when currentRequest is null", () => {
    setupMockStore({ currentRequest: null });
    render(<GenerationPanel />);
    expect(screen.getByTestId("footer-can-submit").textContent).toBe("false");
  });

  it("calls cancelGeneration when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    await user.click(screen.getByTestId("cancel-btn"));
    expect(cancelGeneration).toHaveBeenCalledTimes(1);
  });

  it("calls resetForm when reset button is clicked", async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    await user.click(screen.getByTestId("reset-btn"));
    expect(resetForm).toHaveBeenCalledTimes(1);
  });

  it("calls runGeneration when retry button is clicked", async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    await user.click(screen.getByTestId("retry-btn"));
    expect(runGeneration).toHaveBeenCalledTimes(1);
  });

  it("sets instrumental to false on mount when lyrics are present", () => {
    setupMockStore({
      form: makeForm({ lyrics: "[verse] Hello world" }),
    });
    render(<GenerationPanel />);
    expect(setField).toHaveBeenCalledWith("instrumental", false);
  });

  it("does not set instrumental when lyrics are empty", () => {
    setupMockStore({
      form: makeForm({ lyrics: "" }),
    });
    render(<GenerationPanel />);
    expect(setField).not.toHaveBeenCalledWith("instrumental", false);
  });
});
