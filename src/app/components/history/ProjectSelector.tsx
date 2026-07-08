import { useState } from "react";
import { FolderPlus, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGenerationStore } from "@/app/lib/store";
import { useToast } from "@/app/components/overlay/Toast";

export function ProjectSelector() {
  const { t } = useTranslation();
  const projects = useGenerationStore((state) => state.projects);
  const activeProjectId = useGenerationStore((state) => state.activeProjectId);
  const setActiveProject = useGenerationStore((state) => state.setActiveProject);
  const createProject = useGenerationStore((state) => state.createProject);
  const deleteProject = useGenerationStore((state) => state.deleteProject);
  const { addToast } = useToast();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createProject(name);
      setNewName("");
      setCreating(false);
      addToast("success", t("projects.created", { name }));
    } catch {
      addToast("error", t("projects.createFailed"));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("projects.deleteConfirm", { name }))) return;
    try {
      await deleteProject(id);
      addToast("success", t("projects.deleted", { name }));
    } catch {
      addToast("error", t("projects.deleteFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-[var(--color-text-dim)]">
          {t("projects.label")}
        </span>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-dimmer)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
          title={t("projects.create")}
          aria-label={t("projects.create")}
        >
          <Plus size={12} />
        </button>
      </div>

      {creating && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder={t("projects.namePlaceholder")}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="inline-flex h-6 shrink-0 items-center rounded-md bg-[var(--color-accent)] px-2 text-[11px] font-medium text-white transition-colors disabled:opacity-40"
          >
            {t("projects.add")}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setActiveProject(null)}
        className={`flex items-center justify-between rounded-md px-2 py-1 text-[11px] transition-colors ${
          activeProjectId === null
            ? "bg-[var(--color-surface-muted)] font-medium text-[var(--color-text)]"
            : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-muted)]"
        }`}
      >
        <span>{t("projects.allProjects")}</span>
      </button>

      {projects.map((project) => (
        <div
          key={project.id}
          className={`group flex items-center justify-between rounded-md px-2 py-1 text-[11px] transition-colors ${
            activeProjectId === project.id
              ? "bg-[var(--color-surface-muted)] font-medium text-[var(--color-text)]"
              : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-muted)]"
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveProject(project.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <FolderPlus size={11} className="shrink-0 text-[var(--color-text-dimmer)]" />
            <span className="truncate">{project.name}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(project.id, project.name);
            }}
            className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-text-dimmer)] opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
            title={t("projects.delete")}
            aria-label={t("projects.delete")}
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}

      {creating && (
        <button
          type="button"
          onClick={() => {
            setCreating(false);
            setNewName("");
          }}
          className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-dimmer)] hover:text-[var(--color-text-dim)]"
        >
          <X size={10} />
          {t("common.cancel")}
        </button>
      )}
    </div>
  );
}
