import { useCallback, useEffect, useRef, useState } from "react";
import bedUrl from "@/assets/court-show-bed.mp3";

const STORAGE_KEY = "courtshow.audio.enabled";

function readPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "1";
}

/**
 * Looping ambient audio bed for the Daily Court Show.
 * Properly tears down the <audio> element + listeners whenever
 * the modal closes (active=false) or the component unmounts.
 */
export function useCourtShowAudio(active: boolean) {
  const [enabled, setEnabled] = useState<boolean>(readPref);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!active || !enabled) return;

    const a = new Audio(bedUrl);
    a.loop = true;
    a.volume = 0.35;
    a.preload = "auto";

    const noop = () => {};
    a.addEventListener("error", noop);
    a.addEventListener("ended", noop);

    let cancelled = false;
    const playPromise = a.play().catch(() => {});

    const onVisibility = () => {
      if (cancelled) return;
      if (document.hidden) {
        try { a.pause(); } catch {}
      } else {
        a.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      a.removeEventListener("error", noop);
      a.removeEventListener("ended", noop);
      // Wait for any in-flight play() to settle before pausing,
      // so we don't trigger an AbortError in the console.
      Promise.resolve(playPromise).finally(() => {
        try {
          a.pause();
          a.currentTime = 0;
          a.src = "";
          a.load();
        } catch {}
      });
    };
  }, [active, enabled]);

  const onSlideChange = useCallback(() => {
    // No-op: bed loops continuously; no per-slide cue.
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  return { enabled, toggle, onSlideChange };
}