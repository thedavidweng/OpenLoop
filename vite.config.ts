/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Tauri injects this value when remote device debugging is enabled.
// @ts-expect-error process is a Node.js global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  define: {
    // Make package.json version available at runtime for the About section and
    // diagnostics export. Vite replaces this at build time.
    "import.meta.env.PACKAGE_VERSION": JSON.stringify(
      // @ts-expect-error process is a Node.js global
      process.env.npm_package_version || "unknown",
    ),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "src-tauri/**", "reference/**"],
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/app/lib/**/*.ts", "src/app/components/**/*.tsx"],
      exclude: [
        "src/app/lib/types.ts",
        "src/app/lib/store.ts",
        "src/app/lib/store/types.ts",
        "src/app/lib/store/index.ts",
        "src/app/lib/i18n.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        lines: 60,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/zustand/")) {
            return "vendor-state";
          }
          if (id.includes("node_modules/i18next/") || id.includes("node_modules/react-i18next/")) {
            return "vendor-i18n";
          }
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
