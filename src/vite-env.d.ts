/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** package.json version, injected at build time by vite.config.ts. */
  readonly PACKAGE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
