import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const iconsDir = path.join(projectRoot, "src-tauri", "icons");
const iconComposerDir = path.join(iconsDir, "OpenLoop.icon");
const stagingDir = path.join(iconsDir, ".liquid-glass-staging");

if (process.platform !== "darwin") {
  console.log("Skipping macOS Liquid Glass icon compile on non-darwin host");
  process.exit(0);
}

// OpenLoop.icon already carries its composed layers and background fill, so
// there is no foreground layer to extract — compile the Icon Composer project
// straight through actool.
await rm(stagingDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });

try {
  execFileSync(
    "xcrun",
    [
      "actool",
      iconComposerDir,
      "--compile",
      stagingDir,
      "--app-icon",
      "OpenLoop",
      "--platform",
      "macosx",
      "--minimum-deployment-target",
      "11.0",
      "--target-device",
      "mac",
      "--output-partial-info-plist",
      path.join(stagingDir, "partial.plist"),
      "--output-format",
      "human-readable-text",
    ],
    { stdio: "inherit" },
  );
} catch (error) {
  // actool is only present with Xcode. Warn and exit 0 so hosts without it
  // (bare Command Line Tools, CI without full Xcode) do not fail the build.
  await rm(stagingDir, { recursive: true, force: true });
  console.warn(`actool is unavailable — skipping Liquid Glass icon compile (${error.message})`);
  process.exit(0);
}

const assetsCar = path.join(stagingDir, "Assets.car");
const icns = path.join(stagingDir, "OpenLoop.icns");

// actool may not produce Assets.car if the Icon Composer input is incomplete
// or the runner's Xcode version lacks Liquid Glass support. Copy what exists.
const compiled = [];
try {
  await cp(assetsCar, path.join(iconsDir, "Assets.car"));
  compiled.push("Assets.car");
} catch {
  console.warn("actool did not produce Assets.car — skipping");
}
try {
  await cp(icns, path.join(iconsDir, "OpenLoop.icns"));
  compiled.push("OpenLoop.icns");
} catch {
  console.warn("actool did not produce OpenLoop.icns — skipping");
}

await rm(stagingDir, { recursive: true, force: true });

if (compiled.length > 0) {
  console.log(`Compiled macOS Liquid Glass assets: ${compiled.join(", ")}`);
} else {
  console.warn("No Liquid Glass assets were produced — continuing without them");
}
