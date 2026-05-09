import { useCallback } from "react";
import swooshUrl from "@/assets/audio/swoosh.wav";
import lineupUrl from "@/assets/audio/lineup.wav";
import buzzerUrl from "@/assets/audio/buzzer.wav";

export type SfxKind = "swoosh" | "lineup" | "buzzer";

const URLS: Record<SfxKind, string> = {
  swoosh: swooshUrl,
  lineup: lineupUrl,
  buzzer: buzzerUrl,
};

const MUTE_KEY = "sfx.muted";

function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

// Pre-warm cache (lazy)
const cache: Partial<Record<SfxKind, HTMLAudioElement>> = {};
function get(kind: SfxKind): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!cache[kind]) {
    const a = new Audio(URLS[kind]);
    a.preload = "auto";
    a.volume = 0.55;
    cache[kind] = a;
  }
  return cache[kind]!;
}

export function playSfx(kind: SfxKind) {
  if (isMuted()) return;
  const base = get(kind);
  if (!base) return;
  try {
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.volume = 0.55;
    void node.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function useSfx() {
  const play = useCallback((kind: SfxKind) => playSfx(kind), []);
  return { play };
}