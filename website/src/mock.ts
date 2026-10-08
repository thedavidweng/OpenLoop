import { DemoSynth, presetForPrompt, type Preset } from "./audio";
import { setIcon } from "./icons";
import { seededRandom, setProgress, varyBars, waveformBars, waveformSvg } from "./waveform";

interface Take {
  id: number;
  number: number;
  prompt: string;
  seed: number;
  preset: Preset;
  bars: number[];
  created: Date;
  origin?: string;
}

const DURATION = 30;
const BAR_COUNT = 150;
const MAX_TAKES = 6;
const MODEL_LABEL = "ACE-Step 1.5 Turbo";
const INITIAL_PROMPT = "Warm lo-fi piano, soft drums, midnight atmosphere, instrumental";
const DEMO_PROMPT = "Dreamy synthwave, driving bass, neon city at night";
const IDLE_HINT = "To repaint, play this Take and drag across the waveform to select a part.";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function formatCreated(date: Date): string {
  return `${dateFormat.format(date)} at ${timeFormat.format(date)}`;
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function mountMock(root: HTMLElement): void {
  const $ = <T extends Element>(selector: string) => root.querySelector(selector) as T;
  const prompt = $<HTMLTextAreaElement>("[data-prompt]");
  const list = $<HTMLOListElement>("[data-take-list]");
  const wave = $<HTMLDivElement>("[data-wave]");
  const playButton = $<HTMLButtonElement>("[data-play]");
  const time = $<HTMLSpanElement>("[data-time]");
  const generate = $<HTMLButtonElement>("[data-generate]");
  const generateFill = $<HTMLSpanElement>("[data-generate-fill]");
  const generateLabel = $<HTMLSpanElement>("[data-generate-label]");
  const repaint = $<HTMLButtonElement>("[data-repaint]");
  const hint = $<HTMLParagraphElement>("[data-hint]");
  const abButtons = root.querySelectorAll<HTMLButtonElement>("[data-ab]");

  const synth = new DemoSynth();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let takes: Take[] = [];
  let nextNumber = 1;
  let selected: Take | null = null;
  let compare: Take | null = null;
  let side: "a" | "b" = "a";
  let position = 0;
  let busy = false;
  let region: [number, number] | null = null;
  let frame = 0;
  let userTouched = false;

  function createTake(text: string, seed: number, bars?: number[], origin?: string): Take {
    const take: Take = {
      id: nextNumber,
      number: nextNumber,
      prompt: text.trim() || INITIAL_PROMPT,
      seed,
      preset: presetForPrompt(text),
      bars: bars ?? waveformBars(seed, BAR_COUNT),
      created: new Date(),
      origin,
    };
    nextNumber += 1;
    return take;
  }

  function audible(): Take | null {
    return side === "b" && compare ? compare : selected;
  }

  function renderList(): void {
    list.innerHTML = "";
    for (const take of takes) {
      const item = document.createElement("li");
      item.className = "mock-take";
      item.dataset.id = String(take.id);
      const playing = take === audible() && synth.playing;
      item.classList.toggle("is-selected", take === selected);
      const badge = take === compare ? '<em class="mock-badge">B</em>' : "";
      item.innerHTML = `
        <span class="mock-take-play"><i></i></span>
        <span class="mock-take-text">
          <strong>Take ${take.number}${badge}</strong>
          <span class="mock-take-prompt"></span>
          <small></small>
        </span>
        <span class="mock-take-wave">${waveformSvg(take.bars.filter((_, i) => i % 3 === 0))}</span>`;
      setIcon(item.querySelector(".mock-take-play i") as Element, playing ? "pause" : "play");
      (item.querySelector(".mock-take-prompt") as HTMLElement).textContent = take.prompt;
      (item.querySelector("small") as HTMLElement).textContent =
        take.origin ?? `${MODEL_LABEL} · 0:30 · ${formatCreated(take.created)}`;
      list.append(item);
    }
    root
      .querySelectorAll("[data-take-count], [data-project-count], [data-history-count]")
      .forEach((element) => {
        element.textContent = String(takes.length);
      });
  }

  function renderTransport(): void {
    const take = audible();
    wave.innerHTML = take ? waveformSvg(take.bars, { withProgress: true }) : "";
    const selection = document.createElement("span");
    selection.className = "mock-region";
    selection.hidden = true;
    const head = document.createElement("span");
    head.className = "mock-playhead";
    wave.append(selection, head);
    renderRegion();
    renderProgress();
  }

  function renderRegion(): void {
    const element = wave.querySelector<HTMLElement>(".mock-region");
    if (element) {
      element.hidden = !region;
      if (region) {
        element.style.left = `${region[0] * 100}%`;
        element.style.width = `${(region[1] - region[0]) * 100}%`;
      }
    }
    repaint.disabled = !region || busy;
  }

  function renderProgress(): void {
    const fraction = position / DURATION;
    setProgress(wave, fraction);
    const head = wave.querySelector<HTMLElement>(".mock-playhead");
    if (head) head.style.left = `${fraction * 100}%`;
    time.textContent = `${formatTime(position)} / ${formatTime(DURATION)}`;
  }

  function renderInspector(): void {
    const take = audible();
    if (!take) return;
    $<HTMLElement>("[data-inspector-prompt]").textContent = take.prompt;
    $<HTMLElement>("[data-inspector-seed]").textContent = String(take.seed);
    $<HTMLElement>("[data-inspector-created]").textContent = formatCreated(take.created);
    $<HTMLElement>("[data-inspector-file]").textContent = `Take ${take.number}.wav`;
    $<HTMLElement>("[data-compare-label]").textContent = compare
      ? `Take ${compare.number}`
      : "None";
  }

  function renderControls(): void {
    setIcon(playButton.querySelector("i") as Element, synth.playing ? "pause" : "play");
    playButton.setAttribute("aria-label", synth.playing ? "Pause" : "Play");
    abButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.ab === side);
      button.disabled = button.dataset.ab === "b" && !compare;
    });
    renderList();
  }

  function renderAll(): void {
    renderTransport();
    renderInspector();
    renderControls();
  }

  function tick(): void {
    if (!synth.playing) return;
    position = synth.position();
    if (position >= DURATION) {
      stop();
      position = 0;
      renderProgress();
      return;
    }
    if (region && position >= region[1] * DURATION) {
      // A selected region loops, mirroring the app's loop playback.
      position = region[0] * DURATION;
      startAudio();
    }
    renderProgress();
    frame = requestAnimationFrame(tick);
  }

  function startAudio(): void {
    const take = audible();
    if (!take) return;
    synth.play(take.preset, take.seed, Math.max(0, position));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  function play(): void {
    if (position >= DURATION - 0.2) position = 0;
    startAudio();
    renderControls();
  }

  function stop(): void {
    synth.stop();
    cancelAnimationFrame(frame);
    renderControls();
  }

  function select(take: Take): void {
    if (take === selected && side === "a") return;
    if (take !== selected) {
      compare = selected;
      selected = take;
    }
    side = "a";
    region = null;
    hint.textContent = IDLE_HINT;
    renderAll();
    if (synth.playing) startAudio();
  }

  function runProgress(label: string, duration: number, done: () => void): void {
    busy = true;
    generate.disabled = true;
    renderRegion();
    const started = performance.now();
    const step = (now: number) => {
      const fraction = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - fraction) ** 2;
      generateFill.style.transform = `scaleX(${eased})`;
      generateLabel.textContent = `${label} · ${Math.round(eased * 100)}%`;
      if (fraction < 1) {
        requestAnimationFrame(step);
        return;
      }
      busy = false;
      generate.disabled = false;
      generateFill.style.transform = "scaleX(0)";
      generateLabel.textContent = "Generate Takes";
      done();
      renderRegion();
    };
    requestAnimationFrame(step);
  }

  function addTakes(newTakes: Take[]): void {
    const newestFirst = newTakes.slice().reverse();
    takes = [...newestFirst, ...takes].slice(0, MAX_TAKES);
    compare = newestFirst[1] ?? selected;
    selected = newestFirst[0];
    side = "a";
    region = null;
    hint.textContent = IDLE_HINT;
    renderAll();
    for (const take of newTakes) {
      list.querySelector(`[data-id="${take.id}"]`)?.classList.add("is-new");
    }
    if (synth.playing) startAudio();
  }

  function generateTakes(): void {
    if (busy) return;
    const random = seededRandom(Date.now());
    const seeds = [1000 + Math.floor(random() * 9000), 1000 + Math.floor(random() * 9000)];
    const text = prompt.value;
    runProgress("Generating 2 Takes", reducedMotion ? 300 : 2600, () => {
      addTakes(seeds.map((seed) => createTake(text, seed)));
    });
  }

  root.addEventListener("pointerdown", () => {
    userTouched = true;
  });

  root.querySelectorAll("[data-toggle-sidebar]").forEach((button) => {
    button.addEventListener("click", () => root.classList.toggle("is-sidebar-hidden"));
  });

  $<HTMLButtonElement>("[data-toggle-inspector]").addEventListener("click", () => {
    root.classList.toggle("is-inspector-hidden");
  });

  generate.addEventListener("click", generateTakes);

  $<HTMLButtonElement>("[data-reproduce]").addEventListener("click", () => {
    const source = audible();
    if (!source || busy) return;
    runProgress("Reproducing", reducedMotion ? 200 : 1400, () => {
      addTakes([
        createTake(
          source.prompt,
          source.seed,
          source.bars.slice(),
          `Reproduced Take ${source.number} · seed ${source.seed}`,
        ),
      ]);
    });
  });

  $<HTMLButtonElement>("[data-variation]").addEventListener("click", () => {
    const source = audible();
    if (!source || busy) return;
    const seed = source.seed + 1 + Math.floor(Math.random() * 97);
    runProgress("Creating variation", reducedMotion ? 200 : 1800, () => {
      addTakes([
        createTake(
          source.prompt,
          seed,
          varyBars(source.bars, seed, 0.38),
          `Variation of Take ${source.number} · seed ${seed}`,
        ),
      ]);
    });
  });

  repaint.addEventListener("click", () => {
    const take = audible();
    const range = region;
    if (!take || !range || busy) return;
    runProgress("Repainting", reducedMotion ? 200 : 1600, () => {
      const seed = take.seed + Math.floor(Math.random() * 1000);
      const fresh = waveformBars(seed, BAR_COUNT);
      const start = Math.floor(range[0] * BAR_COUNT);
      const end = Math.ceil(range[1] * BAR_COUNT);
      const span = `${formatTime(range[0] * DURATION)}–${formatTime(range[1] * DURATION)}`;
      take.bars = take.bars.map((value, i) => (i >= start && i < end ? fresh[i] : value));
      take.seed = seed;
      take.origin = `Repainted ${span} · seed ${seed}`;
      hint.textContent = `Repainted ${span}. The selection loops while playing.`;
      renderTransport();
      wave.classList.remove("is-repainted");
      void wave.offsetWidth;
      wave.classList.add("is-repainted");
      renderInspector();
      renderList();
      if (synth.playing) startAudio();
    });
  });

  list.addEventListener("click", (event) => {
    const item = (event.target as Element).closest<HTMLElement>(".mock-take");
    const take = takes.find((candidate) => String(candidate.id) === item?.dataset.id);
    if (!take) return;
    const wantsPlay = Boolean((event.target as Element).closest(".mock-take-play"));
    if (take === audible() && wantsPlay) {
      if (synth.playing) stop();
      else play();
      return;
    }
    select(take);
    if (wantsPlay && !synth.playing) {
      position = 0;
      play();
    }
  });

  playButton.addEventListener("click", () => {
    if (synth.playing) stop();
    else play();
  });

  abButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.ab === "b" ? "b" : "a";
      if (next === side || (next === "b" && !compare)) return;
      side = next;
      region = null;
      renderAll();
      if (synth.playing) startAudio();
    });
  });

  $<HTMLButtonElement>("[data-clear-ab]").addEventListener("click", () => {
    compare = null;
    side = "a";
    renderAll();
    if (synth.playing) startAudio();
  });

  let dragStart: number | null = null;
  const fractionAt = (event: PointerEvent) => {
    const rect = wave.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };
  wave.addEventListener("pointerdown", (event) => {
    dragStart = fractionAt(event);
    wave.setPointerCapture(event.pointerId);
  });
  wave.addEventListener("pointermove", (event) => {
    if (dragStart === null) return;
    const current = fractionAt(event);
    if (Math.abs(current - dragStart) < 0.01) return;
    region = [Math.min(dragStart, current), Math.max(dragStart, current)];
    renderRegion();
  });
  wave.addEventListener("pointerup", (event) => {
    if (dragStart === null) return;
    const current = fractionAt(event);
    if (Math.abs(current - dragStart) < 0.01) {
      region = null;
      position = current * DURATION;
      hint.textContent = IDLE_HINT;
    } else {
      position = (region?.[0] ?? 0) * DURATION;
      hint.textContent = "Press Repaint Selection to regenerate only this part.";
    }
    if (synth.playing) startAudio();
    dragStart = null;
    renderRegion();
    renderProgress();
  });

  prompt.addEventListener("focus", () => {
    userTouched = true;
  });

  prompt.value = INITIAL_PROMPT;
  takes = [
    createTake(INITIAL_PROMPT, 42),
    createTake(INITIAL_PROMPT, 7731),
    createTake(INITIAL_PROMPT, 1847),
  ].reverse();
  selected = takes[0];
  compare = takes[1];
  renderAll();

  if (reducedMotion) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      window.setTimeout(autoDemo, 900);
    },
    { threshold: 0.45 },
  );
  observer.observe(root);

  function autoDemo(): void {
    if (userTouched) return;
    let index = 0;
    prompt.value = "";
    const type = () => {
      if (userTouched) {
        if (!prompt.value) prompt.value = INITIAL_PROMPT;
        return;
      }
      index += 1;
      prompt.value = DEMO_PROMPT.slice(0, index);
      if (index < DEMO_PROMPT.length) {
        window.setTimeout(type, 28 + Math.random() * 40);
        return;
      }
      window.setTimeout(() => {
        if (!userTouched) generateTakes();
      }, 500);
    };
    type();
  }
}
