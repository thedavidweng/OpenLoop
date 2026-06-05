import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { ToastProvider } from "@/app/components/overlay/Toast";
import "@/app/lib/i18n";
import "@/styles/globals.css";

function Root() {
  useEffect(() => {
    const handler = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
