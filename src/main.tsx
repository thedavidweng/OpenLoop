import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { ToastProvider } from "@/app/components/overlay/Toast";
import "@/app/lib/i18n";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
