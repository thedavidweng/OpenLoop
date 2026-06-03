import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dice5, Loader2, Music2, Star, WandSparkles, X } from "lucide-react";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { useToast } from "@/app/components/overlay/Toast";
import {
  getRandomPromptExample,
  getRandomPromptByCategory,
  PROMPT_CATEGORIES,
} from "@/app/lib/prompt-examples";
import { useGenerationStore } from "@/app/lib/store";
import type { ActiveGenerationTask } from "@/app/lib/types";

interface HeaderProps {
  isBusy: boolean;
  activeTasks: ActiveGenerationTask[];
  prompt: string;
  onSetField: (field: "prompt", value: string) => void;
  onEnhancePrompt: () => Promise<void>;
  onResumeTask: (id: string) => Promise<void>;
  onDiscardTask: (id: string) => Promise<void>;
}

export function Header({
  isBusy,
  activeTasks,
  prompt,
  onSetField,
  onEnhancePrompt,
  onResumeTask,
  onDiscardTask,
}: HeaderProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [enhancing, setEnhancing] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  const recentPrompts = useGenerationStore((state) => state.recentPrompts);
  const favoritePrompts = useGenerationStore((state) => state.favoritePrompts);
  const toggleFavoritePrompt = useGenerationStore(
    (state) => state.toggleFavoritePrompt,
  );
  const removeRecentPrompt = useGenerationStore(
    (state) => state.removeRecentPrompt,
  );

  const displayedRecents = recentPrompts.slice(0, 6);
  const displayedFavorites = favoritePrompts.slice(0, 6);
  const isFavorited = favoritePrompts.includes(prompt.trim());

  const handleDiceClick = useCallback(() => {
    onSetField("prompt", getRandomPromptExample());
  }, [onSetField]);

  const handleCategorySelect = useCallback(
    (category: string) => {
      onSetField("prompt", getRandomPromptByCategory(category));
      setShowCategoryMenu(false);
    },
    [onSetField],
  );

  // Close category menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!showCategoryMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(e.target as Node)
      ) {
        setShowCategoryMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCategoryMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCategoryMenu]);

  const handleFavoriteToggle = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      addToast("error", t("toast.promptEnhanceFailed"));
      return;
    }
    toggleFavoritePrompt(trimmed);
    addToast(
      "success",
      isFavorited ? t("toast.promptUnfavorited") : t("toast.promptFavorited"),
    );
  }, [prompt, isFavorited, toggleFavoritePrompt, addToast, t]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--chrome-floating-border)] bg-[var(--chrome-floating-bg)] text-[var(--color-accent)]">
            <Music2 size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white">
              {t("generation.composerTitle")}
            </p>
            <p className="text-[12px] leading-5 text-[var(--color-text-dim)]">
              {t("generation.composerDescription")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip
            label={
              isFavorited
                ? t("generation.removeFavorite")
                : t("generation.addFavorite")
            }
          >
            <button
              type="button"
              className={`secondary-button shrink-0 px-2 ${
                isFavorited ? "text-amber-300" : ""
              }`}
              aria-label={t("generation.addFavorite")}
              onClick={handleFavoriteToggle}
              disabled={isBusy}
            >
              <Star size={14} className={isFavorited ? "fill-amber-300" : ""} />
            </button>
          </Tooltip>
          <div className="relative" ref={categoryMenuRef}>
            <Tooltip label={t("generation.randomInspiration")}>
              <button
                type="button"
                className="secondary-button shrink-0 px-2"
                aria-label={t("generation.randomInspiration")}
                onClick={handleDiceClick}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setShowCategoryMenu(true);
                }}
                disabled={isBusy}
              >
                <Dice5 size={14} />
              </button>
            </Tooltip>
            {showCategoryMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-1.5 shadow-lg">
                {PROMPT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-white transition-colors hover:bg-[var(--color-hover)]"
                    onClick={() => handleCategorySelect(cat)}
                  >
                    {t(`generation.category.${cat}`, { defaultValue: cat })}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Tooltip label={t("generation.enhancePrompt")}>
            <button
              type="button"
              className="secondary-button shrink-0 px-2"
              aria-label={t("generation.enhancePrompt")}
              onClick={() => {
                void (async () => {
                  try {
                    setEnhancing(true);
                    await onEnhancePrompt();
                    addToast("success", t("toast.promptEnhanced"));
                  } catch {
                    addToast("error", t("toast.promptEnhanceFailed"));
                  } finally {
                    setEnhancing(false);
                  }
                })();
              }}
              disabled={isBusy || enhancing}
            >
              {enhancing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <WandSparkles size={14} />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Prompt history chips */}
      {(displayedRecents.length > 0 || displayedFavorites.length > 0) && (
        <div className="space-y-2 px-1">
          {displayedRecents.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-dim)]">
                {t("generation.recentPrompts")}
              </span>
              {displayedRecents.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="group flex max-w-[200px] items-center gap-1 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)] hover:text-white"
                  onClick={() => onSetField("prompt", p)}
                  disabled={isBusy}
                  title={p}
                >
                  <span className="truncate">{p}</span>
                  <span
                    className="shrink-0 inline-flex opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentPrompt(p);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        removeRecentPrompt(p);
                      }
                    }}
                    role="button"
                    aria-label={t("generation.removeRecent")}
                    tabIndex={0}
                  >
                    <X size={10} />
                  </span>
                </button>
              ))}
            </div>
          )}
          {displayedFavorites.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-amber-300/70">
                {t("generation.favoritePrompts")}
              </span>
              {displayedFavorites.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="max-w-[200px] truncate rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200 transition-colors hover:border-amber-500/40 hover:text-white"
                  onClick={() => onSetField("prompt", p)}
                  disabled={isBusy}
                  title={p}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTasks.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1">
              {t("generation.recoveryAvailable", {
                count: activeTasks.length,
              })}
            </span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void onResumeTask(activeTasks[0].id);
              }}
              disabled={isBusy}
            >
              {t("generation.resumeTask")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void onDiscardTask(activeTasks[0].id);
              }}
              disabled={isBusy}
            >
              {t("generation.discardTask")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
