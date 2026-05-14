use super::types::ModelFileSpec;

const ACESTEP_V15_TURBO_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/config.json",
        local_path: "acestep-v15-turbo/config.json",
        size: 1968,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/configuration_acestep_v15.py",
        local_path: "acestep-v15-turbo/configuration_acestep_v15.py",
        size: 13130,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/model.safetensors",
        local_path: "acestep-v15-turbo/model.safetensors",
        size: 4_787_825_604,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/modeling_acestep_v15_turbo.py",
        local_path: "acestep-v15-turbo/modeling_acestep_v15_turbo.py",
        size: 96_036,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/silence_latent.pt",
        local_path: "acestep-v15-turbo/silence_latent.pt",
        size: 3_841_215,
        sha256: None,
    },
];

const ACESTEP_LM_06B_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "config.json",
        local_path: "acestep-5Hz-lm-0.6B/config.json",
        size: 1386,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "model.safetensors",
        local_path: "acestep-5Hz-lm-0.6B/model.safetensors",
        size: 1_325_804_024,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "tokenizer.json",
        local_path: "acestep-5Hz-lm-0.6B/tokenizer.json",
        size: 24_321_939,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "tokenizer_config.json",
        local_path: "acestep-5Hz-lm-0.6B/tokenizer_config.json",
        size: 14_072_925,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "added_tokens.json",
        local_path: "acestep-5Hz-lm-0.6B/added_tokens.json",
        size: 2_217_787,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "merges.txt",
        local_path: "acestep-5Hz-lm-0.6B/merges.txt",
        size: 1_671_853,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "vocab.json",
        local_path: "acestep-5Hz-lm-0.6B/vocab.json",
        size: 2_776_833,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "special_tokens_map.json",
        local_path: "acestep-5Hz-lm-0.6B/special_tokens_map.json",
        size: 1_824_199,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "chat_template.jinja",
        local_path: "acestep-5Hz-lm-0.6B/chat_template.jinja",
        size: 4168,
        sha256: None,
    },
];

const ACESTEP_LM_17B_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/config.json",
        local_path: "acestep-5Hz-lm-1.7B/config.json",
        size: 1385,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/model.safetensors",
        local_path: "acestep-5Hz-lm-1.7B/model.safetensors",
        size: 3_708_521_528,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/tokenizer.json",
        local_path: "acestep-5Hz-lm-1.7B/tokenizer.json",
        size: 24_321_939,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/tokenizer_config.json",
        local_path: "acestep-5Hz-lm-1.7B/tokenizer_config.json",
        size: 14_072_925,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/added_tokens.json",
        local_path: "acestep-5Hz-lm-1.7B/added_tokens.json",
        size: 2_217_787,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/merges.txt",
        local_path: "acestep-5Hz-lm-1.7B/merges.txt",
        size: 1_671_853,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/vocab.json",
        local_path: "acestep-5Hz-lm-1.7B/vocab.json",
        size: 2_776_833,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/special_tokens_map.json",
        local_path: "acestep-5Hz-lm-1.7B/special_tokens_map.json",
        size: 1_824_199,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/chat_template.jinja",
        local_path: "acestep-5Hz-lm-1.7B/chat_template.jinja",
        size: 4168,
        sha256: None,
    },
];

const ACESTEP_V15_XL_TURBO_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "config.json",
        local_path: "acestep-v15-xl-turbo/config.json",
        size: 2407,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "configuration_acestep_v15.py",
        local_path: "acestep-v15-xl-turbo/configuration_acestep_v15.py",
        size: 13_225,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "modeling_acestep_v15_xl_turbo.py",
        local_path: "acestep-v15-xl-turbo/modeling_acestep_v15_xl_turbo.py",
        size: 103_821,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model.safetensors.index.json",
        local_path: "acestep-v15-xl-turbo/model.safetensors.index.json",
        size: 71_471,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00001-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00001-of-00004.safetensors",
        size: 4_986_971_456,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00002-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00002-of-00004.safetensors",
        size: 4_986_942_776,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00003-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00003-of-00004.safetensors",
        size: 4_986_942_808,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00004-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00004-of-00004.safetensors",
        size: 4_988_483_464,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "silence_latent.pt",
        local_path: "acestep-v15-xl-turbo/silence_latent.pt",
        size: 3_841_215,
        sha256: None,
    },
];

