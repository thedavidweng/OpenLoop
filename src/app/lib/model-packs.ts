import type {
  AppSettings,
  ModelDownloadState,
  ModelStatusSnapshot,
  ModelVariant,
} from "@/app/lib/types";

export const MODEL_VARIANTS = {
  lite: {
    id: "lite",
    label: "Lite",
    description: "Official lower-memory profile: turbo DiT + 0.6B LM.",
    modelName: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
  },
  turbo: {
    id: "turbo",
    label: "Turbo",
    description:
      "Recommended profile for 16 GB Apple Silicon Macs: turbo DiT + 0.6B LM.",
    modelName: "acestep-v15-turbo",
    lmModelPath: "acestep-5Hz-lm-0.6B",
  },
  pro: {
    id: "pro",
    label: "XL Turbo",
    description: "Official XL turbo profile for larger-memory machines.",
    modelName: "acestep-v15-xl-turbo",
    lmModelPath: "acestep-5Hz-lm-1.7B",
  },
} as const satisfies Record<
  ModelVariant,
  {
    id: ModelVariant;
    label: string;
    description: string;
    modelName: string;
    lmModelPath: string;
  }
>;

export const MODEL_PACKS = {
  standard: {
    id: "standard",
    label: "Standard",
    description:
      "Shared ACE-Step turbo DiT + 0.6B LM pack used by Lite and Turbo profiles.",
    variants: ["lite", "turbo"] as ModelVariant[],
    primaryVariant: "turbo" as ModelVariant,
    estimatedSizeBytes: 8 * 1024 * 1024 * 1024,
  },
  xl: {
    id: "xl",
    label: "XL",
    description: "ACE-Step XL turbo DiT + 1.7B LM pack used by Pro profile.",
    variants: ["pro"] as ModelVariant[],
    primaryVariant: "pro" as ModelVariant,
    estimatedSizeBytes: 22 * 1024 * 1024 * 1024,
  },
} as const;

export type ModelPackId = keyof typeof MODEL_PACKS;

export interface ModelPackStatus {
  state: ModelDownloadState;
  downloadedBytes: number;
  totalBytes: number;
  label: string;
  error: ModelStatusSnapshot["error"];
  sample?: ModelStatusSnapshot;
}

export function modelNameForVariant(variant: ModelVariant): string {
  return MODEL_VARIANTS[variant].modelName;
}

export function lmModelPathForVariant(variant: ModelVariant): string {
  return MODEL_VARIANTS[variant].lmModelPath;
}

export function packIdForVariant(variant: ModelVariant): ModelPackId {
  return variant === "pro" ? "xl" : "standard";
}

export function primaryVariantForPack(packId: ModelPackId): ModelVariant {
  return MODEL_PACKS[packId].primaryVariant;
}

export function profileForVariant(
  variant: ModelVariant,
): AppSettings["profile"] {
  if (variant === "lite") return "low-memory";
  if (variant === "pro") return "quality";
  return "standard";
}

export function isModelDownloaded(
  settings: AppSettings,
  variant: ModelVariant | null,
): boolean {
  if (!variant) {
    return false;
  }
  const packId = packIdForVariant(variant);
  return MODEL_PACKS[packId].variants.some((candidate) =>
    settings.downloadedModels.includes(candidate),
  );
}

export function expandDownloadedVariantsFromStatuses(
  statuses: ModelStatusSnapshot[],
): ModelVariant[] {
  const readyPacks = new Set<ModelPackId>();
  for (const status of statuses) {
    if (status.state === "ready") {
      readyPacks.add(packIdForVariant(status.variant));
    }
  }
  const next: ModelVariant[] = [];
  for (const packId of readyPacks) {
    next.push(...MODEL_PACKS[packId].variants);
  }
  return next;
}

export function aggregatePackStatus(
  statuses: ModelStatusSnapshot[],
  packId: ModelPackId,
): ModelPackStatus {
  const entries = statuses.filter((status) =>
    MODEL_PACKS[packId].variants.includes(status.variant),
  );
  if (entries.length === 0) {
    return {
      state: "not_installed",
      downloadedBytes: 0,
      totalBytes: MODEL_PACKS[packId].estimatedSizeBytes,
      label: MODEL_PACKS[packId].label,
      error: null,
    };
  }

  const rank: Record<ModelDownloadState, number> = {
    failed: 4,
    downloading: 3,
    ready: 2,
    not_installed: 1,
  };
  const winner = entries.reduce((acc, cur) =>
    rank[cur.state] > rank[acc.state] ? cur : acc,
  );
  const downloadedBytes = Math.max(
    ...entries.map((entry) => entry.downloadedBytes),
  );
  const totalBytes =
    entries.find((entry) => entry.totalBytes)?.totalBytes ??
    MODEL_PACKS[packId].estimatedSizeBytes;

  return {
    state: winner.state,
    downloadedBytes,
    totalBytes,
    label: MODEL_PACKS[packId].label,
    error: winner.error ?? null,
    sample: winner,
  };
}

export function modelDownloadStateForVariant(
  statuses: ModelStatusSnapshot[],
  variant: ModelVariant | null,
): ModelDownloadState {
  if (!variant) {
    return "not_installed";
  }
  return aggregatePackStatus(statuses, packIdForVariant(variant)).state;
}
