import { applyLanguage, uiCopy, type Language } from "./i18n";
import { hydrateIcons, iconSvg, setIcon } from "./icons";
import { mountMock } from "./mock";
import { mountTerminal } from "./terminal";
import { waveformBars, waveformSvg } from "./waveform";

type Theme = "dark" | "light";

const root = document.documentElement;
const MOCK_WIDTH = 1160;
const MOCK_HEIGHT = 652;

function currentLanguage(): Language {
  return root.lang === "zh-CN" ? "zh-CN" : "en";
}

function currentTheme(): Theme {
  return root.dataset.theme === "light" ? "light" : "dark";
}

function syncControls(): void {
  const copy = uiCopy(currentLanguage());
  const theme = currentTheme();
  const languageButton = document.querySelector('[data-action="language"]');
  languageButton?.setAttribute("aria-label", copy.switchLanguage);
  const languageLabel = document.querySelector("[data-language-label]");
  if (languageLabel) languageLabel.textContent = copy.languageLabel;
  const themeButton = document.querySelector('[data-action="theme"]');
  const themeLabel = theme === "dark" ? copy.themeToLight : copy.themeToDark;
  themeButton?.setAttribute("aria-label", themeLabel);
  themeButton?.setAttribute("title", themeLabel);
  const themeIcon = document.querySelector("[data-theme-icon]");
  if (themeIcon) setIcon(themeIcon, theme === "dark" ? "moon" : "sun");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#08090a" : "#f7f7f5");
}

function setLanguage(language: Language): void {
  applyLanguage(language);
  localStorage.setItem("openloop-site-language", language);
  syncControls();
}

function setTheme(theme: Theme): void {
  root.dataset.theme = theme;
  localStorage.setItem("openloop-site-theme", theme);
  syncControls();
}

function fitStage(frame: HTMLElement, mock: HTMLElement): void {
  const resize = () => {
    const width = frame.clientWidth;
    const narrow = window.matchMedia("(max-width: 640px)").matches;
    // On phones the window keeps a desktop layout and bleeds off the right edge.
    const scale = narrow
      ? Math.min(1, (width * 1.7) / MOCK_WIDTH)
      : Math.min(1, width / MOCK_WIDTH);
    mock.style.transform = `scale(${scale})`;
    frame.style.height = `${MOCK_HEIGHT * scale}px`;
  };
  new ResizeObserver(resize).observe(frame);
  resize();
}

function mountMiniWaves(): void {
  document.querySelectorAll<HTMLElement>("[data-mini-wave]").forEach((element) => {
    const seed = Number(element.dataset.miniWave);
    const count = element.classList.contains("mini-wave-wide") ? 64 : 40;
    element.innerHTML = waveformSvg(waveformBars(seed, count));
  });
  const closing = document.querySelector<HTMLElement>("[data-closing-wave]");
  if (closing) {
    closing.innerHTML = waveformSvg(waveformBars(2026, 120));
    closing.querySelectorAll<SVGRectElement>("rect").forEach((rect, i, all) => {
      rect.style.animationDelay = `${(i / all.length) * 2.4}s`;
    });
  }
}

function mountReveal(): void {
  const elements = document.querySelectorAll(".reveal");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  elements.forEach((element) => observer.observe(element));
}

hydrateIcons();
applyLanguage(currentLanguage());
syncControls();

document.querySelector('[data-action="language"]')?.addEventListener("click", () => {
  setLanguage(currentLanguage() === "en" ? "zh-CN" : "en");
});
document.querySelector('[data-action="theme"]')?.addEventListener("click", () => {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
});

const year = document.querySelector("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());

const frame = document.querySelector<HTMLElement>("[data-stage]");
const mock = document.querySelector<HTMLElement>("[data-mock]");
if (frame && mock) {
  fitStage(frame, mock);
  mountMock(mock);
}

const terminal = document.querySelector<HTMLElement>("[data-terminal]");
if (terminal) mountTerminal(terminal, iconSvg);

mountMiniWaves();
mountReveal();
