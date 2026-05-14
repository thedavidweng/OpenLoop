import { create } from "zustand";
import type { GenerationStore } from "@/app/lib/store/types";
import { createUISlice } from "@/app/lib/store/slices/ui";
import { createModelSlice } from "@/app/lib/store/slices/model";
import { createGenerationSlice } from "@/app/lib/store/slices/generation";
import { createHistorySlice } from "@/app/lib/store/slices/history";
import { createSettingsSlice } from "@/app/lib/store/slices/settings";

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  ...createUISlice(set, get),
  ...createModelSlice(set, get),
  ...createGenerationSlice(set, get),
  ...createHistorySlice(set, get),
  ...createSettingsSlice(set, get),
}));
