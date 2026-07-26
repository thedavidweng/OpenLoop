/**
 * Structural stand-in for the app shell, shown while persisted state is still
 * hydrating.
 *
 * RATIONALE: rendering a bare wordmark meant the launch sequence went straight
 * from an empty surface to a fully populated layout. A dark outline of the
 * toolbar, sidebar, and playback bar lets the window reveal progressively —
 * frame first, content second — instead of appearing as a blank panel.
 */
export function AppShellSkeleton() {
  return (
    <div
      data-testid="app-shell-skeleton"
      aria-hidden="true"
      className="flex h-screen w-full flex-col bg-[var(--color-surface)]"
    >
      <div className="h-12 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-toolbar)]" />

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[260px] shrink-0 flex-col gap-3 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
          <div className="h-7 w-2/3 rounded-md bg-[var(--color-border)]/50" />
          <div className="mt-2 space-y-2">
            <div className="h-4 w-1/2 rounded bg-[var(--color-border)]/40" />
            <div className="h-4 w-3/4 rounded bg-[var(--color-border)]/30" />
            <div className="h-4 w-2/3 rounded bg-[var(--color-border)]/30" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1" />
          <div className="mx-3 mb-3 mt-2 h-[84px] shrink-0 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)]" />
        </div>
      </div>
    </div>
  );
}
