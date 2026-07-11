import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GenerationFormValues,
  GenerationProfile,
  GenerationRecord,
  Project,
} from "@/app/lib/types";
import type { GenerationStore } from "@/app/lib/store/types";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockApi = {
  isTauriRuntime: vi.fn(() => false),
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  renameProfile: vi.fn(),
  deleteProfile: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  assignGenerationToProject: vi.fn(),
};

vi.mock("@/app/lib/api", () => mockApi);

vi.mock("@/app/lib/store-helpers", async (importOriginal) => {
  const mod: any = await importOriginal();
  return { ...mod, sleep: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("@/app/lib/model-packs", async (importOriginal) => {
  const mod: any = await importOriginal();
  return { ...mod, isModelDownloaded: vi.fn(() => true) };
});

/* ------------------------------------------------------------------ */
/*  Imports (after mock setup)                                         */
/* ------------------------------------------------------------------ */

const { DEFAULT_GENERATION_FORM_VALUES } = await import("@/app/lib/validation");
const { createModelSlice } = await import("@/app/lib/store/slices/model");
const { createUISlice } = await import("@/app/lib/store/slices/ui");
const { createSettingsSlice } = await import("@/app/lib/store/slices/settings");
const { createHistorySlice } = await import("@/app/lib/store/slices/history");
const { createGenerationSlice } = await import("@/app/lib/store/slices/generation");
const { createProjectsSlice } = await import("@/app/lib/store/slices/projects");
const { createProfilesSlice } = await import("@/app/lib/store/slices/profiles");

const { create } = await import("zustand");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createStore() {
  return create<GenerationStore>((set, get) => ({
    ...createUISlice(set, get),
    ...createModelSlice(set, get),
    ...createGenerationSlice(set, get),
    ...createHistorySlice(set, get),
    ...createProjectsSlice(set, get),
    ...createSettingsSlice(set, get),
    ...createProfilesSlice(set, get),
  }));
}

function defaultForm(overrides: Partial<GenerationFormValues> = {}): GenerationFormValues {
  return { ...DEFAULT_GENERATION_FORM_VALUES, ...overrides };
}

function profile(overrides: Partial<GenerationProfile> = {}): GenerationProfile {
  return {
    id: "prof-1",
    name: "My Profile",
    createdAt: "2026-04-29T00:00:00Z",
    updatedAt: "2026-04-29T00:00:00Z",
    modelVariant: "acestep-v15-turbo",
    durationSeconds: 60,
    audioFormat: "mp3",
    thinking: true,
    inferenceSteps: 16,
    guidanceScale: 7.5,
    bpm: 120,
    keyScale: "C",
    timeSignature: "3",
    vocalLanguage: "en",
    lmBackend: "mlx",
    ...overrides,
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "My Project",
    createdAt: "2026-04-29T00:00:00Z",
    updatedAt: "2026-04-29T00:00:00Z",
    ...overrides,
  };
}

function record(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
  return {
    id: "rec-1",
    createdAt: "2026-04-29T00:00:00Z",
    prompt: "ambient piano",
    lyrics: "",
    vocalLanguage: "en",
    durationSeconds: 30,
    timeSignature: "4",
    model: "acestep-v15-turbo",
    taskType: "text2music",
    thinking: true,
    inferenceSteps: 8,
    guidanceScale: 7,
    useFormat: false,
    useCotCaption: true,
    useCotLanguage: true,
    constrainedDecoding: true,
    useRandomSeed: false,
    seed: 42,
    audioFormat: "wav",
    outputPath: "/tmp/rec-1.wav",
    status: "completed",
    errorMessage: null,
    isFavorite: false,
    projectId: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  beforeEach                                                         */
/* ------------------------------------------------------------------ */

let store: ReturnType<typeof createStore>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.isTauriRuntime.mockReturnValue(false);
  store = createStore();
  store.setState({
    form: defaultForm(),
    profiles: [],
    projects: [],
    activeProjectId: null,
    history: [],
  });
});

/* ================================================================== */
/*  Profiles Slice                                                     */
/* ================================================================== */

describe("Profiles slice", () => {
  /* --- initial state --------------------------------------------- */

  describe("initial state", () => {
    it("starts with an empty profiles array", () => {
      expect(store.getState().profiles).toEqual([]);
    });

    it("exposes all profile action functions", () => {
      const s = store.getState();
      expect(typeof s.refreshProfiles).toBe("function");
      expect(typeof s.createProfile).toBe("function");
      expect(typeof s.renameProfile).toBe("function");
      expect(typeof s.deleteProfile).toBe("function");
      expect(typeof s.applyProfile).toBe("function");
    });
  });

  /* --- refreshProfiles ------------------------------------------- */

  describe("refreshProfiles", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);

      await store.getState().refreshProfiles();

      expect(mockApi.listProfiles).not.toHaveBeenCalled();
      expect(store.getState().profiles).toEqual([]);
    });

    it("loads profiles from the api in Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      const profiles = [profile({ id: "a" }), profile({ id: "b", name: "Other" })];
      mockApi.listProfiles.mockResolvedValue(profiles);

      await store.getState().refreshProfiles();

      expect(mockApi.listProfiles).toHaveBeenCalledOnce();
      expect(store.getState().profiles).toEqual(profiles);
    });

    it("swallows errors and leaves profiles unchanged", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      const existing = [profile({ id: "keep" })];
      store.setState({ profiles: existing });
      mockApi.listProfiles.mockRejectedValue(new Error("boom"));

      await store.getState().refreshProfiles();

      expect(store.getState().profiles).toBe(existing);
    });

    it("replaces existing profiles on refresh", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ profiles: [profile({ id: "old" })] });
      mockApi.listProfiles.mockResolvedValue([profile({ id: "new" })]);

      await store.getState().refreshProfiles();

      expect(store.getState().profiles.map((p) => p.id)).toEqual(["new"]);
    });
  });

  /* --- createProfile --------------------------------------------- */

  describe("createProfile", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);

      await store.getState().createProfile("name", defaultForm());

      expect(mockApi.createProfile).not.toHaveBeenCalled();
      expect(store.getState().profiles).toEqual([]);
    });

    it("creates a profile and prepends it to the list", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      const created = profile({ id: "new" });
      mockApi.createProfile.mockResolvedValue(created);
      store.setState({ profiles: [profile({ id: "existing" })] });

      await store.getState().createProfile("New", defaultForm());

      expect(mockApi.createProfile).toHaveBeenCalledOnce();
      const arg = mockApi.createProfile.mock.calls[0][0];
      expect(arg.name).toBe("New");
      expect(arg.modelVariant).toBe("acestep-v15-turbo");
      expect(arg.durationSeconds).toBe(30);
      expect(arg.inferenceSteps).toBe(8);
      expect(arg.guidanceScale).toBe(7);
      expect(arg.bpm).toBe(null); // empty string -> null
      expect(arg.audioFormat).toBe("wav");
      expect(arg.thinking).toBe(true);
      expect(arg.timeSignature).toBe("4");
      expect(arg.lmBackend).toBe("mlx");

      expect(store.getState().profiles.map((p) => p.id)).toEqual(["new", "existing"]);
    });

    it("coerces NaN numeric fields to null", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      mockApi.createProfile.mockResolvedValue(profile({ id: "x" }));

      await store
        .getState()
        .createProfile(
          "X",
          defaultForm({ durationSeconds: "abc", inferenceSteps: "nope", guidanceScale: "" }),
        );

      const arg = mockApi.createProfile.mock.calls[0][0];
      expect(arg.durationSeconds).toBeNull();
      expect(arg.inferenceSteps).toBeNull();
      expect(arg.guidanceScale).toBeNull();
    });

    it("parses valid numeric strings into numbers", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      mockApi.createProfile.mockResolvedValue(profile({ id: "x" }));

      await store.getState().createProfile(
        "X",
        defaultForm({
          durationSeconds: "120",
          inferenceSteps: "20",
          guidanceScale: "3.5",
          bpm: "90",
        }),
      );

      const arg = mockApi.createProfile.mock.calls[0][0];
      expect(arg.durationSeconds).toBe(120);
      expect(arg.inferenceSteps).toBe(20);
      expect(arg.guidanceScale).toBe(3.5);
      expect(arg.bpm).toBe(90);
    });

    it("maps empty model/audio/key/time/vocal/lm to null", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      mockApi.createProfile.mockResolvedValue(profile({ id: "x" }));

      await store.getState().createProfile(
        "X",
        defaultForm({
          model: "",
          audioFormat: undefined,
          keyScale: "",
          timeSignature: undefined,
          vocalLanguage: "",
          lmBackend: undefined,
        }),
      );

      const arg = mockApi.createProfile.mock.calls[0][0];
      expect(arg.modelVariant).toBeNull();
      expect(arg.audioFormat).toBeNull();
      expect(arg.keyScale).toBeNull();
      expect(arg.timeSignature).toBeNull();
      expect(arg.vocalLanguage).toBeNull();
      expect(arg.lmBackend).toBeNull();
    });
  });

  /* --- renameProfile --------------------------------------------- */

  describe("renameProfile", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);
      store.setState({ profiles: [profile({ id: "p1", name: "Old" })] });

      await store.getState().renameProfile("p1", "New");

      expect(mockApi.renameProfile).not.toHaveBeenCalled();
      expect(store.getState().profiles[0].name).toBe("Old");
    });

    it("replaces the matching profile with the updated one", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        profiles: [profile({ id: "p1", name: "Old" }), profile({ id: "p2", name: "Keep" })],
      });
      const updated = profile({ id: "p1", name: "New" });
      mockApi.renameProfile.mockResolvedValue(updated);

      await store.getState().renameProfile("p1", "New");

      expect(mockApi.renameProfile).toHaveBeenCalledWith("p1", "New");
      const profiles = store.getState().profiles;
      expect(profiles).toHaveLength(2);
      expect(profiles[0].name).toBe("New");
      expect(profiles[1].name).toBe("Keep");
    });

    it("leaves other profiles untouched when id not found", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      const existing = [profile({ id: "p1", name: "Old" })];
      store.setState({ profiles: existing });
      mockApi.renameProfile.mockResolvedValue(profile({ id: "missing", name: "X" }));

      await store.getState().renameProfile("missing", "X");

      // The api is still called, but the returned profile doesn't match any id
      expect(mockApi.renameProfile).toHaveBeenCalledWith("missing", "X");
      expect(store.getState().profiles.map((p) => p.id)).toEqual(["p1"]);
    });
  });

  /* --- deleteProfile --------------------------------------------- */

  describe("deleteProfile", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);
      store.setState({ profiles: [profile({ id: "p1" })] });

      await store.getState().deleteProfile("p1");

      expect(mockApi.deleteProfile).not.toHaveBeenCalled();
      expect(store.getState().profiles).toHaveLength(1);
    });

    it("removes the matching profile from the list", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        profiles: [profile({ id: "p1" }), profile({ id: "p2" })],
      });
      mockApi.deleteProfile.mockResolvedValue(undefined);

      await store.getState().deleteProfile("p1");

      expect(mockApi.deleteProfile).toHaveBeenCalledWith("p1");
      expect(store.getState().profiles.map((p) => p.id)).toEqual(["p2"]);
    });

    it("results in an empty list when deleting the only profile", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ profiles: [profile({ id: "p1" })] });
      mockApi.deleteProfile.mockResolvedValue(undefined);

      await store.getState().deleteProfile("p1");

      expect(store.getState().profiles).toEqual([]);
    });

    it("is a no-op on the list when id is not present", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ profiles: [profile({ id: "p1" })] });
      mockApi.deleteProfile.mockResolvedValue(undefined);

      await store.getState().deleteProfile("ghost");

      expect(mockApi.deleteProfile).toHaveBeenCalledWith("ghost");
      expect(store.getState().profiles.map((p) => p.id)).toEqual(["p1"]);
    });
  });

  /* --- applyProfile ---------------------------------------------- */

  describe("applyProfile", () => {
    it("is a no-op when the profile id is not found", () => {
      store.setState({
        profiles: [],
        form: defaultForm({ prompt: "keep" }),
      });

      store.getState().applyProfile("missing");

      expect(store.getState().form.prompt).toBe("keep");
    });

    it("applies all valid fields from the profile to the form", () => {
      const p = profile({
        id: "p1",
        modelVariant: "acestep-v15-xl-turbo",
        durationSeconds: 90,
        audioFormat: "flac",
        thinking: false,
        inferenceSteps: 24,
        guidanceScale: 4.5,
        bpm: 140,
        keyScale: "D",
        timeSignature: "6",
        vocalLanguage: "ja",
        lmBackend: "pt",
      });
      store.setState({ profiles: [p], form: defaultForm() });

      store.getState().applyProfile("p1");

      const form = store.getState().form;
      expect(form.model).toBe("acestep-v15-xl-turbo");
      expect(form.durationSeconds).toBe("90");
      expect(form.audioFormat).toBe("flac");
      expect(form.thinking).toBe(false);
      expect(form.inferenceSteps).toBe("24");
      expect(form.guidanceScale).toBe("4.5");
      expect(form.bpm).toBe("140");
      expect(form.keyScale).toBe("D");
      expect(form.timeSignature).toBe("6");
      expect(form.vocalLanguage).toBe("ja");
      expect(form.lmBackend).toBe("pt");
    });

    it("preserves current form values when profile fields are null", () => {
      const p = profile({
        id: "p1",
        modelVariant: null,
        durationSeconds: null,
        audioFormat: null,
        thinking: null,
        inferenceSteps: null,
        guidanceScale: null,
        bpm: null,
        keyScale: null,
        timeSignature: null,
        vocalLanguage: null,
        lmBackend: null,
      });
      const base = defaultForm({
        model: "current-model",
        durationSeconds: "45",
        audioFormat: "ogg",
        thinking: true,
        inferenceSteps: "10",
        guidanceScale: "2.0",
        bpm: "80",
        keyScale: "E",
        timeSignature: "2",
        vocalLanguage: "fr",
        lmBackend: "vllm",
      });
      store.setState({ profiles: [p], form: base });

      store.getState().applyProfile("p1");

      const form = store.getState().form;
      expect(form.model).toBe("current-model");
      expect(form.durationSeconds).toBe("45");
      expect(form.audioFormat).toBe("ogg");
      expect(form.thinking).toBe(true);
      expect(form.inferenceSteps).toBe("10");
      expect(form.guidanceScale).toBe("2.0");
      expect(form.bpm).toBe("80");
      expect(form.keyScale).toBe("E");
      expect(form.timeSignature).toBe("2");
      expect(form.vocalLanguage).toBe("fr");
      expect(form.lmBackend).toBe("vllm");
    });

    it("falls back to current form value when audioFormat is invalid", () => {
      const p = profile({ id: "p1", audioFormat: "invalid-format" as unknown as string });
      store.setState({
        profiles: [p],
        form: defaultForm({ audioFormat: "wav" }),
      });

      store.getState().applyProfile("p1");

      expect(store.getState().form.audioFormat).toBe("wav");
    });

    it("falls back to current form value when timeSignature is invalid", () => {
      const p = profile({ id: "p1", timeSignature: "5" as unknown as string });
      store.setState({
        profiles: [p],
        form: defaultForm({ timeSignature: "4" }),
      });

      store.getState().applyProfile("p1");

      expect(store.getState().form.timeSignature).toBe("4");
    });

    it("falls back to current form value when lmBackend is invalid", () => {
      const p = profile({ id: "p1", lmBackend: "cuda" as unknown as string });
      store.setState({
        profiles: [p],
        form: defaultForm({ lmBackend: "mlx" }),
      });

      store.getState().applyProfile("p1");

      expect(store.getState().form.lmBackend).toBe("mlx");
    });

    it("recomputes validation state with showErrors disabled", () => {
      const p = profile({ id: "p1" });
      store.setState({
        profiles: [p],
        form: defaultForm(),
        validationErrors: { prompt: "required" },
      });

      store.getState().applyProfile("p1");

      // showErrors:false clears validationErrors
      expect(store.getState().validationErrors).toEqual({});
    });

    it("merges profile onto existing form, preserving unrelated fields", () => {
      const p = profile({ id: "p1", durationSeconds: 100 });
      store.setState({
        profiles: [p],
        form: defaultForm({ prompt: "my prompt", lyrics: "la la la" }),
      });

      store.getState().applyProfile("p1");

      const form = store.getState().form;
      expect(form.prompt).toBe("my prompt");
      expect(form.lyrics).toBe("la la la");
      expect(form.durationSeconds).toBe("100");
    });

    it("handles empty profiles array gracefully", () => {
      store.setState({ profiles: [], form: defaultForm({ prompt: "x" }) });

      store.getState().applyProfile("anything");

      expect(store.getState().form.prompt).toBe("x");
    });
  });
});

