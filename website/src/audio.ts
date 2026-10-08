import { seededRandom } from "./waveform";

export type PresetName = "lofi" | "synthwave" | "folk";

export interface Preset {
  name: PresetName;
  bpm: number;
  key: string;
  chords: number[][];
}

export const PRESETS: Record<PresetName, Preset> = {
  lofi: {
    name: "lofi",
    bpm: 82,
    key: "A minor",
    chords: [
      [57, 60, 64, 67, 71],
      [53, 57, 60, 64],
      [48, 55, 59, 64],
      [52, 55, 59, 62],
    ],
  },
  synthwave: {
    name: "synthwave",
    bpm: 104,
    key: "D minor",
    chords: [
      [50, 53, 57, 62],
      [46, 53, 58, 62],
      [41, 53, 57, 60],
      [48, 52, 55, 60],
    ],
  },
  folk: {
    name: "folk",
    bpm: 96,
    key: "G major",
    chords: [
      [43, 55, 59, 62, 67],
      [38, 54, 57, 62],
      [40, 52, 55, 59, 64],
      [36, 48, 55, 60, 64],
    ],
  },
};

export function presetForPrompt(prompt: string): Preset {
  const text = prompt.toLowerCase();
  if (/synth|neon|retro|80s|electro|wave|drive|driving|club|edm|techno|赛博|合成/.test(text)) {
    return PRESETS.synthwave;
  }
  if (/folk|guitar|acoustic|banjo|country|campfire|hum|民谣|吉他/.test(text)) {
    return PRESETS.folk;
  }
  return PRESETS.lofi;
}

interface Voice {
  preset: Preset;
  seed: number;
}

const LOOKAHEAD_SECONDS = 0.15;
const SCHEDULER_INTERVAL_MS = 30;

function frequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** A small Web Audio sketch engine for the landing page demo. It does not
 * resemble model output; it only makes Takes, A/B, and seeds audible. */
