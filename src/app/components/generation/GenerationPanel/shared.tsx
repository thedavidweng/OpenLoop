import type { ChangeEvent } from "react";
import type React from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileAudio, X } from "lucide-react";
import * as api from "@/app/lib/api";

export type TextField =
  | "prompt"
  | "negativePrompt"
  | "lyrics"
  | "vocalLanguage"
  | "durationSeconds"
  | "bpm"
  | "keyScale"
  | "model"
  | "lmModelPath"
  | "inferenceSteps"
  | "guidanceScale"
  | "seed"
  | "referenceAudioPath"
  | "srcAudioPath"
  | "instruction"
  | "repaintingStart"
  | "repaintingEnd"
  | "audioCoverStrength";

export type ToggleField =
  | "thinking"
  | "useRandomSeed"
  | "useFormat"
  | "useCotCaption"
  | "useCotLanguage"
  | "constrainedDecoding";

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[11px] text-red-300">
      {message}
    </p>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
      {children}
    </span>
  );
}

export function FilePickerField({
  label,
  value,
  onChange,
  disabled,
  filters,
}: {
  label: string;
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  filters?: { name: string; extensions: string[] }[];
}) {
  const { t } = useTranslation();

  const handleBrowse = useCallback(async () => {
    if (!api.isTauriRuntime()) return;
    try {
      const selected = await api.openFileDialog({
        multiple: false,
        filters: filters ?? [{ name: "Audio", extensions: ["mp3", "wav", "flac", "m4a", "ogg"] }],
      });
      if (selected && typeof selected === "string") {
        onChange(selected);
      }
    } catch {
      // User cancelled
    }
  }, [onChange, filters]);

  return (
    <label className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-2">
        <input
          className="text-input flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={api.isTauriRuntime()}
        />
        {api.isTauriRuntime() && (
          <button
            type="button"
            className="secondary-button shrink-0"
            onClick={handleBrowse}
            disabled={disabled}
          >
            <FileAudio size={13} />
            {t("generation.chooseFile")}
          </button>
        )}
        {value && (
          <button
            type="button"
            className="secondary-button shrink-0 px-2"
            onClick={() => onChange("")}
            disabled={disabled}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </label>
  );
}

export function handleTextFieldChange(
  field: TextField,
  setField: (field: TextField, value: string) => void,
) {
  return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setField(field, event.target.value);
  };
}
