const CLI_PATH = "/Applications/OpenLoop.app/Contents/MacOS/openloop-cli";
const SET_CLI = `CLI=${CLI_PATH}`;
const RUN =
  "\"$CLI\" run --configuration ace-step/turbo \\\n    --prompt 'warm lo-fi piano, soft drums' --duration 30 --json";

const COPY_TEXT = `${SET_CLI}\n${RUN}`;

type Line = { kind: "command"; text: string } | { kind: "json"; text: string; delay: number };

function event(seconds: number, kind: string, data: string): string {
  const ts = `2026-10-08T09:41:${String(seconds).padStart(2, "0")}Z`;
  return `{"v":2,"ts":"${ts}","kind":"${kind}","data":${data}}`;
}

const SCRIPT: Line[] = [
  { kind: "command", text: SET_CLI },
  { kind: "command", text: RUN },
  ...[0.25, 0.5, 0.75, 1].map((fraction, i): Line => ({
    kind: "json",
    delay: 520,
    text: event(3 + i * 4, "progress", `{"fraction":${fraction},"label":"Generating Take"}`),
  })),
  {
    kind: "json",
    delay: 420,
    text: event(
      19,
      "result",
      '{"generation":{"id":"gen_8f3a","seed":1847},"take":{"generationID":"gen_8f3a","index":0}}',
    ),
  },
];

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(text: string): string {
  return escapeHtml(text).replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)/g,
    (match, string: string | undefined, colon: string | undefined, number: string | undefined) => {
      if (string && colon) return `<span class="t-key">${string}</span>${colon}`;
      if (string) return `<span class="t-string">${string}</span>`;
      if (number) return `<span class="t-number">${number}</span>`;
      return match;
    },
  );
}

function renderCommand(text: string): string {
  return `<span class="t-prompt">$</span> ${escapeHtml(text)}`;
}

export function mountTerminal(root: HTMLElement, icon: (name: string) => string): void {
  const body = root.querySelector("[data-terminal-body] code") as HTMLElement;
  const copy = root.querySelector("[data-copy]") as HTMLButtonElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finalHtml = SCRIPT.map((line) =>
    line.kind === "command" ? renderCommand(line.text) : highlightJson(line.text),
  ).join("\n");

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(COPY_TEXT);
      copy.innerHTML = `<i data-icon="check">${icon("check")}</i>`;
      window.setTimeout(() => {
        copy.innerHTML = `<i data-icon="copy">${icon("copy")}</i>`;
      }, 1600);
    } catch {
      // Clipboard access can be denied; the command stays visible to copy by hand.
    }
  });

  if (reducedMotion) {
    body.innerHTML = finalHtml;
    return;
  }

  body.innerHTML = '<span class="t-cursor"></span>';
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void play();
    },
    { threshold: 0.4 },
  );
  observer.observe(root);

  async function play(): Promise<void> {
    const done: string[] = [];
    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const paint = (partial = "") => {
      body.innerHTML =
        [...done, partial].filter(Boolean).join("\n") + '<span class="t-cursor"></span>';
    };
    for (const line of SCRIPT) {
      if (line.kind === "command") {
        for (let i = 1; i <= line.text.length; i += 1) {
          paint(renderCommand(line.text.slice(0, i)));
          await wait(line.text[i - 1] === " " ? 34 : 14);
        }
        done.push(renderCommand(line.text));
        await wait(380);
      } else {
        await wait(line.delay);
        done.push(highlightJson(line.text));
        paint();
      }
    }
    done.push('<span class="t-prompt">$</span> ');
    body.innerHTML = done.join("\n") + '<span class="t-cursor"></span>';
  }
}
