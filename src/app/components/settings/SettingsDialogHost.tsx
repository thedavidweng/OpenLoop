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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[35] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--chrome-panel-shadow)]">
        <div className="space-y-2">
          <h3 className="text-[16px] font-semibold text-white">{title}</h3>
          <p className="text-[13px] leading-6 text-[var(--color-text-dim)]">
            {message}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-red-500/40 bg-red-600/10 px-3 py-1.5 text-[12px] text-red-300 transition-colors hover:bg-red-600/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
