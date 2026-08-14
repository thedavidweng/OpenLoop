import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/app/components/settings/SettingsSectionCard";
import { CatalogPackCard } from "@/app/components/settings/SettingsOverlay/CatalogPackCard";
import { ModelPackCard } from "@/app/components/settings/SettingsOverlay/ModelPackCard";
import { ModelVariantCard } from "@/app/components/settings/SettingsOverlay/ModelVariantCard";
import { DEFAULT_MODEL_REGISTRY, packsForEngine } from "@/app/lib/model-catalog";
import {
  MODEL_PACKS,
  aggregatePackStatus,
  packIdForVariant,
  primaryVariantForPack,
  type ModelPackId,
} from "@/app/lib/model-packs";
import { useGenerationStore } from "@/app/lib/store";
import type { ModelVariant } from "@/app/lib/types";

export function ModelsSection() {
  const { t } = useTranslation();
  const modelStatuses = useGenerationStore((state) => state.modelStatuses);
  const modelRegistry =
    useGenerationStore((state) => state.modelRegistry) ?? DEFAULT_MODEL_REGISTRY;
  const settings = useGenerationStore((state) => state.settings);
  const selectModelVariant = useGenerationStore((state) => state.selectModelVariant);
  const downloadModelVariant = useGenerationStore((state) => state.downloadModelVariant);
  const deleteModelVariant = useGenerationStore((state) => state.deleteModelVariant);
  const cancelModelDownload = useGenerationStore((state) => state.cancelModelDownload);
  const clearPartialModelDownloads = useGenerationStore(
    (state) => state.clearPartialModelDownloads,
  );

  const [busyVariant, setBusyVariant] = useState<ModelVariant | null>(null);
  const acePacks = packsForEngine(modelRegistry, "ace-step");
  const otherEngines = modelRegistry.engines.filter((engine) => engine.id !== "ace-step");

  return (
    <SettingsSectionCard
      id="settings-section-models"
      title={t("settings.models")}
      description={t("settings.modelsDescription")}
      headerAction={
        <button
          type="button"
          onClick={() => {
            /* no-op: model selection is not a draft field */
          }}
          className="text-[11px] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)]"
        >
          {t("settings.resetToDefaults")}
        </button>
      }
    >
      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-[var(--color-text)]">ACE-Step 1.5</p>
        <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
          {t("settings.aceEngineDescription")}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
          {t("settings.modelPacks")}
        </p>
        {acePacks.map((pack) => {
          const packId = (pack.acePack ?? "standard") as ModelPackId;
          const packStatus = aggregatePackStatus(modelStatuses, packId);
          const primary = primaryVariantForPack(packId);
          return (
            <ModelPackCard
              key={pack.id}
              packId={packId}
              state={packStatus.state}
              downloadedBytes={packStatus.downloadedBytes}
              totalBytes={packStatus.totalBytes}
              errorMessage={packStatus.error?.message ?? null}
              errorDetails={packStatus.error?.details ?? null}
              busy={busyVariant !== null && MODEL_PACKS[packId].variants.includes(busyVariant)}
              onDownload={() => {
                setBusyVariant(primary);
                void downloadModelVariant(primary).finally(() => {
                  setBusyVariant(null);
                });
              }}
              onDelete={() => {
                setBusyVariant(primary);
                void deleteModelVariant(primary).finally(() => {
                  setBusyVariant(null);
                });
              }}
              onCancel={() => {
                void cancelModelDownload(primary);
              }}
              onClearPartial={() => {
                setBusyVariant(primary);
                void clearPartialModelDownloads(primary).finally(() => {
                  setBusyVariant(null);
                });
              }}
            />
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
          {t("settings.runProfiles")}
        </p>
        {(["lite", "turbo", "pro"] as const).map((variant) => {
          const packId = packIdForVariant(variant);
          const packStatus = aggregatePackStatus(modelStatuses, packId);
          return (
            <ModelVariantCard
              key={variant}
              variant={variant}
              selected={settings.modelVariant === variant}
              packReady={packStatus.state === "ready"}
              packState={packStatus.state}
              busy={busyVariant === variant}
              onSelect={() => {
                setBusyVariant(variant);
                void selectModelVariant(variant).finally(() => {
                  setBusyVariant(null);
                });
              }}
            />
          );
        })}
      </div>

      {otherEngines.map((engine) => (
        <div key={engine.id} className="mt-8 space-y-3">
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-[var(--color-text)]">{engine.label}</p>
            <p className="text-[11px] leading-5 text-[var(--color-text-dim)]">
              {engine.description}
            </p>
          </div>
          {packsForEngine(modelRegistry, engine.id).map((pack) => (
            <CatalogPackCard key={pack.id} pack={pack} />
          ))}
        </div>
      ))}
    </SettingsSectionCard>
  );
}
