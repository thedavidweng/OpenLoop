import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import * as api from "@/app/lib/api";

export function createProjectsSlice(
  set: StoreApi<GenerationStore>["setState"],
  _get: StoreApi<GenerationStore>["getState"],
) {
  return {
    projects: [] as GenerationStore["projects"],
    activeProjectId: null,

    refreshProjects: async () => {
      if (!api.isTauriRuntime()) return;
      const projects = await api.listProjects();
      set({ projects });
    },

    createProject: async (name: string) => {
      if (!api.isTauriRuntime()) return;
      const project = await api.createProject(name);
      set((state) => ({ projects: [project, ...state.projects] }));
    },

    renameProject: async (id: string, name: string) => {
      if (!api.isTauriRuntime()) return;
      const updated = await api.renameProject(id, name);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated : p)),
      }));
    },

    deleteProject: async (id: string) => {
      if (!api.isTauriRuntime()) return;
      await api.deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        history: state.history.map((r) => (r.projectId === id ? { ...r, projectId: null } : r)),
      }));
    },

    setActiveProject: (id: string | null) => {
      set({ activeProjectId: id });
    },

    assignGenerationToProject: async (generationId: string, projectId: string | null) => {
      if (!api.isTauriRuntime()) return;
      await api.assignGenerationToProject(generationId, projectId);
      set((state) => ({
        history: state.history.map((r) => (r.id === generationId ? { ...r, projectId } : r)),
      }));
    },
  };
}
