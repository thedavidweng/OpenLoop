// Re-export the sliced store to preserve backward compatibility.
// All logic has been extracted into slice modules under store/slices/.
export {
  MODEL_PACKS,
  MODEL_VARIANTS,
  isModelDownloaded,
  modelDownloadStateForVariant,
  type ModelPackId,
} from "@/app/lib/model-packs";

export { useGenerationStore } from "@/app/lib/store/index";
export type { GenerationStore } from "@/app/lib/store/types";
