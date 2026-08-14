//! First-party Engine / Model Pack / Model Slot registry.
//!
//! This is the Voicebox-style seam: download, list, and switch resolve through
//! these tables. ACE-Step is the only bound Local Backend today. A future
//! MiniMax Music 3 Turbo (or any other pack) is added by:
//!
//! 1. Registering an [`EngineDescriptor`] if the family is new, and a
//!    [`EngineRuntimeKind`] adapter when generation should actually run.
//! 2. Adding a [`ModelPackDescriptor`] with a stable `id` (`engine/pack`).
//! 3. Adding [`ModelSlotDescriptor`] rows users can select.
//! 4. When weights exist, flipping `install_policy` to `Installable` and
//!    teaching `ModelManager` the file list — UI and CLI pick the pack up
//!    without new Settings keys.
//!
//! Do not add per-engine branches in Tauri commands, the CLI router, or the
//! generation form. Read the registry instead.

pub mod types;

pub use types::{
    EngineDescriptor, EngineId, EngineRuntimeKind, ModelPackDescriptor, ModelRegistry,
    ModelSlotDescriptor, PackCapabilities, PackInstallPolicy, ACE_STYLE_CAPABILITIES,
    MUSIC3_CAPABILITIES,
};

use crate::models::settings::ModelVariant;
use crate::services::model_manager::{STANDARD_PACK_TOTAL_BYTES, XL_PACK_TOTAL_BYTES};

pub const CATALOG_ENGINES: &[EngineDescriptor] = &[
    EngineDescriptor {
        id: EngineId::AceStep,
        label: "ACE-Step 1.5",
        description: "Local MLX music generation. Bound to the OpenLoop-managed ACE-Step HTTP process.",
        runtime: EngineRuntimeKind::AceStepHttp,
    },
    EngineDescriptor {
        id: EngineId::MiniMaxMusic3,
        label: "MiniMax Music 3",
        description: "Long-form lyric-conditioned generation. Registered so a future Turbo pack can attach without a Settings rewrite. No Local Backend adapter is bound yet.",
        runtime: EngineRuntimeKind::Unbound,
    },
];

pub const CATALOG_PACKS: &[ModelPackDescriptor] = &[
    ModelPackDescriptor {
        id: "ace-step/standard",
        engine: EngineId::AceStep,
        label: "Standard",
        description: "Shared ACE-Step turbo DiT + 0.6B LM pack used by Lite and Turbo slots.",
        install_policy: PackInstallPolicy::Installable,
        estimated_size_bytes: STANDARD_PACK_TOTAL_BYTES,
        recommended_memory_gb: 16,
        capabilities: ACE_STYLE_CAPABILITIES,
        ace_pack: Some("standard"),
    },
    ModelPackDescriptor {
        id: "ace-step/xl",
        engine: EngineId::AceStep,
        label: "XL",
        description: "ACE-Step XL turbo DiT + 1.7B LM pack used by the XL Turbo slot.",
        install_policy: PackInstallPolicy::Installable,
        estimated_size_bytes: XL_PACK_TOTAL_BYTES,
        recommended_memory_gb: 24,
        capabilities: ACE_STYLE_CAPABILITIES,
        ace_pack: Some("xl"),
    },
    ModelPackDescriptor {
        id: "minimax-music3/mlx-8bit",
        engine: EngineId::MiniMaxMusic3,
        label: "MLX 8-bit",
        description: "Community 8-bit Apple Silicon pack. Reserved in the catalog; install and generation stay gated until a Local Backend adapter exists.",
        install_policy: PackInstallPolicy::Announced,
        estimated_size_bytes: 14_167_660_156,
        recommended_memory_gb: 32,
        capabilities: MUSIC3_CAPABILITIES,
        ace_pack: None,
    },
    ModelPackDescriptor {
        id: "minimax-music3/turbo",
        engine: EngineId::MiniMaxMusic3,
        label: "Turbo",
        description: "Placeholder for a future distilled MiniMax Music 3 pack. Same Engine and capability schema as mlx-8bit; swapping weights should not require a new Settings key.",
        install_policy: PackInstallPolicy::Announced,
        estimated_size_bytes: 0,
        recommended_memory_gb: 16,
        capabilities: MUSIC3_CAPABILITIES,
        ace_pack: None,
    },
];

