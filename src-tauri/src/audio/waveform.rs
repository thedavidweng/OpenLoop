use crate::audio::decode::DecodedAudio;

const DEFAULT_PEAK_COUNT: usize = 96;

pub fn waveform_peaks(audio: &DecodedAudio) -> Vec<f32> {
    waveform_peaks_with_count(audio, DEFAULT_PEAK_COUNT)
}

pub fn waveform_peaks_with_count(audio: &DecodedAudio, peak_count: usize) -> Vec<f32> {
    if peak_count == 0 || audio.samples.is_empty() || audio.channels == 0 {
        return Vec::new();
    }

    let frames = audio.samples.len() / audio.channels;
    if frames == 0 {
        return vec![0.0; peak_count];
    }

    let frames_per_peak = frames.div_ceil(peak_count).max(1);
    (0..peak_count)
        .map(|bucket| {
            let start_frame = bucket * frames_per_peak;
            let end_frame = ((bucket + 1) * frames_per_peak).min(frames);
            if start_frame >= end_frame {
                return 0.0;
            }
            let mut peak = 0.0_f32;
            for frame in start_frame..end_frame {
                let offset = frame * audio.channels;
                for channel in 0..audio.channels {
                    peak = peak.max(audio.samples[offset + channel].abs());
                }
            }
            peak.min(1.0)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::waveform_peaks_with_count;
    use crate::audio::decode::DecodedAudio;

    #[test]
    fn waveform_peak_extraction_uses_absolute_interleaved_samples() {
        let audio = DecodedAudio {
            sample_rate: 48_000,
            channels: 2,
            samples: vec![0.1, -0.2, 0.4, -0.3, 0.0, 0.8, -0.5, 0.2],
        };

        let peaks = waveform_peaks_with_count(&audio, 2);

        assert_eq!(peaks, vec![0.4, 0.8]);
    }
}
