import type {
  CatalogPackId,
  CatalogSlotId,
  EngineDescriptor,
  EngineId,
  ModelPackDescriptor,
  ModelRegistry,
  ModelSlotDescriptor,
  ModelVariant,
  PackCapabilities,
} from "@/app/lib/types";

const ACE_STYLE_CAPABILITIES: PackCapabilities = {
  supportsBpm: true,
  supportsKey: true,
  supportsTimeSignature: true,
  supportsThinking: true,
  supportsLyrics: true,
  promptRole: "style-and-lyrics",
  maxDurationSeconds: 600,
};

const MUSIC3_CAPABILITIES: PackCapabilities = {
  supportsBpm: false,
  supportsKey: false,
  supportsTimeSignature: false,
  supportsThinking: false,
  supportsLyrics: true,
  promptRole: "caption-and-lyrics",
  maxDurationSeconds: 360,
};

export const CATALOG_ENGINES: EngineDescriptor[] = [
  {
    id: "ace-step",
    label: "ACE-Step 1.5",
    description: "Local MLX music generation. Bound to the OpenLoop-managed ACE-Step HTTP process.",
    runtime: "ace-step-http",
  },
  {
    id: "minimax-music3",
    label: "MiniMax Music 3",
    description:
      "Long-form lyric-conditioned generation. Registered so a future Turbo pack can attach without a Settings rewrite. No Local Backend adapter is bound yet.",
    runtime: "unbound",
  },
];

export const CATALOG_PACKS: ModelPackDescriptor[] = [
  {
    id: "ace-step/standard",
    engine: "ace-step",
    label: "Standard",
    description: "Shared ACE-Step turbo DiT + 0.6B LM pack used by Lite and Turbo slots.",
    installPolicy: "installable",
    estimatedSizeBytes: 8 * 1024 * 1024 * 1024,
    recommendedMemoryGb: 16,
    capabilities: ACE_STYLE_CAPABILITIES,
    acePack: "standard",
  },
  {
    id: "ace-step/xl",
    engine: "ace-step",
    label: "XL",
    description: "ACE-Step XL turbo DiT + 1.7B LM pack used by the XL Turbo slot.",
    installPolicy: "installable",
    estimatedSizeBytes: 22 * 1024 * 1024 * 1024,
    recommendedMemoryGb: 24,
    capabilities: ACE_STYLE_CAPABILITIES,
    acePack: "xl",
  },
  {
    id: "minimax-music3/mlx-8bit",
    engine: "minimax-music3",
    label: "MLX 8-bit",
    description:
      "Community 8-bit Apple Silicon pack. Reserved until a Local Backend adapter exists.",
    installPolicy: "announced",
    estimatedSizeBytes: 14_167_660_156,
    recommendedMemoryGb: 32,
    capabilities: MUSIC3_CAPABILITIES,
    acePack: null,
  },
  {
    id: "minimax-music3/turbo",
    engine: "minimax-music3",
    label: "Turbo",
    description:
      "Placeholder for a future distilled MiniMax Music 3 pack. Same Engine and capability schema as mlx-8bit.",
    installPolicy: "announced",
    estimatedSizeBytes: 0,
    recommendedMemoryGb: 16,
    capabilities: MUSIC3_CAPABILITIES,
    acePack: null,
  },
];

export const CATALOG_SLOTS: ModelSlotDescriptor[] = [
  {
    id: "ace-step/lite",
    packId: "ace-step/standard",
    engine: "ace-step",
    label: "Lite",
    description: "Lower-memory ACE-Step profile. Uses the Standard pack.",
    aceVariant: "lite",
    selectable: true,
  },
  {
    id: "ace-step/turbo",
    packId: "ace-step/standard",
    engine: "ace-step",
    label: "Turbo",
    description: "Recommended ACE-Step profile for 16 GB Apple Silicon. Uses the Standard pack.",
    aceVariant: "turbo",
    selectable: true,
  },
  {
    id: "ace-step/pro",
    packId: "ace-step/xl",
    engine: "ace-step",
    label: "XL Turbo",
    description: "Higher-fidelity ACE-Step profile. Uses the XL pack.",
    aceVariant: "pro",
    selectable: true,
  },
  {
    id: "minimax-music3/mlx-8bit",
    packId: "minimax-music3/mlx-8bit",
    engine: "minimax-music3",
    label: "Music 3 MLX 8-bit",
    description: "Not selectable until the MiniMax Music 3 Local Backend is bound.",
    aceVariant: null,
    selectable: false,
  },
  {
    id: "minimax-music3/turbo",
    packId: "minimax-music3/turbo",
    engine: "minimax-music3",
    label: "Music 3 Turbo",
    description: "Reserved slot for a future distilled pack.",
    aceVariant: null,
    selectable: false,
  },
];

export const DEFAULT_MODEL_REGISTRY: ModelRegistry = {
  engines: CATALOG_ENGINES,
  packs: CATALOG_PACKS,
  slots: CATALOG_SLOTS,
};

export function slotIdForVariant(variant: ModelVariant): CatalogSlotId {
  if (variant === "lite") return "ace-step/lite";
  if (variant === "pro") return "ace-step/pro";
  return "ace-step/turbo";
}

export function packsForEngine(registry: ModelRegistry, engineId: EngineId): ModelPackDescriptor[] {
  return registry.packs.filter((pack) => pack.engine === engineId);
}

export function slotsForPack(
  registry: ModelRegistry,
  packId: CatalogPackId,
): ModelSlotDescriptor[] {
  return registry.slots.filter((slot) => slot.packId === packId);
}

export function engineById(
  registry: ModelRegistry,
  engineId: EngineId,
): EngineDescriptor | undefined {
  return registry.engines.find((engine) => engine.id === engineId);
}
