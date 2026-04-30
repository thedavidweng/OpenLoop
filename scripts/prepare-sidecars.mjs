import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { chmod, copyFile, mkdtemp, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { get } from "node:https";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync } from "node:child_process";

const UV_VERSION = process.env.OPENLOOP_UV_VERSION ?? "0.11.7";
const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const BINARIES_DIR = join(ROOT_DIR, "src-tauri", "binaries");
const CACHE_DIR = join(BINARIES_DIR, ".cache");

const TARGETS = {
  "aarch64-apple-darwin": {
    archive: "uv-aarch64-apple-darwin.tar.gz",
    binary: "uv",
  },
  "x86_64-apple-darwin": {
    archive: "uv-x86_64-apple-darwin.tar.gz",
    binary: "uv",
  },
  "aarch64-unknown-linux-gnu": {
    archive: "uv-aarch64-unknown-linux-gnu.tar.gz",
    binary: "uv",
  },
  "x86_64-unknown-linux-gnu": {
    archive: "uv-x86_64-unknown-linux-gnu.tar.gz",
    binary: "uv",
  },
};

const targetTriple = process.env.TAURI_TARGET_TRIPLE ?? rustHostTriple();
const target = TARGETS[targetTriple];

if (!target) {
  throw new Error(`Unsupported OpenLoop sidecar target: ${targetTriple}`);
}

mkdirSync(CACHE_DIR, { recursive: true });

const archivePath = join(CACHE_DIR, target.archive);
const checksumPath = `${archivePath}.sha256`;
const sidecarPath = join(BINARIES_DIR, `uv-${targetTriple}`);

if (!existsSync(archivePath)) {
  const url = `https://releases.astral.sh/github/uv/releases/download/${UV_VERSION}/${target.archive}`;
  await download(url, archivePath);
}
if (!existsSync(checksumPath)) {
  const url = `https://releases.astral.sh/github/uv/releases/download/${UV_VERSION}/${target.archive}.sha256`;
  await download(url, checksumPath);
}

await verifySha256(archivePath, checksumPath);

const extractDir = await mkdtemp(join(tmpdir(), "openloop-uv-"));
try {
  await exec("tar", ["-xzf", archivePath, "-C", extractDir]);
  const extractedUv = findFile(extractDir, target.binary);
  await copyFile(extractedUv, sidecarPath);
  await chmod(sidecarPath, 0o755);
  console.log(`Prepared ${basename(sidecarPath)} from uv ${UV_VERSION}`);
} finally {
  rmSync(extractDir, { recursive: true, force: true });
}

function rustHostTriple() {
  const output = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const host = output
    .split("\n")
    .find((line) => line.startsWith("host: "))
    ?.slice("host: ".length)
    .trim();
  if (!host) {
    throw new Error("Could not detect Rust host triple from `rustc -vV`.");
  }
  return host;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        download(response.headers.location, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(
          new Error(`Download failed: ${url} returned ${response.statusCode}`),
        );
        return;
      }

      const file = createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", reject);
    });
    request.on("error", reject);
  });
}

function exec(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function verifySha256(archivePath, checksumPath) {
  const [archive, checksum] = await Promise.all([
    readFile(archivePath),
    readFile(checksumPath, "utf8"),
  ]);
  const expected = checksum.trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(archive).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${basename(archivePath)}: expected ${expected}, got ${actual}`,
    );
  }
}

function findFile(directory, filename) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isFile() && entry === filename) {
      return path;
    }
    if (stats.isDirectory()) {
      const found = findFile(path, filename);
      if (found) {
        return found;
      }
    }
  }
  throw new Error(`Could not find ${filename} inside extracted archive.`);
}
