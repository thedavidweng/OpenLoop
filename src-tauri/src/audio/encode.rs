use crate::audio::decode::DecodedAudio;
use anyhow::{Context, Result};
use std::num::{NonZeroU32, NonZeroU8};
use std::path::Path;
use vorbis_rs::{VorbisBitrateManagementStrategy, VorbisEncoderBuilder};

const DEFAULT_VORBIS_QUALITY: f32 = 0.6;
const ENCODE_CHUNK_FRAMES: usize = 1024;

pub fn write_ogg_file(path: &Path, audio: &DecodedAudio) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("failed to create directory {}", parent.display()))?;
    }

    let sample_rate = NonZeroU32::new(audio.sample_rate).context("sample rate must be non-zero")?;
    let channel_count = NonZeroU8::try_from(
        u8::try_from(audio.channels).context("channel count exceeds u8 range")?,
    )
    .context("channel count must be non-zero")?;

    let file = std::fs::File::create(path)
        .with_context(|| format!("failed to create OGG file at {}", path.display()))?;
    let writer = std::io::BufWriter::new(file);

    let mut encoder = VorbisEncoderBuilder::new(sample_rate, channel_count, writer)
        .context("failed to create Vorbis encoder builder")?
        .bitrate_management_strategy(VorbisBitrateManagementStrategy::QualityVbr {
            target_quality: DEFAULT_VORBIS_QUALITY,
        })
        .build()
        .context("failed to build Vorbis encoder")?;

    let total_frames = audio.samples.len() / audio.channels;
    let mut offset = 0;
    let mut planar = (0..audio.channels)
        .map(|_| Vec::with_capacity(ENCODE_CHUNK_FRAMES))
        .collect::<Vec<_>>();

    while offset < total_frames {
        let chunk_frames = ENCODE_CHUNK_FRAMES.min(total_frames - offset);
        for channel_samples in &mut planar {
            channel_samples.clear();
        }
        for frame in 0..chunk_frames {
            let frame_offset = (offset + frame) * audio.channels;
            for channel_index in 0..audio.channels {
                planar[channel_index].push(audio.samples[frame_offset + channel_index]);
            }
        }

        encoder
            .encode_audio_block(&planar)
            .context("failed to encode OGG/Vorbis audio block")?;
        offset += chunk_frames;
    }

    encoder
        .finish()
        .context("failed to finish OGG/Vorbis encoding")?;

    Ok(())
}
