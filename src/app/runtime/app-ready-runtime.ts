import { useEffect, useRef } from "react";
import * as api from "@/app/lib/api";

/**
 * Backstop for the reveal request. The main window starts hidden, and a hidden
 * (occluded) WebView can have its animation frames suspended — so a rAF-only
 * reveal might never run, leaving the app running with no window at all. The
 * timer guarantees the request goes out; rAF still wins whenever frames are
 * actually being produced.
 */
const WINDOW_REVEAL_FALLBACK_MS = 120;

/**
 * Absolute ceiling on how long the window may stay hidden. Hydration failures
 * flip `hydrated` and reveal normally, but a hung IPC call would otherwise
 * leave the app running with no window at all — a visible skeleton is strictly
 * more debuggable than an invisible process.
 */
const WINDOW_REVEAL_HARD_LIMIT_MS = 10_000;

export function useAppReadyRuntime(ready: boolean) {
  const revealedRef = useRef(false);

  useEffect(() => {
    const hardLimitId = setTimeout(() => {
      if (!revealedRef.current) {
        revealedRef.current = true;
        void api.windowReady();
      }
    }, WINDOW_REVEAL_HARD_LIMIT_MS);
    return () => clearTimeout(hardLimitId);
  }, []);

  useEffect(() => {
    if (!ready || revealedRef.current) {
      return;
    }

    const requestReveal = () => {
      if (revealedRef.current) {
        return;
      }
      revealedRef.current = true;
      void api.windowReady();
    };

    const frameId = requestAnimationFrame(requestReveal);
    const timeoutId = setTimeout(requestReveal, WINDOW_REVEAL_FALLBACK_MS);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [ready]);
}
