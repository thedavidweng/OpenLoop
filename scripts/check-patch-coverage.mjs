#!/usr/bin/env node
/**
 * check-patch-coverage — Compute patch coverage for the current branch.
 *
 * Patch coverage = % of lines added/modified in the diff that are covered
 * by tests. This mirrors the Codecov "patch" status check configured in
 * codecov.yml (target: 80%).
 *
 * Workflow:
 *  1. Run `pnpm vitest run --coverage` to generate coverage/lcov.info
 *  2. Parse lcov.info to build a per-file, per-line hit map
 *  3. Get the diff against the merge-base of the target branch (default: main)
 *  4. For each added/modified line in tracked source files, check coverage
 *  5. Fail if patch coverage is below the threshold (default: 80%)
 *
 * Usage:
 *   node scripts/check-patch-coverage.mjs [--base <branch>] [--threshold <n>]
 *
 * Options:
 *   --base <branch>      Base branch to diff against (default: main)
 *   --threshold <n>      Minimum patch coverage percentage (default: 80)
 *   --skip-run           Skip running vitest; use existing coverage/lcov.info
 *
 * Exit codes:
 *   0 — patch coverage meets or exceeds threshold
 *   1 — patch coverage below threshold
 *   2 — no diff lines found in tracked source files
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LCOV_PATH = resolve(ROOT, "coverage", "lcov.info");

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: "main" },
    threshold: { type: "string", default: "80" },
    "skip-run": { type: "boolean", default: false },
  },
});

const BASE_BRANCH = args.base;
const THRESHOLD = Number.parseFloat(args.threshold);
const SKIP_RUN = args["skip-run"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

/** Get the merge-base commit so we diff against the right point. */
function getMergeBase(base) {
  try {
    return git(`git merge-base ${base} HEAD`).trim();
  } catch {
    // Fall back to the base ref directly (e.g. first push of a new branch)
    return git(`git rev-parse ${base}`).trim();
  }
}

/**
 * Parse lcov.info into a Map<filePath, Map<line, hits>>.
 * Only lines with hits > 0 are considered "covered".
 */
function parseLcov(lcovPath) {
  const coverage = new Map();
  if (!existsSync(lcovPath)) {
    console.error(`Error: coverage file not found at ${lcovPath}`);
    console.error("Run `pnpm vitest run --coverage` first.");
    process.exit(1);
  }

  const content = readFileSync(lcovPath, "utf-8");
  let currentFile = null;
  let lineMap = null;

  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) {
      currentFile = line.slice(3).trim();
      lineMap = new Map();
    } else if (line.startsWith("DA:")) {
      const [lineNum, hits] = line.slice(3).split(",");
      if (lineMap && lineNum) {
        lineMap.set(Number.parseInt(lineNum, 10), Number.parseInt(hits, 10));
      }
    } else if (line === "end_of_record") {
      if (currentFile) {
        coverage.set(currentFile, lineMap);
      }
      currentFile = null;
      lineMap = null;
    }
  }

  return coverage;
}

/**
 * Get added/modified lines from git diff as Map<filePath, number[]>.
 * Uses --unified=0 so only changed lines appear (no context).
 */
function getDiffAddedLines(baseCommit) {
  const diff = git(
    `git diff --no-color --unified=0 ${baseCommit}...HEAD`,
  );

  const result = new Map();
  let currentFile = null;
  let addedLines = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      if (currentFile && addedLines) {
        result.set(currentFile, addedLines);
      }
      currentFile = line.slice(6);
      addedLines = [];
    } else if (line.startsWith("@@ ")) {
      // Hunk header: @@ -old_start,old_count +new_start,new_count @@
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      if (match && addedLines !== null) {
        const start = Number.parseInt(match[1], 10);
        const count = match[2] ? Number.parseInt(match[2], 10) : 1;
        for (let i = 0; i < count; i++) {
          addedLines.push(start + i);
        }
      }
    }
  }

  if (currentFile && addedLines) {
    result.set(currentFile, addedLines);
  }

  return result;
}

