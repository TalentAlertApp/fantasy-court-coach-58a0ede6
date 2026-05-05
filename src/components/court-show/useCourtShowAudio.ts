import { useCallback, useEffect, useRef, useState } from "react";
import bedUrl from "@/assets/court-show-bed.mp3";

const STORAGE_KEY = "courtshow.audio.enabled";

function readPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "1";
}

/**
 * Procedural ambient audio bed for the Daily Court Show.
 * Uses Web Audio API only — no external assets, no licensed samples.
 */
export function useCourtShowAudio(active: boolean) {
  const [enabled, setEnabled] = useState<boolean>(readPref);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const a = new Audio(bedUrl);
      a.loop = true;
      a.volume = 0.35;
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  const startBed = useCallback(() => {
    const a = ensureAudio();
    if (!a) return;
    a.currentTime = a.currentTime || 0;
    a.play().catch(() => {});
  }, [ensureAudio]);

  const stopBed = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch {}
  }, []);

  // Lifecycle: start/stop based on active+enabled
  useEffect(() => {
    if (active && enabled) startBed();
    else stopBed();
    return () => stopBed();
  }, [active, enabled, startBed, stopBed]);

  useEffect(() => {
    return () => {
      stopBed();
      audioRef.current = null;
    };
  }, [stopBed]);

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