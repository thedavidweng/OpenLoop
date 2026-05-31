import {
  modelNameForVariant,
  lmModelPathForVariant,
} from "@/app/lib/model-packs";
import type {
  AppSettings,
  GenerationFormValues,
  ModelVariant,
} from "@/app/lib/types";

const VARIANT_BY_PROFILE = {
  "low-memory": "lite" as const,
  standard: "turbo" as const,
  quality: "pro" as const,
  unsupported: "turbo" as const,
};

function variantModel(profile: keyof typeof VARIANT_BY_PROFILE) {
  const variant = VARIANT_BY_PROFILE[profile];
  return {
    model: modelNameForVariant(variant),
    lmModelPath: lmModelPathForVariant(variant),
  };
}

export const PROFILE_FORM_PRESETS = {
  "low-memory": {
    ...variantModel("low-memory"),
    lmBackend: "mlx",
    thinking: false,
    inferenceSteps: "6",
    guidanceScale: "6.0",
    useFormat: false,
    useCotCaption: false,
    useCotLanguage: false,
    constrainedDecoding: false,
  },
  standard: {
    ...variantModel("standard"),
    lmBackend: "mlx",
    thinking: true,
    inferenceSteps: "8",
    guidanceScale: "7.0",
    useFormat: false,
    useCotCaption: true,
    useCotLanguage: true,
    constrainedDecoding: true,
  },
  quality: {
    ...variantModel("quality"),
    lmBackend: "mlx",
    thinking: true,
    inferenceSteps: "10",
    guidanceScale: "7.5",
    useFormat: false,
    useCotCaption: true,
    useCotLanguage: true,
    constrainedDecoding: true,
  },
  unsupported: {
    ...variantModel("unsupported"),
    lmBackend: "mlx",
    thinking: false,
    inferenceSteps: "6",
    guidanceScale: "6.5",
    useFormat: false,
    useCotCaption: false,
    useCotLanguage: false,
    constrainedDecoding: false,
  },
} satisfies Record<
  AppSettings["profile"],
  Pick<
    GenerationFormValues,
    | "model"
    | "lmModelPath"
    | "lmBackend"
    | "thinking"
    | "inferenceSteps"
    | "guidanceScale"
    | "useFormat"
    | "useCotCaption"
    | "useCotLanguage"
    | "constrainedDecoding"
  >
>;

export function applyProfilePreset(
  form: GenerationFormValues,
  profile: AppSettings["profile"],
) {
  const preset = PROFILE_FORM_PRESETS[profile];
  return {
    ...form,
    model: preset.model,
    lmModelPath: preset.lmModelPath,
    lmBackend: preset.lmBackend,
    thinking: preset.thinking,
    inferenceSteps: preset.inferenceSteps,
    guidanceScale: preset.guidanceScale,
    useFormat: preset.useFormat,
    useCotCaption: preset.useCotCaption,
    useCotLanguage: preset.useCotLanguage,
    constrainedDecoding: preset.constrainedDecoding,
  };
}

export function applyModelVariantToForm(
  form: GenerationFormValues,
  variant: ModelVariant | null,
) {
  if (!variant) {
    return form;
  }
  return {
    ...form,
    model: modelNameForVariant(variant),
  };
}