const SHARED_VAE_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "vae/config.json",
        local_path: "vae/config.json",
        size: 425,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "vae/diffusion_pytorch_model.safetensors",
        local_path: "vae/diffusion_pytorch_model.safetensors",
        size: 337_431_388,
        sha256: None,
    },
];

const SHARED_TEXT_EMBED_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/config.json",
        local_path: "Qwen3-Embedding-0.6B/config.json",
        size: 1359,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/model.safetensors",
        local_path: "Qwen3-Embedding-0.6B/model.safetensors",
        size: 1_191_586_416,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/tokenizer.json",
        local_path: "Qwen3-Embedding-0.6B/tokenizer.json",
        size: 11_423_705,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/tokenizer_config.json",
        local_path: "Qwen3-Embedding-0.6B/tokenizer_config.json",
        size: 5404,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/added_tokens.json",
        local_path: "Qwen3-Embedding-0.6B/added_tokens.json",
        size: 707,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/merges.txt",
        local_path: "Qwen3-Embedding-0.6B/merges.txt",
        size: 1_671_853,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/vocab.json",
        local_path: "Qwen3-Embedding-0.6B/vocab.json",
        size: 2_776_833,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/special_tokens_map.json",
        local_path: "Qwen3-Embedding-0.6B/special_tokens_map.json",
        size: 613,
        sha256: None,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/chat_template.jinja",
        local_path: "Qwen3-Embedding-0.6B/chat_template.jinja",
        size: 4116,
        sha256: None,
    },
];

const fn const_sum(slices: &[&[ModelFileSpec]]) -> u64 {
    let mut total = 0u64;
    let mut i = 0;
    while i < slices.len() {
        let slice = slices[i];
        let mut j = 0;
        while j < slice.len() {
            total += slice[j].size;
            j += 1;
        }
        i += 1;
    }
    total
}

pub const STANDARD_PACK_TOTAL_BYTES: u64 = const_sum(&[
    ACESTEP_V15_TURBO_FILES,
    ACESTEP_LM_06B_FILES,
    SHARED_VAE_FILES,
    SHARED_TEXT_EMBED_FILES,
]);

pub const XL_PACK_TOTAL_BYTES: u64 = const_sum(&[
    ACESTEP_V15_XL_TURBO_FILES,
    ACESTEP_LM_17B_FILES,
    SHARED_VAE_FILES,
    SHARED_TEXT_EMBED_FILES,
]);

pub fn pack_for_descriptor(descriptor: &super::types::AceModelDescriptor) -> Vec<ModelFileSpec> {
    let mut files: Vec<ModelFileSpec> = Vec::new();
    match descriptor.model_name {
        "acestep-v15-turbo" => files.extend_from_slice(ACESTEP_V15_TURBO_FILES),
        "acestep-v15-xl-turbo" => files.extend_from_slice(ACESTEP_V15_XL_TURBO_FILES),
        _ => {}
    }
    match descriptor.lm_model {
        Some("acestep-5Hz-lm-0.6B") => files.extend_from_slice(ACESTEP_LM_06B_FILES),
        Some("acestep-5Hz-lm-1.7B") => files.extend_from_slice(ACESTEP_LM_17B_FILES),
        _ => {}
    }
    files.extend_from_slice(SHARED_VAE_FILES);
    files.extend_from_slice(SHARED_TEXT_EMBED_FILES);
    files
}

pub fn unique_model_dirs(files: Vec<ModelFileSpec>) -> Vec<&'static str> {
    let mut dirs: Vec<&'static str> = Vec::new();
    for spec in files {
        let top = spec.local_path.split('/').next().unwrap_or(spec.local_path);
        if !dirs.contains(&top) {
            dirs.push(top);
        }
    }
    dirs
}
