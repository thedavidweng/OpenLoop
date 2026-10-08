import { defineConfig } from "vite";

export default defineConfig({
  // Relative so one build works at thedavidweng.github.io/OpenLoop/
  // and at the openloop.blahaj.uk root.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
