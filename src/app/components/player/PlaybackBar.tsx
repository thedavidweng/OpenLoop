import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
import {
  Copy,
  FolderOutput,
  Music4,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import * as api from "@/app/lib/api";
import { Tooltip } from "@/app/components/overlay/Tooltip";
import { useGenerationStore } from "@/app/lib/store";
import {
  getPlaybackBarCenterMinWidth,
  getPlaybackBarDensity,
  getPlaybackBarLayoutTokens,
  PLAYBACK_BAR_LEFT_MIN_WIDTH,
  PLAYBACK_BAR_METADATA_COLLAPSE_WIDTH,
  PLAYBACK_BAR_SEEK_MIN_WIDTH_CLASS,
  PLAYBACK_BAR_SEEK_RAIL_MIN_WIDTH_CLASS,
  PLAYBACK_BAR_TIME_LABEL_WIDTH_CLASS,
  shouldCollapsePlaybackBarMetadata,
  type PlaybackBarDensity,
} from "@/app/components/player/playback-bar-layout";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const VOLUME_STORAGE_KEY = "openloop-volume";
const SPEED_STORAGE_KEY = "openloop-speed";

function audioPayloadToBytes(payload: ArrayBuffer | number[]) {
  return payload instanceof ArrayBuffer
    ? new Uint8Array(payload)
    : Uint8Array.from(payload);
}

function audioMimeType(format: string) {
  switch (format) {
    case "flac":
      return "audio/flac";
    case "ogg":
      return "audio/ogg";
    case "wav":
    default:
      return "audio/wav";
  }
}

function loadPersistedVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (stored) {
      const v = parseFloat(stored);
      if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
    }
  } catch { /* ignore */ }
  return 1;
}

function loadPersistedSpeed(): number {
  try {
    const stored = localStorage.getItem(SPEED_STORAGE_KEY);
    if (stored) {
      const v = parseFloat(stored);
      if (Number.isFinite(v) && SPEED_OPTIONS.includes(v as (typeof SPEED_OPTIONS)[number])) return v;
    }
  } catch { /* ignore */ }
  return 1;
}

