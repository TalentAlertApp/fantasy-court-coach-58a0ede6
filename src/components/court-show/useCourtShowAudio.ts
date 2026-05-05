import { useCallback, useEffect, useRef, useState } from "react";

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
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<{ stop: () => void } | null>(null);

  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  const startBed = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx || nodesRef.current) return;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterRef.current = master;

    // Soft low-pass pad
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 650;
    lp.Q.value = 0.4;
    lp.connect(master);

    const freqs = [110, 164.81, 220]; // A2, E3, A3
    const oscs: OscillatorNode[] = freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.detune.value = i === 1 ? 6 : i === 2 ? -4 : 0;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.18 : 0.28;
      o.connect(g).connect(lp);
      o.start();
      return o;
    });

    // Slow LFO swell on master
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start();

    // Fade-in
    const t = ctx.currentTime;
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.05, t + 1.2);

    nodesRef.current = {
      stop: () => {
        try {
          const now = ctx.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(0, now + 0.3);
          setTimeout(() => {
            oscs.forEach((o) => { try { o.stop(); o.disconnect(); } catch {} });
            try { lfo.stop(); lfo.disconnect(); } catch {}
            try { lp.disconnect(); master.disconnect(); } catch {}
          }, 350);
        } catch {}
      },
    };
  }, [ensureCtx]);

  const stopBed = useCallback(() => {
    nodesRef.current?.stop();
    nodesRef.current = null;
    masterRef.current = null;
  }, []);

  // Lifecycle: start/stop based on active+enabled
  useEffect(() => {
    if (active && enabled) startBed();
    else stopBed();
    return () => stopBed();
  }, [active, enabled, startBed, stopBed]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      stopBed();
      try { ctxRef.current?.close(); } catch {}
      ctxRef.current = null;
    };
  }, [stopBed]);

  const onSlideChange = useCallback(() => {
    if (!enabled || !active) return;
    const ctx = ensureCtx();
    if (!ctx || !masterRef.current) return;
    // Soft shimmer cue
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880; // A5
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(masterRef.current);
    o.start(t);
    o.stop(t + 0.4);
  }, [active, enabled, ensureCtx]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  return { enabled, toggle, onSlideChange };
}