import { useTranslation } from "react-i18next";
import { FolderOpen } from "lucide-react";

interface DirectoryPickerRowProps {
  label: string;
  value: string;
  defaultValue: string;
  disabled?: boolean;
  onPick: () => void;
  onReset: () => void;
}

export function DirectoryPickerRow({
  label,
  value,
  defaultValue,
  disabled = false,
  onPick,
  onReset,
}: DirectoryPickerRowProps) {
  const { t } = useTranslation();
  const displayValue = value || defaultValue;
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
        {label}
      </span>
      <div className="flex flex-wrap items-stretch gap-2 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] p-1.5">
        <code
          className="min-w-0 flex-1 break-all rounded-md bg-[var(--color-surface-muted)]/60 px-3 py-2 font-mono text-[12px] leading-5 text-[var(--color-text)]"
          title={displayValue}
        >
          {displayValue || "—"}
        </code>
        <div className="flex shrink-0 items-center gap-1">
          {!value ? (
            <span className="rounded-full bg-white/6 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--color-text-dim)]">
              {t("settings.defaultPath")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onPick}
            disabled={disabled}
            className="motion-icon-button inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-2.5 text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size={12} />
            {t("settings.chooseFolder")}
          </button>
          {value ? (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              className="inline-flex h-8 items-center rounded-md px-2 text-[11px] text-[var(--color-text-dim)] hover:bg-[var(--color-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("settings.useDefault")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