export function PlaybackBar() {
  const { t } = useTranslation();
  const currentGeneration = useGenerationStore((state) => state.currentGeneration);
  const deleteGenerationRecord = useGenerationStore((state) => state.deleteGenerationRecord);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(loadPersistedVolume);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [speed, setSpeed] = useState(loadPersistedSpeed);
  const [measuredWidth, setMeasuredWidth] = useState(1280);
  const [measuredDensity, setMeasuredDensity] = useState<PlaybackBarDensity>("relaxed");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist volume
  useEffect(() => {
    try { localStorage.setItem(VOLUME_STORAGE_KEY, String(volume)); } catch { /* ignore */ }
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Persist speed
  useEffect(() => {
    try { localStorage.setItem(SPEED_STORAGE_KEY, String(speed)); } catch { /* ignore */ }
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Apply volume and speed when audio source changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = speed;
    }
  }, [audioSrc, volume, speed]);

  useEffect(() => {
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setPlaybackStatus(null);
    setAudioSrc(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }

    if (!currentGeneration?.id || !currentGeneration.outputPath) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void api
      .readGenerationAudio(currentGeneration.id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const bytes = audioPayloadToBytes(payload);
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: audioMimeType(currentGeneration.audioFormat) }),
        );
        setAudioSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setPlaybackStatus(t("player.missingFile"));
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    currentGeneration?.audioFormat,
    currentGeneration?.id,
    currentGeneration?.outputPath,
    t,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const width = Math.ceil(container.getBoundingClientRect().width);
      setMeasuredWidth((current) => (current === width ? current : width));
      const nextDensity = getPlaybackBarDensity(width);
      setMeasuredDensity((current) => (current === nextDensity ? current : nextDensity));
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const formatTime = (seconds: number) => {
    const safe = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
    const minutes = Math.floor(safe / 60);
    const remainder = safe % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };

  const progressPercent = useMemo(() => {
    if (!duration || !Number.isFinite(duration)) {
      return 0;
    }
    return Math.max(0, Math.min(100, (position / duration) * 100));
  }, [duration, position]);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume || 1);
    }
  }, [volume, previousVolume]);

  const cycleSpeed = useCallback(() => {
    setSpeed((current) => {
      const idx = SPEED_OPTIONS.indexOf(current as (typeof SPEED_OPTIONS)[number]);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  const density = measuredDensity;
  const layoutTokens = getPlaybackBarLayoutTokens(density);
  const centerMinWidth = getPlaybackBarCenterMinWidth(density);
  const shouldHideNowPlaying = measuredWidth >= PLAYBACK_BAR_METADATA_COLLAPSE_WIDTH
    ? false
    : shouldCollapsePlaybackBarMetadata(measuredWidth);
  const zoneStyle: CSSProperties = {
    gridTemplateColumns: shouldHideNowPlaying
      ? `minmax(${centerMinWidth}px, 1fr) max-content`
      : `minmax(${PLAYBACK_BAR_LEFT_MIN_WIDTH}px, ${layoutTokens.leftMaxWidth}px) minmax(${centerMinWidth}px, 1fr) max-content`,
    columnGap: layoutTokens.zoneGap,
  };
  const centerZoneStyle: CSSProperties = {
    gridTemplateColumns: `auto minmax(0, 1fr)`,
    columnGap: layoutTokens.zoneGap,
  };

  return (
    <div
      ref={containerRef}
      className={`app-panel-surface z-10 mx-3 mb-3 mt-2 flex shrink-0 flex-col justify-center rounded-[24px] border border-[var(--playback-bar-surface-border)] bg-[var(--playback-bar-surface-bg)] shadow-[var(--chrome-panel-shadow)] ${layoutTokens.barHeightClass}`}
      style={{ paddingInline: layoutTokens.outerPadding }}
    >
      <audio
        ref={audioRef}
        src={audioSrc ?? undefined}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setPlaybackStatus(t("player.missingFile"));
        }}
        className="hidden"
      />

      <div className="grid w-full min-w-0 items-center" style={zoneStyle}>
        {!shouldHideNowPlaying && <div className="min-w-0" style={{ maxWidth: layoutTokens.leftMaxWidth }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text-dim)]">
              <Music4 size={18} />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <span className="block truncate text-[14px] font-semibold text-white">
                {currentGeneration?.prompt || currentGeneration?.lyrics || "OpenLoop"}
              </span>
              <span className="block truncate text-[12px] text-[var(--color-text-dim)]">
                {currentGeneration
                  ? `${currentGeneration.audioFormat.toUpperCase()} · ${Math.round(currentGeneration.durationSeconds)}s`
                  : t("player.noGeneration")}
              </span>
            </div>
          </div>
        </div>}

        <div className="grid min-w-0 items-center" style={centerZoneStyle}>
          <div className={`flex items-center text-[var(--color-control-primary)] ${density === "relaxed" ? "gap-4" : density === "compact" ? "gap-2.5" : "gap-2"}`}>
            <Tooltip label={t("player.back10")}>
            <button
              type="button"
              className="motion-icon-button rounded-full p-2 opacity-80 hover:bg-[var(--color-ghost-hover)] hover:text-white hover:opacity-100 disabled:opacity-30"
              disabled={!audioSrc}
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                }
              }}
            >
              <SkipBack size={20} fill="currentColor" />
            </button>
            </Tooltip>
            <Tooltip label={isPlaying ? t("player.pause") : t("player.play")}>
            <button
              type="button"
              className="motion-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-control-primary)] text-[var(--color-control-primary-foreground)] shadow-[0_10px_24px_rgba(0,0,0,0.22)] hover:bg-[color-mix(in_srgb,var(--color-control-primary)_90%,white)] disabled:opacity-30"
              disabled={!audioSrc}
              onClick={() => {
                if (!audioRef.current) return;
                if (audioRef.current.paused) {
                  void audioRef.current.play();
                } else {
                  audioRef.current.pause();
                }
              }}
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            </Tooltip>
            <Tooltip label={t("player.forward10")}>
            <button
              type="button"
              className="motion-icon-button rounded-full p-2 opacity-80 hover:bg-[var(--color-ghost-hover)] hover:text-white hover:opacity-100 disabled:opacity-30"
              disabled={!audioSrc}
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.min(duration || 0, audioRef.current.currentTime + 10);
                }
              }}
            >
              <SkipForward size={20} fill="currentColor" />
            </button>
            </Tooltip>
          </div>

          <div className={`flex ${PLAYBACK_BAR_SEEK_MIN_WIDTH_CLASS} flex-1 items-center gap-3 font-[tabular-nums] text-[11px] text-[var(--color-text-dim)]`}>
            <span className={`${PLAYBACK_BAR_TIME_LABEL_WIDTH_CLASS} shrink-0 whitespace-nowrap text-center`}>{formatTime(position)}</span>
            <div
              className={`group relative h-1.5 ${PLAYBACK_BAR_SEEK_RAIL_MIN_WIDTH_CLASS} flex-1 cursor-pointer rounded-full bg-[var(--color-border)]`}
              onClick={(event) => {
                if (!audioRef.current || !duration) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
                audioRef.current.currentTime = percent * duration;
              }}
            >
              <div className="relative h-full rounded-full bg-[var(--color-text-dim)] group-hover:bg-white" style={{ width: `${progressPercent}%` }}>
                <div className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100" />
              </div>
            </div>
            <span className={`${PLAYBACK_BAR_TIME_LABEL_WIDTH_CLASS} shrink-0 whitespace-nowrap text-center`}>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end" style={{ gap: layoutTokens.rightZoneGap }}>
          {/* Volume control */}
          <Tooltip label={volume === 0 ? t("player.unmute") : t("player.mute")}>
            <button
              type="button"
              className="motion-icon-button rounded-full p-2 text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white disabled:opacity-30"
              disabled={!audioSrc}
              onClick={toggleMute}
            >
              {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </Tooltip>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="native-slider w-16"
            disabled={!audioSrc}
          />

          {/* Speed control */}
          <Tooltip label={t("player.speed")}>
            <button
              type="button"
              className="motion-icon-button rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white disabled:opacity-30"
              disabled={!audioSrc}
              onClick={cycleSpeed}
            >
              {speed}x
            </button>
          </Tooltip>

          <Tooltip label={t("player.reveal")}>
          <button
            type="button"
            className="motion-icon-button relative flex shrink-0 items-center rounded-[14px] p-2.5 text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white disabled:opacity-30"
            disabled={!currentGeneration?.outputPath}
            onClick={() => {
              if (currentGeneration?.outputPath) {
                void api.revealInFinder(currentGeneration.outputPath);
              }
            }}
          >
            <FolderOutput size={16} />
          </button>
          </Tooltip>
          <Tooltip label={t("player.exportCopy")}>
          <button
            type="button"
            className="motion-icon-button relative flex shrink-0 items-center rounded-[14px] p-2.5 text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white disabled:opacity-30"
            disabled={!currentGeneration?.outputPath}
            onClick={() => {
              const destination = window.prompt(
                t("player.copyPrompt"),
                currentGeneration?.outputPath ?? "",
              );

              if (!destination || !currentGeneration?.outputPath) {
                return;
              }

              void api.copyAudioTo(currentGeneration.outputPath, destination).then((result) => {
                setCopyStatus(t("player.copied", { path: result }));
              });
            }}
            >
            <Copy size={16} />
          </button>
          </Tooltip>
          <Tooltip label={t("player.deleteFileAndRecord")}>
          <button
            type="button"
            className="motion-icon-button relative flex shrink-0 items-center rounded-[14px] p-2.5 text-[var(--color-text-dim)] hover:bg-[var(--color-ghost-hover)] hover:text-white disabled:opacity-30"
            disabled={!currentGeneration?.outputPath}
            onClick={() => {
              const outputPath = currentGeneration?.outputPath;
              if (!outputPath || !currentGeneration) return;
              void (async () => {
                await api.deleteGenerationFile(outputPath);
                await deleteGenerationRecord(currentGeneration.id);
              })();
            }}
          >
            <Trash2 size={16} />
          </button>
          </Tooltip>
        </div>
      </div>

      {playbackStatus || copyStatus ? (
        <div className="mt-2 text-right text-[11px] text-[var(--color-text-dim)]">{playbackStatus ?? copyStatus}</div>
      ) : null}
    </div>
  );
}
