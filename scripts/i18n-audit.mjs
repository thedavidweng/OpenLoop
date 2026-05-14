#!/usr/bin/env node

/**
 * i18n-audit — Compare locale key sets between en.json and zh-CN.json.
 *
 * Reads src/locales/en.json and src/locales/zh-CN.json, flattens nested
 * objects into dot-separated keys, and reports any keys present in en.json
 * but missing in zh-CN.json.
 *
 * Exit codes:
 *   0 — all keys match
 *   1 — missing keys found
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

function flatten(obj, prefix = "") {
  const entries = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      entries.push(...flatten(value, path));
    } else {
      entries.push(path);
    }
  }
  return entries;
}

function loadKeys(localePath) {
  const filePath = resolve(PROJECT_ROOT, localePath);
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return new Set(flatten(data));
}

function main() {
  const enKeys = loadKeys("src/locales/en.json");
  const zhKeys = loadKeys("src/locales/zh-CN.json");

  const missing = [];
  for (const key of enKeys) {
    if (!zhKeys.has(key)) {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    console.log("✓ All en.json keys are present in zh-CN.json.");
    process.exit(0);
  }

  console.error(`✗ ${missing.length} key(s) missing in zh-CN.json:\n`);
  for (const key of missing) {
    console.error(`  • ${key}`);
  }
  console.error();
  process.exit(1);
}

main();