export class DemoSynth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private bus: GainNode | null = null;
  private timer = 0;
  private startedAt = 0;
  private offset = 0;
  private nextStep = 0;
  private voice: Voice | null = null;
  private melody: (number | null)[] = [];
  private chordOrder: number[] = [];

  get playing(): boolean {
    return this.voice !== null;
  }

  position(): number {
    if (!this.context || !this.voice) return this.offset;
    return this.offset + (this.context.currentTime - this.startedAt);
  }

  play(preset: Preset, seed: number, offsetSeconds: number): void {
    const context = this.ensureContext();
    void context.resume();
    this.stop();
    this.voice = { preset, seed };
    this.offset = offsetSeconds;
    this.startedAt = context.currentTime + 0.05;

    const random = seededRandom(seed);
    const rotation = Math.floor(random() * preset.chords.length);
    this.chordOrder = preset.chords.map((_, i) => (i + rotation) % preset.chords.length);
    this.melody = Array.from({ length: 32 }, (_, i) => {
      if (random() < (i % 2 === 0 ? 0.42 : 0.18)) return Math.floor(random() * 5);
      return null;
    });

    const bus = context.createGain();
    bus.gain.value = 1;
    bus.connect(this.master as GainNode);
    this.bus = bus;

    this.nextStep = Math.ceil(offsetSeconds / this.stepSeconds());
    this.timer = window.setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
    if (this.context && this.voice) {
      this.offset = this.position();
    }
    if (this.bus && this.context) {
      const bus = this.bus;
      const now = this.context.currentTime;
      bus.gain.setTargetAtTime(0, now, 0.03);
      window.setTimeout(() => bus.disconnect(), 400);
    }
    this.bus = null;
    this.voice = null;
  }

  private stepSeconds(): number {
    const bpm = this.voice?.preset.bpm ?? 90;
    return 60 / bpm / 2;
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const context = new AudioContext();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    const tone = context.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    const master = context.createGain();
    master.gain.value = 0.55;
    master.connect(tone).connect(compressor).connect(context.destination);

    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    this.context = context;
    this.master = master;
    this.noise = noise;
    return context;
  }

  private schedule(): void {
    const context = this.context;
    const voice = this.voice;
    if (!context || !voice) return;
    const step = this.stepSeconds();
    while (true) {
      const songTime = this.nextStep * step;
      const when = this.startedAt + (songTime - this.offset);
      if (when > context.currentTime + LOOKAHEAD_SECONDS) break;
      if (when >= context.currentTime - 0.01) {
        this.playStep(voice.preset, this.nextStep, when);
      }
      this.nextStep += 1;
    }
  }

  private playStep(preset: Preset, step: number, when: number): void {
    const stepInBar = step % 8;
    const bar = Math.floor(step / 8);
    const chord = preset.chords[this.chordOrder[bar % this.chordOrder.length]];
    const beat = this.stepSeconds() * 2;
    const swing = preset.name === "lofi" && step % 2 === 1 ? this.stepSeconds() * 0.18 : 0;
    const t = when + swing;

    if (preset.name === "lofi") {
      if (stepInBar === 0) chord.slice(1).forEach((n) => this.keys(n, t, beat * 3.6, 0.07));
      if (stepInBar === 0) this.bass(chord[0] - 12, t, beat * 2.5, 0.32);
      if (stepInBar === 5) this.bass(chord[0] - 12, t, beat * 1.2, 0.22);
      if (stepInBar === 0 || stepInBar === 5) this.kick(t, 0.75);
      if (stepInBar === 2 || stepInBar === 6) this.snare(t, 0.16);
      this.hat(t, step % 2 === 0 ? 0.05 : 0.03);
    } else if (preset.name === "synthwave") {
      if (stepInBar === 0) chord.forEach((n) => this.pad(n + 12, t, beat * 4, 0.035));
      this.bass(chord[0] - 12 + (step % 2 === 1 ? 12 : 0), t, this.stepSeconds() * 0.9, 0.2);
      if (step % 2 === 0) this.kick(t, 0.8);
      if (stepInBar === 2 || stepInBar === 6) this.snare(t, 0.22);
      if (step % 2 === 1) this.hat(t, 0.06);
    } else {
      const arpeggio = [0, 2, 1, 3, 2, 4, 3, 1];
      const note = chord[arpeggio[stepInBar] % chord.length];
      this.pluck(note + 12, t, beat * 1.6, 0.11);
      if (stepInBar === 0) this.bass(chord[0], t, beat * 3, 0.18);
      if (step % 2 === 1) this.hat(t, 0.02);
    }

    const melodyNote = this.melody[step % this.melody.length];
    if (melodyNote !== null && melodyNote !== undefined && bar % 4 >= 1) {
      const tones = [...chord].sort((a, b) => a - b);
      const pitch = tones[melodyNote % tones.length] + 12;
      if (preset.name === "synthwave") this.lead(pitch, t, this.stepSeconds() * 1.6, 0.05);
      else this.keys(pitch + 12, t, beat * 1.2, 0.06);
    }
  }

  private envelope(start: number, peak: number, attack: number, duration: number): GainNode {
    const context = this.context as AudioContext;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.bus as GainNode);
    return gain;
  }

  private tone(
    type: OscillatorType,
    midi: number,
    start: number,
    end: number,
    out: AudioNode,
    detune = 0,
  ): void {
    const context = this.context as AudioContext;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency(midi);
    osc.detune.value = detune;
    osc.connect(out);
    osc.start(start);
    osc.stop(end + 0.05);
  }

  private keys(midi: number, start: number, duration: number, level: number): void {
    const out = this.envelope(start, level, 0.01, duration);
    this.tone("sine", midi, start, start + duration, out);
    const bell = this.envelope(start, level * 0.25, 0.005, duration * 0.4);
    this.tone("triangle", midi + 12, start, start + duration * 0.4, bell);
  }

  private pad(midi: number, start: number, duration: number, level: number): void {
    const context = this.context as AudioContext;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1300;
    const out = this.envelope(start, level, 0.25, duration);
    filter.connect(out);
    this.tone("sawtooth", midi, start, start + duration, filter, -8);
    this.tone("sawtooth", midi, start, start + duration, filter, 8);
  }

  private lead(midi: number, start: number, duration: number, level: number): void {
    const out = this.envelope(start, level, 0.01, duration);
    this.tone("square", midi, start, start + duration, out);
  }

  private pluck(midi: number, start: number, duration: number, level: number): void {
    const out = this.envelope(start, level, 0.004, duration);
    this.tone("triangle", midi, start, start + duration, out);
    const body = this.envelope(start, level * 0.4, 0.004, duration * 0.5);
    this.tone("sine", midi + 12, start, start + duration * 0.5, body);
  }

  private bass(midi: number, start: number, duration: number, level: number): void {
    const out = this.envelope(start, level, 0.012, duration);
    this.tone("sine", midi, start, start + duration, out);
  }

  private kick(start: number, level: number): void {
    const context = this.context as AudioContext;
    const osc = context.createOscillator();
    osc.frequency.setValueAtTime(140, start);
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.14);
    const out = this.envelope(start, level, 0.003, 0.32);
    osc.connect(out);
    osc.start(start);
    osc.stop(start + 0.36);
  }

  private noiseHit(
    start: number,
    level: number,
    duration: number,
    type: BiquadFilterType,
    hz: number,
  ): void {
    const context = this.context as AudioContext;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hz;
    const out = this.envelope(start, level, 0.002, duration);
    source.connect(filter).connect(out);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.05);
  }

  private snare(start: number, level: number): void {
    this.noiseHit(start, level, 0.2, "bandpass", 1800);
  }

  private hat(start: number, level: number): void {
    this.noiseHit(start, level, 0.05, "highpass", 7000);
  }
}
