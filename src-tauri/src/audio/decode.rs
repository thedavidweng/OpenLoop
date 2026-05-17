use anyhow::{anyhow, bail, Context, Result};
use std::io::{Cursor, Read, Seek};
use symphonia::core::{
    audio::GenericAudioBufferRef,
    codecs::{audio::AudioDecoderOptions, CodecParameters},
    errors::Error as SymphoniaError,
    formats::{probe::Hint, FormatOptions, TrackType},
    io::{MediaSource, MediaSourceStream},
    meta::MetadataOptions,
};

#[derive(Debug, Clone, PartialEq)]
pub struct DecodedAudio {
    pub sample_rate: u32,
    pub channels: usize,
    pub samples: Vec<f32>,
}

pub fn decode_bytes(bytes: Vec<u8>, extension: &str) -> Result<DecodedAudio> {
    decode_source(
        Cursor::new(bytes),
        Some(extension),
        "generated ACE-Step audio",
    )
}

fn extend_interleaved_samples(samples: &mut Vec<f32>, decoded: GenericAudioBufferRef<'_>) {
    decoded.copy_to_vec_interleaved(samples);
}

fn decode_source<R>(source: R, extension: Option<&str>, source_label: &str) -> Result<DecodedAudio>
where
    R: Read + Seek + MediaSource + Send + Sync + 'static,
{
    let media_source_stream = MediaSourceStream::new(Box::new(source), Default::default());

    let mut hint = Hint::new();
    if let Some(extension) = extension {
        hint.with_extension(extension);
    }

    let probed = symphonia::default::get_probe()
        .probe(
            &hint,
            media_source_stream,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .with_context(|| format!("failed to probe audio format for {source_label}"))?;
    let mut format = probed;

    let track = format
        .default_track(TrackType::Audio)
        .context("audio container does not expose a default track")?;
    let codec_params = track
        .codec_params
        .as_ref()
        .and_then(CodecParameters::audio)
        .context("default track is not decodable audio")?;
    let mut sample_rate = codec_params.sample_rate;
    let mut channels = codec_params.channels.as_ref().map(|layout| layout.count());

    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(codec_params, &AudioDecoderOptions::default())
        .context("failed to create audio decoder")?;
    let track_id = track.id;
    let mut samples = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(Some(packet)) => packet,
            Ok(None) => break,
            Err(SymphoniaError::IoError(error))
                if error.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(SymphoniaError::ResetRequired) => {
                bail!("decoder reset is not supported for generated audio")
            }
            Err(error) => return Err(error).context("failed while reading audio packets"),
        };

        if packet.track_id != track_id {
            continue;
        }

        let decoded = decoder
            .decode(&packet)
            .with_context(|| format!("failed to decode audio packet from {source_label}"))?;

        let spec = decoded.spec();
        sample_rate.get_or_insert(spec.rate());
        channels.get_or_insert(spec.channels().count());
        extend_interleaved_samples(&mut samples, decoded);
    }

    if samples.is_empty() {
        return Err(anyhow!("decoded audio contained no PCM samples"));
    }

    Ok(DecodedAudio {
        sample_rate: sample_rate.context("audio track is missing sample rate metadata")?,
        channels: channels.context("audio track is missing channel metadata")?,
        samples,
    })
}
