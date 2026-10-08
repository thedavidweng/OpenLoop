export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function waveformBars(seed: number, count: number): number[] {
  const random = seededRandom(seed);
  const sections = 3 + Math.floor(random() * 3);
  const phase = random() * Math.PI * 2;
  const raw: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const arc = 0.42 + 0.22 * Math.sin(t * Math.PI * sections + phase);
    const pulse = i % 4 === 0 ? 0.16 : 0;
    raw.push(arc + pulse + (random() - 0.5) * 0.5);
  }
  return raw.map((value, i) => {
    const previous = raw[i - 1] ?? value;
    const next = raw[i + 1] ?? value;
    const smoothed = value * 0.6 + (previous + next) * 0.2;
    const t = i / count;
    const fade = Math.min(1, t / 0.06, (1 - t) / 0.05);
    return clamp(smoothed * (0.35 + 0.65 * fade), 0.06, 1);
  });
}

export function varyBars(bars: number[], seed: number, amount: number): number[] {
  const fresh = waveformBars(seed, bars.length);
  return bars.map((value, i) => value * (1 - amount) + fresh[i] * amount);
}

let clipCounter = 0;

/** Renders bars as an SVG. When `withProgress` is set, a clipped accent copy is
 * layered on top and its clip rect width can be driven via `setProgress`. */
export function waveformSvg(bars: number[], options: { withProgress?: boolean } = {}): string {
  const gap = 3;
  const width = bars.length * gap;
  const rects = bars
    .map((h, i) => {
      const height = Math.max(4, h * 100);
      return `<rect x="${i * gap}" y="${(100 - height) / 2}" width="2" height="${height}" rx="1"/>`;
    })
    .join("");
  if (!options.withProgress) {
    return `<svg viewBox="0 0 ${width} 100" preserveAspectRatio="none" aria-hidden="true"><g class="wave-base">${rects}</g></svg>`;
  }
  clipCounter += 1;
  const id = `wave-clip-${clipCounter}`;
  return `<svg viewBox="0 0 ${width} 100" preserveAspectRatio="none" aria-hidden="true">
    <defs><clipPath id="${id}"><rect class="wave-clip" x="0" y="0" width="0" height="100"/></clipPath></defs>
    <g class="wave-base">${rects}</g>
    <g class="wave-played" clip-path="url(#${id})">${rects}</g>
  </svg>`;
}

export function setProgress(container: Element, fraction: number): void {
  const svg = container.querySelector("svg");
  const clip = container.querySelector(".wave-clip");
  if (!svg || !clip) return;
  const width = svg.viewBox.baseVal.width;
  clip.setAttribute("width", String(width * clamp(fraction, 0, 1)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
