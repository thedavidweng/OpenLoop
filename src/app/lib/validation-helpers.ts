import { validateGenerationForm } from "@/app/lib/validation";
import type { GenerationFormValues } from "@/app/lib/types";

export function computeValidationState(
  form: GenerationFormValues,
  options: { showErrors?: boolean } = {},
) {
  const result = validateGenerationForm(form);
  return {
    validationErrors: options.showErrors === false ? {} : result.errors,
    currentRequest: result.request,
  };
}
