import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import zhCN from "@/locales/zh-CN.json";

/*
 * ja-JP / ko-KR feasibility:
 * - i18next setup supports adding new locales: add a `import` + add to `resources`
 * - Text direction is LTR (no RTL concerns)
 * - The UI uses CSS custom properties with no hardcoded text colors
 * - Existing locale keys (~500 in en.json) need translation for each new locale
 * - No ICU plural rules or complex formatting that would block CJK locales
 * - Font stack (globals.css) already includes "Noto Sans CJK JP" for Japanese glyphs
 * - No locale-specific date/number formatting is used (only toLocaleTimeString in debug views)
 * - Estimated effort: ~1 day to translate all keys for ja-JP or ko-KR by a native speaker,
 *   plus testing for string-length layout issues (CJK text is denser)
 * - Recommendation: add ja-JP as next locale given existing "Noto Sans CJK JP" font support
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "zh-CN", name: "简体中文" },
] as const;

export function detectSystemLanguage(): string {
  const nav = navigator.language;
  if (SUPPORTED_LANGUAGES.some((language) => language.code === nav)) {
    return nav;
  }
  const base = nav.split("-")[0];
  return SUPPORTED_LANGUAGES.find((language) => language.code.startsWith(base))?.code ?? "en";
}

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
  },
  lng: detectSystemLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

/** Shorthand for `i18next.t()` — shared across non-component modules. */
export function tr(key: string, options?: Record<string, unknown>) {
  return i18next.t(key, options);
}

export default i18next;
