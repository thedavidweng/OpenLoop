# Local audio exports

OpenLoop uses one bundled, source-built FFmpeg executable for encoding and
metadata. No Homebrew/system FFmpeg, online conversion service, inference
runtime, or format fallback is involved. Existing AVFoundation audition stays
unchanged. The sidecar has only the `file` protocol and WAV/MP3/FLAC/Ogg inputs;
network protocols and dependency autodetection are disabled at build time.

## Export contract

The existing Take and History Export actions offer original-file copy or a
conversion preset. History's **Export Selected** applies one preset to all
selected Takes, using `{source-stem}-{generation-id}.{format}` in the chosen
folder. It refuses collisions. A batch stops on the first failure and retains
already completed exports; the notice records the completed count.

| Preset | Output |
| --- | --- |
| MP3 | LAME, 192 kb/s, source channel count/sample rate where supported |
| Podcast quality | LAME MP3, mono, 44.1 kHz, 96 kb/s |
| Lossless archive | FLAC integer PCM |
| Ogg Vorbis | Vorbis quality 5 |

FLAC preserves supported integer PCM samples (tested with stereo PCM16).
Floating-point WAV and integer precision above the encoder's supported FLAC
precision are quantized to integer PCM; FLAC is **not** bit-preserving storage
for float WAV. Use **Original file** to preserve any source byte-for-byte.
MP3 and Vorbis are lossy. Outputs do not become new Generation Records.

Generated conversions include these tags (ID3 in MP3; comments in FLAC/Ogg):

| Tag | Generation Record mapping |
| --- | --- |
| title | String `metadata.title`, otherwise first six words of request prompt |
| artist | String `metadata.artist`, otherwise `OpenLoop` |
| genre | String `metadata.genre`, otherwise full request prompt |
| comment | Full request prompt |
| lyrics | Full request lyrics |

Standalone CLI files get their filename stem as title, not invented generation
metadata. Input tags are not copied implicitly. Prompt and lyrics are included
in exported files: review them before sharing. Original-file export does not
rewrite tags. Paths, history and original Artifacts remain unchanged.

Conversion writes a sibling staging directory, checks encoder success, and only
then publishes. The single-file save panel can explicitly confirm replacement;
CLI and batch export refuse existing files. Core always rejects replacing a
stored Artifact. Errors/cancellation remove staging and preserve existing
destinations. See [CLI contract](specs/native-cli.md#local-audio-conversion).

## Pinned distribution

`scripts/prepare-audio-encoder.py` downloads unchanged official release archives
and verifies these SHA-256 pins **before** extracting or compiling:

| Source | License | SHA-256 |
| --- | --- | --- |
| [FFmpeg 8.0.3](https://ffmpeg.org/releases/ffmpeg-8.0.3.tar.xz) | LGPL-2.1-or-later | `6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818` |
| [LAME 3.100](https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz) | LGPL-2.0-or-later | `ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e` |
| [libogg 1.3.6](https://downloads.xiph.org/releases/ogg/libogg-1.3.6.tar.xz) | BSD-3-Clause | `5c8253428e181840cd20d41f3ca16557a9cc04bad4a3d04cce84808677fa1061` |
| [libvorbis 1.3.7](https://downloads.xiph.org/releases/vorbis/libvorbis-1.3.7.tar.xz) | BSD-3-Clause | `b33cc4934322bcbf6efcbacf49e3ca01aadbea4114ec9589d1b1e9d20f72954b` |

No GPL/nonfree FFmpeg features are enabled. LAME/Ogg/Vorbis are statically
linked into the separate sidecar; Swift does not link FFmpeg. Follow upstream
[FFmpeg licensing guidance](https://ffmpeg.org/legal.html) and the bundled
license texts when redistributing. All four complete source archives, license
texts and the build recipe accompany **each app**, not just a source offer.
The user can rebuild/replace the sidecar under those licenses; modification
invalidates the app's signature, requiring local re-signing.

`Contents/MacOS/ffmpeg` is signed as a nested tool before the app is sealed.
`Contents/Resources/AudioEncoder/` holds licenses, `manifest.json` and `Source/`.
Packaging verifies the pre-sign binary hash and every source hash. The manifest
records the pre-sign hash/bytes, compiler, configure flags and dynamic libraries;
signing changes binary bytes, so that hash is not the installed signed hash.
Only Apple system dylibs/frameworks are permitted by the build check.

The initial arm64 build is 3,025,656 bytes before package signing; the source
archives total 14,575,533 bytes. Licenses/recipe/manifest add roughly 70 KB.
These are component sizes, not a DMG-size claim; app signing, compression,
compiler and future updates change the result. Sources intentionally dominate
the incremental footprint to keep LGPL source delivery self-contained.

## Rebuilding and maintenance

Build requirements: Apple Silicon macOS, Xcode command-line tools, Python 3,
`make`, and `pkg-config`. No binary encoder dependency is downloaded.

```sh
python3 scripts/prepare-audio-encoder.py
# Or rebuild offline from a distributed app's complete sources:
python3 /path/to/OpenLoop.app/Contents/Resources/AudioEncoder/Source/prepare-audio-encoder.py \
  --sources /path/to/OpenLoop.app/Contents/Resources/AudioEncoder/Source \
  --output /tmp/rebuilt-audio-encoder
```

The script holds `/tmp/openloop-heavy-build.lock` throughout compilation and
uses `make -j2`. Source builds are reproducible from pins and flags but are not
claimed bit-identical across SDK/compiler versions. Generated files stay in
ignored `native/binaries/`; packaging consumes them explicitly. Developer GUI
runs may set `OPENLOOP_AUDIO_ENCODER` to the prepared executable; CLI uses
`--encoder PATH`. Neither setting is an automatic system lookup.

Maintain the 8.0 maintenance-line FFmpeg pin deliberately: check upstream
[releases](https://ffmpeg.org/download.html) and
[security notices](https://ffmpeg.org/security.html) before releases. An upgrade
must update source URL/hash together, inspect license/configuration changes,
rebuild, inspect system-only linkage/bytes and run the real conversion tests.
Do not substitute a mutable prebuilt download. The focused checks are
`native/scripts/test-audio-encoder.py`, Swift Core/App export tests and
`native/scripts/test-audio-exports.py --bundle PATH` against the signed app.
The last check runs the packaged CLI through a symlink with system-only PATH,
without network or models, and verifies signatures, sources, codecs, Unicode
tags, FLAC PCM16 roundtrip, podcast quality and failure/no-overwrite behavior.
Developer ID/notarization and real save-panel/VoiceOver interaction are separate
release/manual gates, not implied by these checks.
