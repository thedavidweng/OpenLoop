#!/usr/bin/env node
/**
 * validate-readme.mjs
 * Validates README.md, README_CN.md, CSP ADR, and v1 plan for Issue #69.
 *
 * Behavioral criteria:
 *  1. README.md license badge says Apache-2.0, not MIT
 *  2. README_CN.md license badge says Apache-2.0, not MIT
 *  3. README.md contains status line with v0.1 Alpha
 *  4. README_CN.md contains status line with v0.1 Alpha (Chinese)
 *  5. README_CN.md has Release badge
 *  6. CSP ADR references Tauri v2 security docs, not v1
 *  7. v1 plan tasks 1.2.4, 1.5.2, 1.5.3 are checked off
 *  8. License section text in both READMEs says Apache-2.0
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
const v1Plan = readFile("docs/plans/2026-05-14-v1-readiness-master-plan.md");

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

// 3. README.md contains status line with v0.1 Alpha
check(
  "3. README.md has v0.1 Alpha status line",
  /v0\.1\s+Alpha/i.test(readme),
  "no 'v0.1 Alpha' found"
);

// 4. README_CN.md contains status line with v0.1 Alpha (Chinese)
check(
  "4. README_CN.md has v0.1 Alpha status line",
  /v0\.1\s+Alpha/i.test(readmeCN),
  "no 'v0.1 Alpha' found in Chinese README"
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

// 7. v1 plan tasks 1.2.4, 1.5.2, 1.5.3 are checked off
const task124 = /\[x\]\s*1\.2\.4/.test(v1Plan);
const task152 = /\[x\]\s*1\.5\.2/.test(v1Plan);
const task153 = /\[x\]\s*1\.5\.3/.test(v1Plan);
check("7a. v1 plan task 1.2.4 is checked", task124);
check("7b. v1 plan task 1.5.2 is checked", task152);
check("7c. v1 plan task 1.5.3 is checked", task153);

// 8. License section text says Apache-2.0
check(
  "8a. README.md License section says Apache-2.0",
  /## License[\s\S]*?Apache-2\.0/i.test(readme) && /## License[\s\S]*?MIT/.test(readme) === false,
  "License section still mentions MIT"
);
check(
  "8b. README_CN.md License section says Apache-2.0",
  /## 许可证[\s\S]*?Apache-2\.0/i.test(readmeCN) && /## 许可证[\s\S]*?MIT/.test(readmeCN) === false,
  "License section still mentions MIT"
);

// Report
console.log("\n=== Issue #69 Validation ===\n");
for (const line of checks) console.log(line);
console.log(`\n  ${passCount} passed, ${failCount} failed\n`);
process.exit(failCount > 0 ? 1 : 0);
