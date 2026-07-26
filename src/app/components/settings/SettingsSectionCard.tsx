import type { ReactNode } from "react";

interface SettingsSectionCardProps {
  id?: string;
  title: string;
  description?: string;
  tone?: "default" | "danger";
  headerAction?: ReactNode;
  children: ReactNode;
}

export function SettingsSectionCard({
  id,
  title,
  description,
  tone = "default",
  headerAction,
  children,
}: SettingsSectionCardProps) {
  const isDanger = tone === "danger";

  return (
    <section
      id={id}
      className={`space-y-3 rounded-lg border p-5 scroll-mt-6 ${
        isDanger
          ? "border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] bg-[var(--color-sidebar)]"
          : "border-[var(--color-border)] bg-[var(--color-sidebar)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <label
            className={`text-[13px] font-semibold tracking-tight ${
              isDanger ? "text-[var(--color-destructive)]" : "text-[var(--color-text)]"
            }`}
          >
            {title}
          </label>
          {description ? (
            <p className="text-[12px] text-[var(--color-text-dim)]">{description}</p>
          ) : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      {children}
    </section>
  );
}
