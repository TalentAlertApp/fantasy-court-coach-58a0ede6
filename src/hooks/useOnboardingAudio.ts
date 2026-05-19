import { useCallback, useEffect, useRef, useState } from "react";
import bedUrl from "@/assets/court-show-bed.mp3";

const STORAGE_KEY = "courtshow.audio.enabled"; // share the same toggle as Court Show

function readPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "1";
}

/** Looping background bed for the onboarding flow. Stops on unmount. */
export function useOnboardingAudio(active: boolean) {
  const [enabled, setEnabled] = useState<boolean>(readPref);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!active || !enabled) return;

    const a = new Audio(bedUrl);
    a.loop = true;
    a.volume = 0.3;
    a.preload = "auto";
    audioRef.current = a;

    let cancelled = false;
    const tryPlay = () => { a.play().catch(() => {}); };
    const playPromise = a.play().catch(() => {});

    // Autoplay typically blocked — retry on first user interaction.
    const onInteract = () => { if (!cancelled) tryPlay(); };
    window.addEventListener("pointerdown", onInteract, { once: true });
    window.addEventListener("keydown", onInteract, { once: true });

    const onVisibility = () => {
      if (cancelled) return;
      if (document.hidden) { try { a.pause(); } catch {} }
      else { a.play().catch(() => {}); }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      document.removeEventListener("visibilitychange", onVisibility);
      Promise.resolve(playPromise).finally(() => {
        try { a.pause(); a.currentTime = 0; a.src = ""; a.load(); } catch {}
      });
      audioRef.current = null;
    };
  }, [active, enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  return { enabled, toggle };
}
