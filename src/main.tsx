import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { ToastProvider } from "@/app/components/overlay/Toast";
import { TooltipProvider } from "@/app/components/overlay/Tooltip";
import "@/app/lib/i18n";
import "@/styles/globals.css";

function prewarmFontFallbacks() {
  const span = document.createElement("span");
  span.setAttribute("aria-hidden", "true");
  span.style.cssText = "position:absolute;left:-9999px;top:0;opacity:0;pointer-events:none";
  span.textContent = "🎵🎶🎸🎹🥁 中文 日本語 한국어 ∑∫√ ✓✗";
  document.body.appendChild(span);
  void span.getBoundingClientRect();
  requestAnimationFrame(() => requestAnimationFrame(() => span.remove()));
}

function Root() {
  useEffect(() => {
    prewarmFontFallbacks();
    const handler = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
