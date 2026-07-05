import type { ModelCatalogItem, ModelVariant } from "@/app/lib/types";

/**
 * Static model catalog — the list of available model variants and their
 * metadata. Extracted from the model slice so the slice file stays focused
 * on state management logic.
 */
export const MODEL_CATALOG: ModelCatalogItem[] = (["lite", "turbo", "pro"] as ModelVariant[]).map(
  (id) => {
    const label = id === "pro" ? "XL Turbo" : id === "lite" ? "Lite" : "Turbo";
    const modelName = id === "pro" ? "acestep-v15-xl-turbo" : "acestep-v15-turbo";
    return {
      variant: id,
      label,
      modelName,
      lmModel: id === "pro" ? "acestep-5Hz-lm-1.7B" : "acestep-5Hz-lm-0.6B",
      lmBackend: "mlx" as const,
      estimatedSizeBytes: id === "pro" ? 22 * 1024 * 1024 * 1024 : 8 * 1024 * 1024 * 1024,
      description: "",
      recommendedMemoryGb: id === "pro" ? 20 : id === "lite" ? 8 : 16,
    };
  },
);
