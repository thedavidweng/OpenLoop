import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project subpath: thedavidweng.github.io/OpenLoop/
  base: "/OpenLoop/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
