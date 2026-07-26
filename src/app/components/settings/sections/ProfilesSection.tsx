import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { useGenerationStore } from "@/app/lib/store";
import { useToast } from "@/app/components/overlay/Toast";

export function ProfilesSection() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const profiles = useGenerationStore((state) => state.profiles);
  const createProfile = useGenerationStore((state) => state.createProfile);
  const renameProfile = useGenerationStore((state) => state.renameProfile);
  const deleteProfile = useGenerationStore((state) => state.deleteProfile);
  const applyProfile = useGenerationStore((state) => state.applyProfile);
  const form = useGenerationStore((state) => state.form);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createProfile(name, form);
      addToast("success", t("profiles.created", { name }));
      setNewName("");
    } catch {
      addToast("error", t("profiles.createFailed"));
    }
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    try {
      await renameProfile(id, name);
      addToast("success", t("profiles.renamed"));
      setEditingId(null);
    } catch {
      addToast("error", t("profiles.renameFailed"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProfile(id);
      addToast("success", t("profiles.deleted"));
    } catch {
      addToast("error", t("profiles.deleteFailed"));
    }
  };

  return (
    <SettingsSectionCard title={t("profiles.title")} description={t("profiles.description")}>
      <div className="space-y-3">
        {/* Create new profile */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("profiles.namePlaceholder")}
            className="flex-1 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-2 text-[12px] font-medium text-[var(--color-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus size={14} />
            {t("profiles.save")}
          </button>
        </div>

        {/* Profile list */}
        {profiles.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-[var(--color-text-dim)]">
            {t("profiles.empty")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-2 rounded-md border border-[var(--color-border-light)] bg-[var(--color-surface)] px-3 py-2"
              >
                {editingId === profile.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded border border-[var(--color-accent)] bg-transparent px-2 py-1 text-[13px] text-[var(--color-text)] focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(profile.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(profile.id)}
                      className="flex h-7 w-7 items-center justify-center rounded text-emerald-400 hover:bg-[var(--color-ghost-hover)]"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)]"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => applyProfile(profile.id)}
                      className="flex-1 text-left text-[13px] font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]"
                    >
                      {profile.name}
                    </button>
                    <span className="text-[10px] text-[var(--color-text-dim)]">
                      {profile.modelVariant ?? "-"} · {profile.inferenceSteps ?? "?"} steps
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(profile.id);
                        setEditName(profile.name);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-[var(--color-text)]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(profile.id)}
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-[var(--color-destructive)]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSectionCard>
  );
}
