use serde::Serialize;

use crate::models::settings::ModelVariant;

/// First-party engine identifier.
///
/// Adding a new family (for example a future MiniMax Music 3 Turbo runtime)
/// means adding a variant here and a matching [`EngineDescriptor`] in the
/// registry — UI, CLI, and settings resolve engines only through that table.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum EngineId {
    AceStep,
    MiniMaxMusic3,
}

impl EngineId {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AceStep => "ace-step",
            Self::MiniMaxMusic3 => "minimax-music3",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "ace-step" => Some(Self::AceStep),
            "minimax-music3" => Some(Self::MiniMaxMusic3),
            _ => None,
        }
    }
}

/// How OpenLoop talks to an engine's Local Backend.
///
/// `Unbound` packs can appear in the catalog and later grow an adapter
/// without changing Settings or History. Do not start generation for them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum EngineRuntimeKind {
    AceStepHttp,
    Unbound,
}

impl EngineRuntimeKind {
    pub const fn is_bound(self) -> bool {
        matches!(self, Self::AceStepHttp)
    }
}

/// Whether a Model Pack can be downloaded today.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PackInstallPolicy {
    Installable,
    Announced,
}

/// Generation fields this pack understands.
///
/// The generation form and CLI should read this instead of hard-coding
/// ACE-Step controls when a new engine is bound.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackCapabilities {
    pub supports_bpm: bool,
    pub supports_key: bool,
    pub supports_time_signature: bool,
    pub supports_thinking: bool,
    pub supports_lyrics: bool,
    pub prompt_role: &'static str,
    pub max_duration_seconds: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineDescriptor {
    pub id: EngineId,
    pub label: &'static str,
    pub description: &'static str,
    pub runtime: EngineRuntimeKind,
}

/// Downloadable (or announced) weight set owned by one Engine.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelPackDescriptor {
    pub id: &'static str,
    pub engine: EngineId,
    pub label: &'static str,
    pub description: &'static str,
    pub install_policy: PackInstallPolicy,
    pub estimated_size_bytes: u64,
    pub recommended_memory_gb: u64,
    pub capabilities: PackCapabilities,
    /// Legacy ACE-Step pack key (`standard` / `xl`) used by the existing UI.
    pub ace_pack: Option<&'static str>,
}

/// Selectable run configuration. One Model Pack may back several slots
/// (ACE-Step Lite and Turbo share the Standard pack).
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSlotDescriptor {
    pub id: &'static str,
    pub pack_id: &'static str,
    pub engine: EngineId,
    pub label: &'static str,
    pub description: &'static str,
    pub ace_variant: Option<ModelVariant>,
    pub selectable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRegistry {
    pub engines: Vec<EngineDescriptor>,
    pub packs: Vec<ModelPackDescriptor>,
    pub slots: Vec<ModelSlotDescriptor>,
}

pub const ACE_STYLE_CAPABILITIES: PackCapabilities = PackCapabilities {
    supports_bpm: true,
    supports_key: true,
    supports_time_signature: true,
    supports_thinking: true,
    supports_lyrics: true,
    prompt_role: "style-and-lyrics",
    max_duration_seconds: 600.0,
};

pub const MUSIC3_CAPABILITIES: PackCapabilities = PackCapabilities {
    supports_bpm: false,
    supports_key: false,
    supports_time_signature: false,
    supports_thinking: false,
    supports_lyrics: true,
    prompt_role: "caption-and-lyrics",
    max_duration_seconds: 360.0,
};
