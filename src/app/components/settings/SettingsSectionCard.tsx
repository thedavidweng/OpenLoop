import type { ReactNode } from "react";

interface SettingsSectionCardProps {
  id?: string;
  title: string;
  description?: string;
  tone?: "default" | "danger";
  children: ReactNode;
}

export function SettingsSectionCard({
  id,
  title,
  description,
  tone = "default",
  children,
}: SettingsSectionCardProps) {
  const isDanger = tone === "danger";

  return (
    <section
      id={id}
      className={`space-y-3 rounded-lg border p-5 scroll-mt-6 ${
        isDanger
          ? "border-red-500/30 bg-[var(--color-sidebar)]"
          : "border-[var(--color-border)] bg-[var(--color-sidebar)]"
      }`}
    >
      <div className="space-y-1">
        <label
          className={`text-[12px] font-medium uppercase ${
            isDanger ? "text-red-400" : "text-[var(--color-text-dim)]"
          }`}
        >
          {title}
        </label>
        {description ? (
          <p className="text-[12px] text-[var(--color-text-dim)]">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
