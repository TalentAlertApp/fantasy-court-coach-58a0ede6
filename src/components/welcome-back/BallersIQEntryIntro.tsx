import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RotatingBallersIQBadge from "@/components/court-show/RotatingBallersIQBadge";
import { useLeague } from "@/contexts/LeagueContext";
import courtBg from "@/assets/court-bg.png";

const AUDIO_PREF_KEY = "courtshow.audio.enabled";
const DURATION_MS = 7200;
const TARGET_VOLUME = 0.9;

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
  const [exiting, setExiting] = useState(false);
  const EXIT_MS = 1100;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    // Smooth fade-out across the exit window.
    const a = audioRef.current;
    if (a) {
      const startVol = a.volume;
      const steps = 14;
      let i = 0;
      const id = window.setInterval(() => {
        i += 1;
        try { a.volume = Math.max(0, startVol * (1 - i / steps)); } catch {}
        if (i >= steps) {
          window.clearInterval(id);
          try { a.pause(); a.currentTime = 0; } catch {}
        }
      }, EXIT_MS / 10);
    }
    setExiting(true);
    window.setTimeout(() => onDone(), EXIT_MS);
  };

  // VO playback with smooth fade-in.
  useEffect(() => {
    if (!audioEnabled()) return;
    const src = isWnba
      ? "/audio/HoopsFantasy_BallersIQ-FEMALE.mp3"
      : "/audio/HoopsFantasy_BallersIQ-MALE.mp3";
    const a = new Audio(src);
    a.volume = 0;
    a.preload = "auto";
    audioRef.current = a;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      a.play().then(() => {
        // Ramp volume 0 → TARGET over 700ms.
        const steps = 14;
        let i = 0;
        const id = window.setInterval(() => {
          i += 1;
          try { a.volume = Math.min(TARGET_VOLUME, (i / steps) * TARGET_VOLUME); } catch {}
          if (i >= steps) window.clearInterval(id);
        }, 50);
      }).catch(() => {});
    };
    const onReady = () => start();
    a.addEventListener("canplaythrough", onReady, { once: true });
    const safety = window.setTimeout(start, 250);
    return () => {
      window.clearTimeout(safety);
      a.removeEventListener("canplaythrough", onReady);
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
      // Deterministic pseudo-random offsets per shard — gentler than before.
      const seed = i * 13.37;
      const rand = (n: number) => {
        const x = Math.sin(seed + n) * 1000;
        return x - Math.floor(x);
      };
      return {
        points,
        x: (rand(1) - 0.5) * 60,
        y: (rand(2) - 0.5) * 60,
        rotate: (rand(3) - 0.5) * 30,
        scale: 0.85 + rand(4) * 0.25,
        delay: 0.08 + rand(5) * 0.35,
      };
    });
  }, []);

  return (
    <AnimatePresence>
    {!exiting && (
    <motion.div
      key="biq-intro"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden cursor-pointer"
      onClick={finish}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, transition: { duration: EXIT_MS / 1000, ease: [0.65, 0, 0.35, 1] } }}
    >
      {/* Court background — gentle scale-in + fade */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-25 dark:opacity-15"
        style={{ backgroundImage: `url(${courtBg})` }}
        aria-hidden
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, transition: { duration: 0.6 } }}
      />

      {/* Subtle radial spotlight — soft pulse */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 50%, hsl(var(--accent) / 0.12) 0%, transparent 60%)",
        }}
        aria-hidden
        initial={{ opacity: 0.4 }}
        animate={{ opacity: [0.6, 1, 0.85], transition: { duration: 4, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" } }}
      />

      {/* Subtle glass-pane settle overlay */}
      {!reduced && (
        <motion.svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 1.1, duration: 0.8, ease: "easeOut" }}
          exit={{ opacity: 1, transition: { duration: 0 } }}
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
              stroke="hsl(var(--foreground) / 0.12)"
              strokeWidth={0.1}
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
                duration: 0.9,
                delay: s.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              exit={{
                opacity: 0,
                scale: 1.06,
                transition: { duration: 0.9, ease: [0.65, 0, 0.35, 1] },
              }}
            />
          ))}
        </motion.svg>
      )}

      {/* The rotating Ballers.IQ card — premium reveal + gentle float */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.78, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: reduced ? 0 : 0.55, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        exit={{ opacity: 0, scale: 1.06, filter: "blur(6px)", transition: { duration: 0.7, ease: [0.65, 0, 0.35, 1] } }}
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, -6, 0], scale: [1, 1.015, 1] }}
          transition={reduced ? undefined : { duration: 4.5, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
        >
          <RotatingBallersIQBadge width={576} />
        </motion.div>
      </motion.div>

      {/* Skip hint */}
      <motion.p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-foreground/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ delay: 2.2, duration: 2.6, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      >
        Tap anywhere to skip
      </motion.p>
    </motion.div>
    )}
    </AnimatePresence>
  );
}