pub const CATALOG_SLOTS: &[ModelSlotDescriptor] = &[
    ModelSlotDescriptor {
        id: "ace-step/lite",
        pack_id: "ace-step/standard",
        engine: EngineId::AceStep,
        label: "Lite",
        description: "Lower-memory ACE-Step profile. Uses the Standard pack.",
        ace_variant: Some(ModelVariant::Lite),
        selectable: true,
    },
    ModelSlotDescriptor {
        id: "ace-step/turbo",
        pack_id: "ace-step/standard",
        engine: EngineId::AceStep,
        label: "Turbo",
        description: "Recommended ACE-Step profile for 16 GB Apple Silicon. Uses the Standard pack.",
        ace_variant: Some(ModelVariant::Turbo),
        selectable: true,
    },
    ModelSlotDescriptor {
        id: "ace-step/pro",
        pack_id: "ace-step/xl",
        engine: EngineId::AceStep,
        label: "XL Turbo",
        description: "Higher-fidelity ACE-Step profile. Uses the XL pack.",
        ace_variant: Some(ModelVariant::Pro),
        selectable: true,
    },
    ModelSlotDescriptor {
        id: "minimax-music3/mlx-8bit",
        pack_id: "minimax-music3/mlx-8bit",
        engine: EngineId::MiniMaxMusic3,
        label: "Music 3 MLX 8-bit",
        description: "Not selectable until the MiniMax Music 3 Local Backend is bound.",
        ace_variant: None,
        selectable: false,
    },
    ModelSlotDescriptor {
        id: "minimax-music3/turbo",
        pack_id: "minimax-music3/turbo",
        engine: EngineId::MiniMaxMusic3,
        label: "Music 3 Turbo",
        description: "Reserved slot. A future distilled pack should keep this id so Settings and History stay stable.",
        ace_variant: None,
        selectable: false,
    },
];

pub fn registry() -> ModelRegistry {
    ModelRegistry {
        engines: CATALOG_ENGINES.to_vec(),
        packs: CATALOG_PACKS.to_vec(),
        slots: CATALOG_SLOTS.to_vec(),
    }
}

pub fn engine(id: EngineId) -> Option<&'static EngineDescriptor> {
    CATALOG_ENGINES.iter().find(|engine| engine.id == id)
}

pub fn pack(id: &str) -> Option<&'static ModelPackDescriptor> {
    CATALOG_PACKS.iter().find(|pack| pack.id == id)
}

pub fn slot(id: &str) -> Option<&'static ModelSlotDescriptor> {
    CATALOG_SLOTS.iter().find(|slot| slot.id == id)
}

pub fn slot_for_ace_variant(variant: ModelVariant) -> &'static ModelSlotDescriptor {
    CATALOG_SLOTS
        .iter()
        .find(|slot| slot.ace_variant == Some(variant))
        .expect("every ACE-Step variant has a catalog slot")
}

pub fn pack_for_ace_variant(variant: ModelVariant) -> &'static ModelPackDescriptor {
    pack(slot_for_ace_variant(variant).pack_id).expect("ACE-Step slot references a catalog pack")
}

/// Resolve a user-facing id (`turbo`, `ace-step/turbo`, `minimax-music3/turbo`).
pub fn resolve_slot_id(input: &str) -> Option<&'static ModelSlotDescriptor> {
    if let Some(found) = slot(input) {
        return Some(found);
    }
    match input {
        "lite" => slot("ace-step/lite"),
        "turbo" => slot("ace-step/turbo"),
        "pro" => slot("ace-step/pro"),
        _ => None,
    }
}

pub fn selected_slot_id(settings: &crate::models::settings::AppSettings) -> Option<String> {
    if let Some(id) = settings.selected_model_id.as_deref() {
        if !id.is_empty() {
            return Some(id.to_owned());
        }
    }
    settings
        .model_variant
        .map(|variant| slot_for_ace_variant(variant).id.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_slot_points_at_a_known_pack_and_engine() {
        for slot in CATALOG_SLOTS {
            let pack = pack(slot.pack_id).expect(slot.pack_id);
            assert_eq!(pack.engine, slot.engine);
            assert!(engine(slot.engine).is_some());
        }
    }

    #[test]
    fn ace_aliases_resolve_to_selectable_slots() {
        assert_eq!(resolve_slot_id("turbo").unwrap().id, "ace-step/turbo");
        assert_eq!(
            resolve_slot_id("ace-step/lite").unwrap().ace_variant,
            Some(ModelVariant::Lite)
        );
        assert!(resolve_slot_id("turbo").unwrap().selectable);
    }

    #[test]
    fn music3_slots_are_registered_but_not_selectable() {
        let turbo = slot("minimax-music3/turbo").expect("turbo slot");
        assert!(!turbo.selectable);
        assert_eq!(
            engine(turbo.engine).unwrap().runtime,
            EngineRuntimeKind::Unbound
        );
        assert_eq!(
            pack(turbo.pack_id).unwrap().install_policy,
            PackInstallPolicy::Announced
        );
    }

    #[test]
    fn unknown_ids_do_not_resolve() {
        assert!(resolve_slot_id("suno/v4").is_none());
        assert!(pack("ace-step/missing").is_none());
    }
}