/* ================================================================== */
/*  Projects Slice                                                     */
/* ================================================================== */

describe("Projects slice", () => {
  /* --- initial state --------------------------------------------- */

  describe("initial state", () => {
    it("starts with an empty projects array", () => {
      expect(store.getState().projects).toEqual([]);
    });

    it("starts with null activeProjectId", () => {
      expect(store.getState().activeProjectId).toBeNull();
    });

    it("exposes all project action functions", () => {
      const s = store.getState();
      expect(typeof s.refreshProjects).toBe("function");
      expect(typeof s.createProject).toBe("function");
      expect(typeof s.renameProject).toBe("function");
      expect(typeof s.deleteProject).toBe("function");
      expect(typeof s.setActiveProject).toBe("function");
      expect(typeof s.assignGenerationToProject).toBe("function");
    });
  });

  /* --- refreshProjects ------------------------------------------- */

  describe("refreshProjects", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);

      await store.getState().refreshProjects();

      expect(mockApi.listProjects).not.toHaveBeenCalled();
      expect(store.getState().projects).toEqual([]);
    });

    it("loads projects from the api in Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      const projects = [project({ id: "a" }), project({ id: "b", name: "Other" })];
      mockApi.listProjects.mockResolvedValue(projects);

      await store.getState().refreshProjects();

      expect(mockApi.listProjects).toHaveBeenCalledOnce();
      expect(store.getState().projects).toEqual(projects);
    });

    it("replaces existing projects on refresh", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ projects: [project({ id: "old" })] });
      mockApi.listProjects.mockResolvedValue([project({ id: "new" })]);

      await store.getState().refreshProjects();

      expect(store.getState().projects.map((p) => p.id)).toEqual(["new"]);
    });
  });

  /* --- createProject --------------------------------------------- */

  describe("createProject", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);

      await store.getState().createProject("name");

      expect(mockApi.createProject).not.toHaveBeenCalled();
      expect(store.getState().projects).toEqual([]);
    });

    it("creates a project and prepends it to the list", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      const created = project({ id: "new", name: "New" });
      mockApi.createProject.mockResolvedValue(created);
      store.setState({ projects: [project({ id: "existing" })] });

      await store.getState().createProject("New");

      expect(mockApi.createProject).toHaveBeenCalledWith("New");
      expect(store.getState().projects.map((p) => p.id)).toEqual(["new", "existing"]);
    });

    it("prepends to an empty list", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      mockApi.createProject.mockResolvedValue(project({ id: "only" }));

      await store.getState().createProject("Only");

      expect(store.getState().projects.map((p) => p.id)).toEqual(["only"]);
    });
  });

  /* --- renameProject --------------------------------------------- */

  describe("renameProject", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);
      store.setState({ projects: [project({ id: "p1", name: "Old" })] });

      await store.getState().renameProject("p1", "New");

      expect(mockApi.renameProject).not.toHaveBeenCalled();
      expect(store.getState().projects[0].name).toBe("Old");
    });

    it("replaces the matching project with the updated one", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        projects: [project({ id: "p1", name: "Old" }), project({ id: "p2", name: "Keep" })],
      });
      const updated = project({ id: "p1", name: "New" });
      mockApi.renameProject.mockResolvedValue(updated);

      await store.getState().renameProject("p1", "New");

      expect(mockApi.renameProject).toHaveBeenCalledWith("p1", "New");
      const projects = store.getState().projects;
      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe("New");
      expect(projects[1].name).toBe("Keep");
    });

    it("leaves other projects untouched when id not found", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ projects: [project({ id: "p1", name: "Old" })] });
      mockApi.renameProject.mockResolvedValue(project({ id: "missing", name: "X" }));

      await store.getState().renameProject("missing", "X");

      expect(mockApi.renameProject).toHaveBeenCalledWith("missing", "X");
      expect(store.getState().projects.map((p) => p.id)).toEqual(["p1"]);
    });
  });

  /* --- deleteProject --------------------------------------------- */

  describe("deleteProject", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);
      store.setState({ projects: [project({ id: "p1" })] });

      await store.getState().deleteProject("p1");

      expect(mockApi.deleteProject).not.toHaveBeenCalled();
      expect(store.getState().projects).toHaveLength(1);
    });

    it("removes the matching project from the list", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        projects: [project({ id: "p1" }), project({ id: "p2" })],
      });
      mockApi.deleteProject.mockResolvedValue(undefined);

      await store.getState().deleteProject("p1");

      expect(mockApi.deleteProject).toHaveBeenCalledWith("p1");
      expect(store.getState().projects.map((p) => p.id)).toEqual(["p2"]);
    });

    it("clears activeProjectId when the active project is deleted", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        projects: [project({ id: "p1" })],
        activeProjectId: "p1",
      });
      mockApi.deleteProject.mockResolvedValue(undefined);

      await store.getState().deleteProject("p1");

      expect(store.getState().activeProjectId).toBeNull();
    });

    it("preserves activeProjectId when a different project is deleted", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        projects: [project({ id: "p1" }), project({ id: "p2" })],
        activeProjectId: "p2",
      });
      mockApi.deleteProject.mockResolvedValue(undefined);

      await store.getState().deleteProject("p1");

      expect(store.getState().activeProjectId).toBe("p2");
    });

    it("nullifies projectId on history records belonging to the deleted project", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        projects: [project({ id: "p1" })],
        history: [
          record({ id: "r1", projectId: "p1" }),
          record({ id: "r2", projectId: "p2" }),
          record({ id: "r3", projectId: null }),
        ],
      });
      mockApi.deleteProject.mockResolvedValue(undefined);

      await store.getState().deleteProject("p1");

      const history = store.getState().history;
      expect(history[0].projectId).toBeNull();
      expect(history[1].projectId).toBe("p2");
      expect(history[2].projectId).toBeNull();
    });

    it("results in an empty list when deleting the only project", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ projects: [project({ id: "p1" })] });
      mockApi.deleteProject.mockResolvedValue(undefined);

      await store.getState().deleteProject("p1");

      expect(store.getState().projects).toEqual([]);
    });
  });

  /* --- setActiveProject ------------------------------------------ */

  describe("setActiveProject", () => {
    it("sets activeProjectId to the given id", () => {
      store.setState({ activeProjectId: null });

      store.getState().setActiveProject("p1");

      expect(store.getState().activeProjectId).toBe("p1");
    });

    it("sets activeProjectId to null", () => {
      store.setState({ activeProjectId: "p1" });

      store.getState().setActiveProject(null);

      expect(store.getState().activeProjectId).toBeNull();
    });

    it("can switch between projects", () => {
      store.setState({ activeProjectId: "p1" });

      store.getState().setActiveProject("p2");

      expect(store.getState().activeProjectId).toBe("p2");
    });

    it("works regardless of Tauri runtime (pure sync action)", () => {
      mockApi.isTauriRuntime.mockReturnValue(true);

      store.getState().setActiveProject("p1");

      expect(store.getState().activeProjectId).toBe("p1");
    });
  });

  /* --- assignGenerationToProject --------------------------------- */

  describe("assignGenerationToProject", () => {
    it("is a no-op in non-Tauri runtime", async () => {
      mockApi.isTauriRuntime.mockReturnValue(false);
      store.setState({ history: [record({ id: "r1", projectId: null })] });

      await store.getState().assignGenerationToProject("r1", "p1");

      expect(mockApi.assignGenerationToProject).not.toHaveBeenCalled();
      expect(store.getState().history[0].projectId).toBeNull();
    });

    it("assigns a generation to a project", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        history: [record({ id: "r1", projectId: null }), record({ id: "r2", projectId: "p2" })],
      });
      mockApi.assignGenerationToProject.mockResolvedValue(undefined);

      await store.getState().assignGenerationToProject("r1", "p1");

      expect(mockApi.assignGenerationToProject).toHaveBeenCalledWith("r1", "p1");
      const history = store.getState().history;
      expect(history[0].projectId).toBe("p1");
      expect(history[1].projectId).toBe("p2");
    });

    it("unassigns a generation by passing null", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ history: [record({ id: "r1", projectId: "p1" })] });
      mockApi.assignGenerationToProject.mockResolvedValue(undefined);

      await store.getState().assignGenerationToProject("r1", null);

      expect(mockApi.assignGenerationToProject).toHaveBeenCalledWith("r1", null);
      expect(store.getState().history[0].projectId).toBeNull();
    });

    it("leaves other records untouched", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({
        history: [record({ id: "r1", projectId: "p1" }), record({ id: "r2", projectId: "p2" })],
      });
      mockApi.assignGenerationToProject.mockResolvedValue(undefined);

      await store.getState().assignGenerationToProject("r1", "p3");

      const history = store.getState().history;
      expect(history[0].projectId).toBe("p3");
      expect(history[1].projectId).toBe("p2");
    });

    it("is a no-op on history when generation id is not found", async () => {
      mockApi.isTauriRuntime.mockReturnValue(true);
      store.setState({ history: [record({ id: "r1", projectId: "p1" })] });
      mockApi.assignGenerationToProject.mockResolvedValue(undefined);

      await store.getState().assignGenerationToProject("ghost", "p2");

      expect(mockApi.assignGenerationToProject).toHaveBeenCalledWith("ghost", "p2");
      expect(store.getState().history[0].projectId).toBe("p1");
    });
  });
});
