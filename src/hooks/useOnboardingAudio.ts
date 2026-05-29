import { useCallback, useEffect, useState } from "react";
import bedUrl from "@/assets/court-show-bed.mp3";

const STORAGE_KEY = "courtshow.audio.enabled"; // share the same toggle as Court Show
// Grace window after the last onboarding screen unmounts before we actually
// stop the bed. Long enough to bridge a route change (e.g. /welcome →
// /welcome/pick-team → /leagues/create) so the next screen's hook can cancel
// the pending stop and the music plays *continuously* across the whole flow.
const STOP_GRACE_MS = 800;

function readPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "1";
}

// ---------------------------------------------------------------------------
// Module-level singleton. The bed lives outside React so it survives route
// changes and component remounts — navigating between onboarding screens no
// longer tears down + recreates the <audio>, which is what caused restarts.
// ---------------------------------------------------------------------------
let sharedAudio: HTMLAudioElement | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let activeMounts = 0;
let globalListenersBound = false;

function tryPlay() {
  if (!sharedAudio) return;
  sharedAudio.play().catch(() => {});
}

function bindGlobalListeners() {
  if (globalListenersBound || typeof window === "undefined") return;
  globalListenersBound = true;
  // Autoplay is often blocked until a user gesture — retry on interaction.
  const onInteract = () => { if (readPref()) tryPlay(); };
  window.addEventListener("pointerdown", onInteract);
  window.addEventListener("keydown", onInteract);
  document.addEventListener("visibilitychange", () => {
    if (!sharedAudio) return;
    if (document.hidden) { try { sharedAudio.pause(); } catch {} }
    else if (readPref()) tryPlay();
  });
}

function ensurePlaying() {
  if (typeof window === "undefined") return;
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  if (!sharedAudio) {
    const a = new Audio(bedUrl);
    a.loop = true;
    a.volume = 0.3;
    a.preload = "auto";
    sharedAudio = a;
    bindGlobalListeners();
  }
  tryPlay();
}

function teardown() {
  const a = sharedAudio;
  sharedAudio = null;
  if (a) {
    try { a.pause(); a.currentTime = 0; a.src = ""; a.load(); } catch {}
  }
}

function scheduleStop() {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    stopTimer = null;
    if (activeMounts <= 0) teardown();
  }, STOP_GRACE_MS);
}

/**
 * Looping background bed for the onboarding flow. Plays continuously across
 * every onboarding screen (and the routes that compose the flow) and only
 * stops once the user leaves the flow entirely (no screen using this hook
 * remains mounted past the grace window).
 */
export function useOnboardingAudio(active: boolean) {
  const [enabled, setEnabled] = useState<boolean>(readPref);

  // Cross-screen / cross-tab persistence: react to other components toggling
  // the same storage key (e.g. Welcome Back ↔ Onboarding share the bed).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setEnabled(e.newValue === null ? true : e.newValue === "1");
    };
    const onCustom = () => setEnabled(readPref());
    window.addEventListener("storage", onStorage);
    window.addEventListener("courtshow-audio-pref", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("courtshow-audio-pref", onCustom as EventListener);
    };
  }, []);

  // Track how many onboarding screens are mounted. While >=1 is mounted the bed
  // stays alive; the grace window bridges the gap during route transitions.
  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    activeMounts += 1;
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
    return () => {
      activeMounts = Math.max(0, activeMounts - 1);
      if (activeMounts <= 0) scheduleStop();
    };
  }, [active]);

  // Drive play/pause from the enabled preference without restarting the bed.
  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    if (enabled) ensurePlaying();
    else if (sharedAudio) { try { sharedAudio.pause(); } catch {} }
  }, [active, enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      // Notify same-tab listeners (storage event only fires cross-tab).
      try { window.dispatchEvent(new Event("courtshow-audio-pref")); } catch {}
      return next;
    });
  }, []);

  return { enabled, toggle };
}
