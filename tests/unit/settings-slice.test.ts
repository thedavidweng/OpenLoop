import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import type { GenerationStore } from "@/app/lib/store/types";

/* ------------------------------------------------------------------ */
/*  Module mocks                                                       */
/* ------------------------------------------------------------------ */

vi.mock("@/app/lib/i18n", () => ({
  default: {
    t: vi.fn((key: string) => key),
    changeLanguage: vi.fn(() => Promise.resolve()),
    language: "en",
  },
  detectSystemLanguage: vi.fn(() => "en"),
  SUPPORTED_LANGUAGES: [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
  ],
}));

vi.mock("@/app/lib/api", () => ({
  isTauriRuntime: vi.fn(() => false),
  setSetting: vi.fn(() => Promise.resolve()),
  getSettings: vi.fn(() => Promise.resolve({})),
  getDeviceInfo: vi.fn(() => Promise.resolve(null)),
  listGenerations: vi.fn(() => Promise.resolve([])),
  listModelCatalog: vi.fn(() => Promise.resolve([])),
  getModelStatus: vi.fn(() => Promise.resolve([])),
  listActiveGenerationTasks: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/app/lib/errors", () => ({
  localizeModelStatuses: vi.fn((s: unknown) => s),
}));

vi.mock("@/app/lib/model-packs", async (importOriginal: () => Promise<typeof import("@/app/lib/model-packs")>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    expandDownloadedVariantsFromStatuses: vi.fn(() => []),
  };
});

vi.mock("@/app/lib/validation-helpers", () => ({
  computeValidationState: vi.fn(() => ({
    validationErrors: {},
    currentRequest: null,
  })),
}));

vi.mock("@/app/lib/profile-presets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/profile-presets")>();
  return {
    ...actual,
    applyProfilePreset: vi.fn((form: unknown) => form),
    applyModelVariantToForm: vi.fn((form: unknown) => form),
  };
});

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

const { createSettingsSlice } = await import("@/app/lib/store/slices/settings");
const api = await import("@/app/lib/api");
const { PROFILE_FORM_PRESETS } = await import("@/app/lib/profile-presets");
const { computeValidationState } = await import("@/app/lib/validation-helpers");
const i18nModule = await import("@/app/lib/i18n");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const mockForm = {
  prompt: "",
  negativePrompt: "",
  lyrics: "",
  vocalLanguage: "en",
  durationSeconds: "30",
  bpmMode: "auto" as const,
  bpm: "",
  keyScale: "",
  timeSignature: "4" as const,
  model: "acestep-v15-turbo",
  taskType: "text2music" as const,
  thinking: true,
  inferenceSteps: "8",
  guidanceScale: "7.0",
  useFormat: false,
  useCotCaption: true,
  useCotLanguage: true,
  constrainedDecoding: true,
  useRandomSeed: false,
  seed: "",
  audioFormat: "wav" as const,
  lmBackend: "mlx" as const,
  lmModelPath: "acestep-5Hz-lm-0.6B",
  referenceAudioPath: "",
  srcAudioPath: "",
  instruction: "",
  repaintingStart: "",
  repaintingEnd: "",
  audioCoverStrength: "",
  instrumental: false,
  variations: 1,
};

function createTestStore(overrides: Partial<GenerationStore> = {}) {
  return create<GenerationStore>((set, get) => ({
    ...createSettingsSlice(set, get),
    form: { ...mockForm },
    modelStatuses: [],
    generationState: {
      status: "idle",
      phase: "idle",
      statusMessage: "Ready",
      error: null,
    },
    bootstrapStatus: { state: "ready", message: "ok" },
    setupOverride: false,
    refreshBootstrapStatus: vi.fn(() => Promise.resolve()),
    ...overrides,
  } as GenerationStore));
}

/* ================================================================== */
/*  Settings Slice                                                     */
/* ================================================================== */

