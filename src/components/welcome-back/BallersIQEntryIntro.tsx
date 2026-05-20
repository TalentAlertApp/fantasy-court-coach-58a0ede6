import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RotatingBallersIQBadge from "@/components/court-show/RotatingBallersIQBadge";
import { useLeague } from "@/contexts/LeagueContext";

const AUDIO_PREF_KEY = "courtshow.audio.enabled";
const DURATION_MS = 5000;

function audioEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(AUDIO_PREF_KEY);
  return v === null ? true : v === "1";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Premium full-screen intro shown right after "Enter Court".
 * Broken-glass shatter-in transition, theme-aware background,
 * rotating Ballers.IQ card (20% bigger) + league-matched VO.
 * Auto-dismisses after 5s or on any user interaction.
 */
export default function BallersIQEntryIntro({ onDone }: { onDone: () => void }) {
  const { isWnba } = useLeague();
  const [reduced] = useState<boolean>(() => prefersReducedMotion());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    try {
      const a = audioRef.current;
      if (a) { a.pause(); a.currentTime = 0; }
    } catch {}
    onDone();
  };

  // VO playback
  useEffect(() => {
    if (!audioEnabled()) return;
    const src = isWnba
      ? "/audio/HoopsFantasy_BallersIQ-FEMALE.mp3"
      : "/audio/HoopsFantasy_BallersIQ-MALE.mp3";
    const a = new Audio(src);
    a.volume = 0.9;
    a.preload = "auto";
    audioRef.current = a;
    a.play().catch(() => {});
    return () => {
      try { a.pause(); a.currentTime = 0; a.src = ""; a.load(); } catch {}
      audioRef.current = null;
    };
  }, [isWnba]);

  // Auto-dismiss timer + skip listeners
  useEffect(() => {
    const t = window.setTimeout(finish, DURATION_MS);
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); finish(); };
    window.addEventListener("keydown", onKey, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Procedurally generated angular shards covering a 100x100 viewBox.
  const shards = useMemo(() => {
    // Hand-tuned, asymmetric polygon set — Voronoi-ish split of the rect.
    const polys = [
      "0,0 38,0 22,28 0,30",
      "38,0 72,0 55,32 22,28",
      "72,0 100,0 100,24 78,30 55,32",
      "0,30 22,28 18,55 0,58",
      "22,28 55,32 48,60 18,55",
      "55,32 78,30 75,58 48,60",
      "78,30 100,24 100,52 75,58",
      "0,58 18,55 14,82 0,84",
      "18,55 48,60 42,84 14,82",
      "48,60 75,58 70,86 42,84",
      "75,58 100,52 100,80 70,86",
      "0,84 14,82 28,100 0,100",
      "14,82 42,84 58,100 28,100",
      "42,84 70,86 84,100 58,100",
      "70,86 100,80 100,100 84,100",
    ];
    return polys.map((points, i) => {
      // Deterministic pseudo-random offsets per shard.
      const seed = i * 13.37;
      const rand = (n: number) => {
        const x = Math.sin(seed + n) * 1000;
        return x - Math.floor(x);
      };
      return {
        points,
        x: (rand(1) - 0.5) * 180,
        y: (rand(2) - 0.5) * 180,
        rotate: (rand(3) - 0.5) * 90,
        scale: 0.4 + rand(4) * 0.7,
        delay: rand(5) * 0.15,
      };
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden cursor-pointer"
      onClick={finish}
      role="presentation"
    >
      {/* Subtle radial spotlight to add depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 50%, hsl(var(--accent) / 0.12) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      {/* Broken-glass shatter-in overlay */}
      {!reduced && (
        <motion.svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 0.9, duration: 0.5, ease: "easeOut" }}
        >
          <defs>
            <linearGradient id="biq-shard-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--background))" stopOpacity="0.95" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {shards.map((s, i) => (
            <motion.polygon
              key={i}
              points={s.points}
              fill="url(#biq-shard-fill)"
              stroke="hsl(var(--foreground) / 0.18)"
              strokeWidth={0.15}
              vectorEffect="non-scaling-stroke"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={{
                x: s.x,
                y: s.y,
                rotate: s.rotate,
                scale: s.scale,
                opacity: 0,
              }}
              animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
              transition={{
                duration: 0.7,
                delay: s.delay,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </motion.svg>
      )}

      {/* The rotating Ballers.IQ card — 20% bigger than Court Show default */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduced ? 0 : 0.85, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <RotatingBallersIQBadge width={576} />
      </motion.div>

      {/* Skip hint */}
      <motion.p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-foreground/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.5 }}
      >
        Tap anywhere to skip
      </motion.p>
    </div>
  );
}
