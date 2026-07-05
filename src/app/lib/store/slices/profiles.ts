import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type { GenerationFormValues, GenerationProfile } from "@/app/lib/types";
import * as api from "@/app/lib/api";
import { computeValidationState } from "@/app/lib/validation-helpers";

export interface ProfilesSlice {
  profiles: GenerationProfile[];
  refreshProfiles: () => Promise<void>;
  createProfile: (name: string, form: GenerationFormValues) => Promise<void>;
  renameProfile: (id: string, name: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  applyProfile: (id: string) => void;
}

export function createProfilesSlice(
  set: StoreApi<GenerationStore>["setState"],
  get: StoreApi<GenerationStore>["getState"],
): ProfilesSlice {
  return {
    profiles: [],

    refreshProfiles: async () => {
      if (!api.isTauriRuntime()) return;
      try {
        const profiles = await api.listProfiles();
        set({ profiles });
      } catch {
        // Non-fatal: profiles are optional
      }
    },

    createProfile: async (name: string, form: GenerationFormValues) => {
      if (!api.isTauriRuntime()) return;
      const durationSeconds = parseFloat(form.durationSeconds);
      const inferenceSteps = parseInt(form.inferenceSteps, 10);
      const guidanceScale = parseFloat(form.guidanceScale);
      const request = {
        name,
        modelVariant: form.model || null,
        durationSeconds: isNaN(durationSeconds) ? null : durationSeconds,
        audioFormat: form.audioFormat || null,
        thinking: form.thinking,
        inferenceSteps: isNaN(inferenceSteps) ? null : inferenceSteps,
        guidanceScale: isNaN(guidanceScale) ? null : guidanceScale,
        bpm: form.bpm ? parseInt(form.bpm, 10) : null,
        keyScale: form.keyScale || null,
        timeSignature: form.timeSignature || null,
        vocalLanguage: form.vocalLanguage || null,
        lmBackend: form.lmBackend || null,
      };
      const profile = await api.createProfile(request);
      set({ profiles: [profile, ...get().profiles] });
    },

    renameProfile: async (id: string, name: string) => {
      if (!api.isTauriRuntime()) return;
      const updated = await api.renameProfile(id, name);
      set({
        profiles: get().profiles.map((p) => (p.id === id ? updated : p)),
      });
    },

    deleteProfile: async (id: string) => {
      if (!api.isTauriRuntime()) return;
      await api.deleteProfile(id);
      set({ profiles: get().profiles.filter((p) => p.id !== id) });
    },

    applyProfile: (id: string) => {
      const profile = get().profiles.find((p) => p.id === id);
      if (!profile) return;
      const currentForm = get().form;
      const form: GenerationFormValues = {
        ...currentForm,
        model: profile.modelVariant ?? currentForm.model,
        durationSeconds: profile.durationSeconds != null
          ? String(profile.durationSeconds)
          : currentForm.durationSeconds,
        audioFormat: (profile.audioFormat as GenerationFormValues["audioFormat"]) ?? currentForm.audioFormat,
        thinking: profile.thinking ?? currentForm.thinking,
        inferenceSteps: profile.inferenceSteps != null
          ? String(profile.inferenceSteps)
          : currentForm.inferenceSteps,
        guidanceScale: profile.guidanceScale != null
          ? String(profile.guidanceScale)
          : currentForm.guidanceScale,
        bpm: profile.bpm != null ? String(profile.bpm) : currentForm.bpm,
        keyScale: profile.keyScale ?? currentForm.keyScale,
        timeSignature: (profile.timeSignature as GenerationFormValues["timeSignature"]) ?? currentForm.timeSignature,
        vocalLanguage: profile.vocalLanguage ?? currentForm.vocalLanguage,
        lmBackend: (profile.lmBackend as GenerationFormValues["lmBackend"]) ?? currentForm.lmBackend,
      };
      set({
        form,
        ...computeValidationState(form, { showErrors: false }),
      });
    },
  };
}
