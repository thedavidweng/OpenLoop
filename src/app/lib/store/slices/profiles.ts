import type { GenerationStore } from "@/app/lib/store/types";
import type { StoreApi } from "zustand";
import type {
  AudioFormat,
  GenerationFormValues,
  GenerationProfile,
  LmBackend,
  TimeSignature,
} from "@/app/lib/types";
import * as api from "@/app/lib/api";
import { computeValidationState } from "@/app/lib/validation-helpers";

const AUDIO_FORMATS: readonly AudioFormat[] = ["wav", "mp3", "flac", "ogg"];
const TIME_SIGNATURES: readonly TimeSignature[] = ["2", "3", "4", "6"];
const LM_BACKENDS: readonly LmBackend[] = ["pt", "vllm", "mlx"];

function isAudioFormat(value: string | null | undefined): value is AudioFormat {
  return (
    value !== null && value !== undefined && (AUDIO_FORMATS as readonly string[]).includes(value)
  );
}

function isTimeSignature(value: string | null | undefined): value is TimeSignature {
  return (
    value !== null && value !== undefined && (TIME_SIGNATURES as readonly string[]).includes(value)
  );
}

function isLmBackend(value: string | null | undefined): value is LmBackend {
  return (
    value !== null && value !== undefined && (LM_BACKENDS as readonly string[]).includes(value)
  );
}

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
        durationSeconds:
          profile.durationSeconds != null
            ? String(profile.durationSeconds)
            : currentForm.durationSeconds,
        audioFormat: isAudioFormat(profile.audioFormat)
          ? profile.audioFormat
          : currentForm.audioFormat,
        thinking: profile.thinking ?? currentForm.thinking,
        inferenceSteps:
          profile.inferenceSteps != null
            ? String(profile.inferenceSteps)
            : currentForm.inferenceSteps,
        guidanceScale:
          profile.guidanceScale != null ? String(profile.guidanceScale) : currentForm.guidanceScale,
        bpm: profile.bpm != null ? String(profile.bpm) : currentForm.bpm,
        keyScale: profile.keyScale ?? currentForm.keyScale,
        timeSignature: isTimeSignature(profile.timeSignature)
          ? profile.timeSignature
          : currentForm.timeSignature,
        vocalLanguage: profile.vocalLanguage ?? currentForm.vocalLanguage,
        lmBackend: isLmBackend(profile.lmBackend) ? profile.lmBackend : currentForm.lmBackend,
      };
      set({
        form,
        ...computeValidationState(form, { showErrors: false }),
      });
    },
  };
}