describe("Settings slice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* --- initial state ---------------------------------------------- */

  describe("initial state", () => {
    it("sets hydrated to false", () => {
      const store = createTestStore();
      expect(store.getState().hydrated).toBe(false);
    });

    it("sets recentPrompts and favoritePrompts to empty arrays", () => {
      const store = createTestStore();
      expect(store.getState().recentPrompts).toEqual([]);
      expect(store.getState().favoritePrompts).toEqual([]);
    });

    it("sets deviceInfo to null", () => {
      const store = createTestStore();
      expect(store.getState().deviceInfo).toBeNull();
    });
  });

  /* --- addRecentPrompt ------------------------------------------- */

  describe("addRecentPrompt", () => {
    it("adds a trimmed prompt to recentPrompts", () => {
      const store = createTestStore();
      store.getState().addRecentPrompt("  jazz piano  ");
      expect(store.getState().recentPrompts).toEqual(["jazz piano"]);
    });

    it("deduplicates: moves an existing prompt to the front", () => {
      const store = createTestStore({
        recentPrompts: ["rock", "pop", "jazz"],
      } as Partial<GenerationStore>);

      store.getState().addRecentPrompt("rock");

      expect(store.getState().recentPrompts).toEqual(["rock", "pop", "jazz"]);
    });

    it("caps at 20 entries, dropping the oldest", () => {
      const existing = Array.from({ length: 20 }, (_, i) => `prompt-${i}`);
      const store = createTestStore({
        recentPrompts: existing,
      } as Partial<GenerationStore>);

      store.getState().addRecentPrompt("new-prompt");

      const prompts = store.getState().recentPrompts;
      expect(prompts).toHaveLength(20);
      expect(prompts[0]).toBe("new-prompt");
      // The last original item gets dropped by slice(0, 20)
      expect(prompts).not.toContain("prompt-19");
    });

    it("ignores empty/whitespace-only strings", () => {
      const store = createTestStore();
      store.getState().addRecentPrompt("   ");
      expect(store.getState().recentPrompts).toEqual([]);
    });

    it("trims whitespace before deduplication", () => {
      const store = createTestStore({
        recentPrompts: ["hello"],
      } as Partial<GenerationStore>);

      store.getState().addRecentPrompt("  hello  ");

      expect(store.getState().recentPrompts).toEqual(["hello"]);
    });
  });

  /* --- toggleFavoritePrompt -------------------------------------- */

  describe("toggleFavoritePrompt", () => {
    it("adds a new prompt to favorites", () => {
      const store = createTestStore();
      store.getState().toggleFavoritePrompt("lo-fi beat");
      expect(store.getState().favoritePrompts).toEqual(["lo-fi beat"]);
    });

    it("removes an existing prompt from favorites", () => {
      const store = createTestStore({
        favoritePrompts: ["lo-fi beat", "ambient"],
      } as Partial<GenerationStore>);

      store.getState().toggleFavoritePrompt("lo-fi beat");

      expect(store.getState().favoritePrompts).toEqual(["ambient"]);
    });

    it("caps favorites at 50 entries, dropping the oldest", () => {
      const existing = Array.from({ length: 50 }, (_, i) => `fav-${i}`);
      const store = createTestStore({
        favoritePrompts: existing,
      } as Partial<GenerationStore>);

      store.getState().toggleFavoritePrompt("new-fav");

      const favs = store.getState().favoritePrompts;
      expect(favs).toHaveLength(50);
      expect(favs[0]).toBe("new-fav");
      expect(favs).not.toContain("fav-49");
    });

    it("ignores empty/whitespace-only strings", () => {
      const store = createTestStore();
      store.getState().toggleFavoritePrompt("   ");
      expect(store.getState().favoritePrompts).toEqual([]);
    });

    it("trims whitespace before toggling", () => {
      const store = createTestStore({
        favoritePrompts: ["hello"],
      } as Partial<GenerationStore>);

      store.getState().toggleFavoritePrompt("  hello  ");
      expect(store.getState().favoritePrompts).toEqual([]);
    });
  });

  /* --- removeRecentPrompt ---------------------------------------- */

  describe("removeRecentPrompt", () => {
    it("removes the matching prompt from recentPrompts", () => {
      const store = createTestStore({
        recentPrompts: ["rock", "pop", "jazz"],
      } as Partial<GenerationStore>);

      store.getState().removeRecentPrompt("pop");

      expect(store.getState().recentPrompts).toEqual(["rock", "jazz"]);
    });

    it("is a no-op when the prompt is not found", () => {
      const store = createTestStore({
        recentPrompts: ["rock"],
      } as Partial<GenerationStore>);

      store.getState().removeRecentPrompt("missing");

      expect(store.getState().recentPrompts).toEqual(["rock"]);
    });
  });

  /* --- setLanguage ------------------------------------------------ */

  describe("setLanguage", () => {
    it("persists language via api.setSetting when in Tauri runtime", async () => {
      vi.mocked(api.isTauriRuntime).mockReturnValue(true);
      const store = createTestStore();

      await store.getState().setLanguage("zh-CN");

      expect(api.setSetting).toHaveBeenCalledWith("language", "zh-CN");
    });

    it("skips api.setSetting when not in Tauri runtime", async () => {
      vi.mocked(api.isTauriRuntime).mockReturnValue(false);
      const store = createTestStore();

      await store.getState().setLanguage("zh-CN");

      expect(api.setSetting).not.toHaveBeenCalled();
    });

    it("updates settings.language in store", async () => {
      const store = createTestStore();
      await store.getState().setLanguage("zh-CN");
      expect(store.getState().settings.language).toBe("zh-CN");
    });

    it("calls i18next.changeLanguage", async () => {
      const store = createTestStore();
      await store.getState().setLanguage("zh-CN");
      expect(i18nModule.default.changeLanguage).toHaveBeenCalledWith("zh-CN");
    });

    it("resets idle generationState to idle with Ready message", async () => {
      const store = createTestStore({
        generationState: {
          status: "idle",
          phase: "idle",
          statusMessage: "Old",
          error: null,
        },
      });
      await store.getState().setLanguage("en");
      expect(store.getState().generationState.status).toBe("idle");
      expect(store.getState().generationState.statusMessage).toBe("Ready");
    });

    it("preserves non-idle generationState", async () => {
      const store = createTestStore({
        generationState: {
          status: "running",
          phase: "running",
          statusMessage: "Generating...",
          error: null,
        },
      });
      await store.getState().setLanguage("en");
      expect(store.getState().generationState.status).toBe("running");
    });
  });

  /* --- completeSetup --------------------------------------------- */

  describe("completeSetup", () => {
    describe("non-Tauri (browser) path", () => {
      it("sets firstRunCompleted to true", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore();
        await store.getState().completeSetup();
        expect(store.getState().settings.firstRunCompleted).toBe(true);
      });

      it("sets setupOverride to false", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore({ setupOverride: true });
        await store.getState().completeSetup();
        expect(store.getState().setupOverride).toBe(false);
      });

      it("uses deviceInfo.recommendedProfile when available", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore({
          deviceInfo: { recommendedProfile: "quality" } as any,
        });
        await store.getState().completeSetup();
        expect(store.getState().settings.profile).toBe("quality");
      });

      it("falls back to current settings.profile when no deviceInfo", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore({ deviceInfo: null });
        await store.getState().completeSetup();
        expect(store.getState().settings.profile).toBe("standard");
      });

      it("sets defaultThinking from profile preset", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore();
        await store.getState().completeSetup();
        expect(store.getState().settings.defaultThinking).toBe(
          PROFILE_FORM_PRESETS.standard.thinking,
        );
      });

      it("calls refreshBootstrapStatus", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const refreshMock = vi.fn(() => Promise.resolve());
        const store = createTestStore({ refreshBootstrapStatus: refreshMock });
        await store.getState().completeSetup();
        expect(refreshMock).toHaveBeenCalled();
      });

      it("calls computeValidationState with showErrors false", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore();
        await store.getState().completeSetup();
        expect(computeValidationState).toHaveBeenCalledWith(
          expect.anything(),
          { showErrors: false },
        );
      });
    });

    describe("Tauri path", () => {
      it("persists profile, firstRunCompleted, and defaultThinking", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(true);
        const store = createTestStore();
        await store.getState().completeSetup();
        expect(api.setSetting).toHaveBeenCalledWith("profile", "standard");
        expect(api.setSetting).toHaveBeenCalledWith("firstRunCompleted", true);
        expect(api.setSetting).toHaveBeenCalledWith(
          "defaultThinking",
          PROFILE_FORM_PRESETS.standard.thinking,
        );
      });

      it("calls hydrateFromPersistence", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(true);
        const hydrateMock = vi.fn(() => Promise.resolve());
        const store = createTestStore({ hydrateFromPersistence: hydrateMock });
        await store.getState().completeSetup();
        expect(hydrateMock).toHaveBeenCalled();
      });

      it("sets setupOverride to false", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(true);
        const store = createTestStore({ setupOverride: true });
        await store.getState().completeSetup();
        expect(store.getState().setupOverride).toBe(false);
      });

      it("calls refreshBootstrapStatus after hydration", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(true);
        const callOrder: string[] = [];
        const hydrateMock = vi.fn(async () => {
          callOrder.push("hydrate");
        });
        const refreshMock = vi.fn(async () => {
          callOrder.push("refresh");
        });
        const store = createTestStore({
          hydrateFromPersistence: hydrateMock,
          refreshBootstrapStatus: refreshMock,
        });
        await store.getState().completeSetup();
        expect(callOrder).toEqual(["hydrate", "refresh"]);
      });
    });
  });

  /* --- hydrateFromPersistence ------------------------------------ */

  describe("hydrateFromPersistence", () => {
    describe("non-Tauri (browser) path", () => {
      it("sets hydrated to true", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().hydrated).toBe(true);
      });

      it("sets bootstrapStatus to ready", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().bootstrapStatus.state).toBe("ready");
      });

      it("calls i18next.changeLanguage with detected system language", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(false);
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(i18nModule.default.changeLanguage).toHaveBeenCalledWith("en");
      });
    });

    describe("Tauri path — success", () => {
      function mockTauriApis(overrides: Record<string, unknown> = {}) {
        vi.mocked(api.isTauriRuntime).mockReturnValue(true);
        vi.mocked(api.getSettings).mockResolvedValue({
          profile: "standard",
          firstRunCompleted: true,
          language: "en",
          ...overrides,
        } as any);
        vi.mocked(api.listGenerations).mockResolvedValue([
          { id: "rec-1", isFavorite: true },
          { id: "rec-2", isFavorite: false },
        ] as any);
        vi.mocked(api.getDeviceInfo).mockResolvedValue({
          recommendedProfile: "standard",
        } as any);
        vi.mocked(api.listModelCatalog).mockResolvedValue([]);
        vi.mocked(api.getModelStatus).mockResolvedValue([]);
        vi.mocked(api.listActiveGenerationTasks).mockResolvedValue([]);
      }

      it("sets hydrated to true on success", async () => {
        mockTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().hydrated).toBe(true);
      });

      it("merges persisted settings into store", async () => {
        mockTauriApis({ backendPort: 9001 });
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().settings.backendPort).toBe(9001);
      });

      it("sets deviceInfo from API", async () => {
        mockTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().deviceInfo).toEqual({
          recommendedProfile: "standard",
        });
      });

      it("sets history and first record as currentGeneration", async () => {
        mockTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().history).toHaveLength(2);
        expect(store.getState().currentGeneration?.id).toBe("rec-1");
      });

      it("extracts favorite record IDs", async () => {
        mockTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().favoriteRecordIds).toEqual(["rec-1"]);
      });

      it("resets generationState to idle", async () => {
        mockTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().generationState).toEqual({
          status: "idle",
          phase: "idle",
          statusMessage: "Ready",
          error: null,
        });
      });

      it("uses deviceInfo.recommendedProfile when firstRunCompleted is false", async () => {
        mockTauriApis();
        vi.mocked(api.getSettings).mockResolvedValue({
          profile: "standard",
          firstRunCompleted: false,
        } as any);
        vi.mocked(api.getDeviceInfo).mockResolvedValue({
          recommendedProfile: "quality",
        } as any);

        const store = createTestStore();
        await store.getState().hydrateFromPersistence();

        expect(store.getState().settings.profile).toBe("quality");
      });

      it("sets currentGeneration to null when history is empty", async () => {
        mockTauriApis();
        vi.mocked(api.listGenerations).mockResolvedValue([] as any);

        const store = createTestStore();
        await store.getState().hydrateFromPersistence();

        expect(store.getState().currentGeneration).toBeNull();
      });
    });

    describe("Tauri path — error", () => {
      function mockFailingTauriApis() {
        vi.mocked(api.isTauriRuntime).mockReturnValue(true);
        vi.mocked(api.getSettings).mockRejectedValue(new Error("db error"));
        vi.mocked(api.listGenerations).mockResolvedValue([]);
        vi.mocked(api.getDeviceInfo).mockResolvedValue(null as any);
        vi.mocked(api.listModelCatalog).mockResolvedValue([]);
        vi.mocked(api.getModelStatus).mockResolvedValue([]);
        vi.mocked(api.listActiveGenerationTasks).mockResolvedValue([]);
      }

      it("sets hydrated to true even on error", async () => {
        mockFailingTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().hydrated).toBe(true);
      });

      it("sets bootstrapStatus to failed on error", async () => {
        mockFailingTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().bootstrapStatus.state).toBe("failed");
      });

      it("sets generationState to failed with recoverable error", async () => {
        mockFailingTauriApis();
        const store = createTestStore();
        await store.getState().hydrateFromPersistence();
        expect(store.getState().generationState.status).toBe("failed");
        expect(store.getState().generationState.error?.recoverable).toBe(true);
      });

      it("includes error details in the failure state", async () => {
        vi.mocked(api.isTauriRuntime).mockReturnValue(true);
        vi.mocked(api.getSettings).mockRejectedValue("connection lost");
        vi.mocked(api.listGenerations).mockResolvedValue([]);
        vi.mocked(api.getDeviceInfo).mockResolvedValue(null as any);
        vi.mocked(api.listModelCatalog).mockResolvedValue([]);
        vi.mocked(api.getModelStatus).mockResolvedValue([]);
        vi.mocked(api.listActiveGenerationTasks).mockResolvedValue([]);

        const store = createTestStore();
        await store.getState().hydrateFromPersistence();

        expect(store.getState().generationState.error?.details).toContain("connection lost");
      });
    });
  });
});
