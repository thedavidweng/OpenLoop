#!/usr/bin/env node

/**
 * validate-release-notes — Check that DMG release notes contain a Gatekeeper
 * installation section and a Homebrew alternative. Historical unsigned releases
 * retain their original instructions; signed releases need no bypass.
 *
 * Exit codes:
 *   0 — all checked release notes pass
 *   1 — one or more checks failed
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const RELEASE_NOTES_DIR = resolve(PROJECT_ROOT, "docs/release-notes");

const CHECKS = [
  {
    id: "gatekeeper-heading",
    desc: "Gatekeeper section heading present",
    test: (content) => /#{1,4}\s*[Gg]atekeeper/.test(content),
  },
  {
    id: "homebrew-mention",
    desc: "Homebrew alternative mentioned",
    test: (content) => /[Hh]omebrew|brew\s+(tap|install|upgrade)/.test(content),
  },
];

function main() {
  let files;
  try {
    files = readdirSync(RELEASE_NOTES_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    console.error(`✗ Cannot read directory: ${RELEASE_NOTES_DIR}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("⚠ No release note files found — nothing to check.");
    process.exit(0);
  }

  let failures = 0;

  for (const file of files.sort()) {
    const filePath = resolve(RELEASE_NOTES_DIR, file);
    const content = readFileSync(filePath, "utf-8");

    for (const check of CHECKS) {
      if (!check.test(content)) {
        console.error(`✗ ${file}: ${check.desc} [${check.id}]`);
        failures++;
      }
    }
  }

  if (failures === 0) {
    console.log(`✓ ${files.length} release note(s) pass all Gatekeeper checks.`);
    process.exit(0);
  }

  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

main();