/** Compress a sorted array of line numbers into ranges: [1,2,3,5] → "1-3, 5" */
function formatRanges(lines) {
  const ranges = [];
  let start = lines[0];
  let end = lines[0];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === end + 1) {
      end = lines[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = lines[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Step 1: Run coverage if not skipped
  if (!SKIP_RUN) {
    console.log("Running vitest with coverage...");
    execSync("pnpm vitest run --coverage --no-file-parallelism --maxWorkers=1", {
      cwd: ROOT,
      stdio: "inherit",
    });
  }

  // Step 2: Parse coverage
  const coverage = parseLcov(LCOV_PATH);

  // Step 3: Get diff
  const baseCommit = getMergeBase(BASE_BRANCH);
  const diffLines = getDiffAddedLines(baseCommit);

  if (diffLines.size === 0) {
    console.log("No changed lines found in tracked source files.");
    process.exit(0);
  }

  // Step 4: Compute patch coverage
  let totalAdded = 0;
  let coveredAdded = 0;
  const uncoveredDetails = [];

  for (const [filePath, lines] of diffLines) {
    // Normalize path for matching against lcov (which uses forward slashes)
    const normalizedPath = filePath.replace(/\\/g, "/");

    // Only check files in the coverage include pattern
    if (
      !normalizedPath.startsWith("src/app/lib/") &&
      !normalizedPath.startsWith("src/app/components/")
    ) {
      continue;
    }

    // Skip files excluded from coverage
    if (
      normalizedPath === "src/app/lib/types.ts" ||
      normalizedPath === "src/app/lib/store.ts" ||
      normalizedPath === "src/app/lib/store/types.ts" ||
      normalizedPath === "src/app/lib/store/index.ts" ||
      normalizedPath === "src/app/lib/i18n.ts"
    ) {
      continue;
    }

    const fileCoverage = coverage.get(normalizedPath);
    if (!fileCoverage) {
      // File has no coverage data — skip (no executable lines tracked)
      continue;
    }

    for (const lineNum of lines) {
      // Only count lines that lcov tracks as executable (DA: entries).
      // Import statements, type definitions, and comments are not executable
      // and won't appear in lcov, so they shouldn't count toward patch coverage.
      if (!fileCoverage.has(lineNum)) continue;
      totalAdded++;
      const hits = fileCoverage.get(lineNum);
      if (hits > 0) {
        coveredAdded++;
      } else {
        uncoveredDetails.push({ file: normalizedPath, line: lineNum });
      }
    }
  }

  if (totalAdded === 0) {
    console.log("No changed lines in coverage-tracked source files.");
    process.exit(0);
  }

  const patchPct = (coveredAdded / totalAdded) * 100;
  const rounded = Math.round(patchPct * 10) / 10;

  console.log("");
  console.log(`Patch coverage: ${rounded}% (${coveredAdded}/${totalAdded} lines covered)`);
  console.log(`Threshold:      ${THRESHOLD}%`);

  if (rounded < THRESHOLD) {
    console.log("");
    console.log("Uncovered lines in diff:");
    // Group by file
    const byFile = new Map();
    for (const { file, line, lines } of uncoveredDetails) {
      if (!byFile.has(file)) byFile.set(file, []);
      if (lines) {
        byFile.get(file).push(...lines);
      } else if (line) {
        byFile.get(file).push(line);
      }
    }
    for (const [file, lineNums] of byFile) {
      const sorted = [...new Set(lineNums)].sort((a, b) => a - b);
      console.log(`  ${file}: ${formatRanges(sorted)}`);
    }
    console.log("");
    console.error(`FAIL: patch coverage ${rounded}% is below the ${THRESHOLD}% threshold.`);
    console.error("Add tests for the uncovered lines, or use `git push --no-verify` to bypass.");
    process.exit(1);
  }

  console.log("");
  console.log("PASS: patch coverage meets threshold.");
  process.exit(0);
}

main();
