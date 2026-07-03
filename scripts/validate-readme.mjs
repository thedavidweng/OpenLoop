#!/usr/bin/env node
/**
 * validate-readme.mjs
 * Validates README.md and README_CN.md for license/status consistency.
 *
 * Behavioral criteria:
 *  1. README.md license badge says Apache-2.0, not MIT
 *  2. README_CN.md license badge says Apache-2.0, not MIT
 *  3. README.md contains status line with v0.1 Alpha
 *  4. README_CN.md contains status line with v0.1 Alpha (Chinese)
 *  5. README_CN.md has Release badge
 *  6. CSP ADR references Tauri v2 security docs, not v1
 *  7. License section text in both READMEs says Apache-2.0
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function readFile(rel) {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

const checks = [];
let passCount = 0;
let failCount = 0;

function check(name, ok, detail) {
  if (ok) {
    passCount++;
    checks.push(`  PASS  ${name}`);
  } else {
    failCount++;
    checks.push(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

// Load files
const readme = readFile("README.md");
const readmeCN = readFile("README_CN.md");
const cspAdr = readFile("docs/adr/0003-content-security-policy.md");

// 1. README.md license badge says Apache-2.0
check(
  "1. README.md license badge is Apache-2.0",
  /License-MIT/.test(readme) === false && /Apache--2\.0|License-Apache/.test(readme) === true,
  "badge still says MIT or missing Apache-2.0"
);

// 2. README_CN.md license badge says Apache-2.0
check(
  "2. README_CN.md license badge is Apache-2.0",
  /License-MIT/.test(readmeCN) === false && /Apache--2\.0|License-Apache/.test(readmeCN) === true,
  "badge still says MIT or missing Apache-2.0"
);

// 3. README.md contains status line with an Alpha version tag
check(
  "3. README.md has Alpha status line",
  /v\d+\.\d+(?:\.\d+)?\s+Alpha/i.test(readme),
  "no 'vX.Y Alpha' status found"
);

// 4. README_CN.md contains status line with an Alpha version tag (Chinese)
check(
  "4. README_CN.md has Alpha status line",
  /v\d+\.\d+(?:\.\d+)?\s+Alpha/i.test(readmeCN),
  "no 'vX.Y Alpha' status found in Chinese README"
);

// 5. README_CN.md has Release badge (shield.io badge in the header badge block)
const cnBadgeBlock = readmeCN.split("</div>")[0]; // everything before first closing div
check(
  "5. README_CN.md has Release badge",
  /img\.shields\.io.*release/i.test(cnBadgeBlock) || /\[!\[Release\]/i.test(cnBadgeBlock),
  "missing Release badge in header badge block"
);

// 6. CSP ADR references Tauri v2 security docs
check(
  "6. CSP ADR references Tauri v2 (not v1)",
  /tauri\.app\/v1/.test(cspAdr) === false && /tauri\.app.*v2|v2\.tauri\.app/.test(cspAdr) === true,
  "still references tauri.app/v1"
);

// 7. License section text says Apache-2.0 (accept "Apache License 2.0" or "Apache-2.0")
check(
  "7a. README.md License section says Apache-2.0",
  /## License[\s\S]*?Apache(?: License)?[- ]2\.0/i.test(readme) && /## License[\s\S]*?MIT/.test(readme) === false,
  "License section missing Apache-2.0 or still mentions MIT"
);
check(
  "7b. README_CN.md License section says Apache-2.0",
  /## 许可证[\s\S]*?Apache(?: License)?[- ]2\.0/i.test(readmeCN) && /## 许可证[\s\S]*?MIT/.test(readmeCN) === false,
  "License section missing Apache-2.0 or still mentions MIT"
);

// Report
console.log("\n=== README Validation ===\n");
for (const line of checks) console.log(line);
console.log(`\n  ${passCount} passed, ${failCount} failed\n`);
process.exit(failCount > 0 ? 1 : 0);