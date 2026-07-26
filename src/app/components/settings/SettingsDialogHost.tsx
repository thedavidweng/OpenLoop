import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface SettingsDialogHostProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SettingsDialogHost({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: SettingsDialogHostProps) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const dialog = (
    <div
      className="fixed inset-0 z-[35] flex items-center justify-center bg-[var(--color-scrim)] px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-dialog)]"
      >
        <div className="space-y-2">
          <h3 className="text-[16px] font-semibold text-white">{title}</h3>
          <p className="text-[13px] leading-6 text-[var(--color-text-dim)]">{message}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-[var(--color-destructive)] px-3 py-1.5 text-[12px] text-[var(--color-destructive-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-destructive)_90%,white)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  // In non-browser environments (SSR, static-markup tests) the portal target is
  // unavailable — render inline so the content stays reachable.
  if (typeof document === "undefined" || !document.body) {
    return dialog;
  }

  return createPortal(dialog, document.body);
}
