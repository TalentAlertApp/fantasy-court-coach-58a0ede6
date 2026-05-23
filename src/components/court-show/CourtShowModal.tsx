import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, X, Clapperboard, Volume2, VolumeX, Maximize2, Minimize2, Gauge } from "lucide-react";
import { useCourtShowData } from "./useCourtShowData";
import CourtShowSlide from "./CourtShowSlide";
import { useCourtShowAudio } from "./useCourtShowAudio";
import { useLeague } from "@/contexts/LeagueContext";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";
import GameDetailModal, { type GameDetailGame } from "@/components/GameDetailModal";
import type { MatchupGame, RecapGame } from "./types";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  gw: number;
  day: number;
}

const SPEEDS: Record<"fast" | "normal" | "slow" | "manual", number> = {
  fast: 3000,
  normal: 7500,
  slow: 12000,
  manual: 0,
};
const SPEED_KEY = "courtshow.speed";
function readSpeed(): keyof typeof SPEEDS {
  if (typeof window === "undefined") return "normal";
  const v = localStorage.getItem(SPEED_KEY) as keyof typeof SPEEDS | null;
  return v && v in SPEEDS ? v : "normal";
}

export default function CourtShowModal({ open, onOpenChange, gw, day }: Props) {
  const { data, isLoading, games } = useCourtShowData(gw, day);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const { isWnba, league } = useLeague();
  const audio = useCourtShowAudio(open, isWnba);

  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [openTri, setOpenTri] = useState<string | null>(null);
  const [openGame, setOpenGame] = useState<GameDetailGame | null>(null);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>(readSpeed);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  // Snapshot the user's playing state before the video took over so we can
  // restore it when the video pauses/ends.
  const playingBeforeVideoRef = useRef<boolean | null>(null);

  const BASE_SLIDE_MS = SPEEDS[speed];
  const autoplayActive = playing && speed !== "manual";

  useEffect(() => {
    try { localStorage.setItem(SPEED_KEY, speed); } catch {}
  }, [speed]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };

  const childModalOpen = openPlayerId !== null || openTri !== null || openGame !== null;

  useEffect(() => {
    if (open) { setIndex(0); setPlaying(true); }
    // Intentionally only reset when `open` flips — not when gw/day change mid-show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const slides = data?.slides ?? [];
  const total = slides.length;
  const current = slides[index];
  const SLIDE_MS = current?.pageCount && BASE_SLIDE_MS > 0
    ? current.pageCount * BASE_SLIDE_MS
    : (current?.durationMs ?? BASE_SLIDE_MS);

  useEffect(() => {
    if (!open || !autoplayActive || hover || childModalOpen || videoPlaying || total <= 1 || SLIDE_MS <= 0) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % total), SLIDE_MS);
    return () => clearTimeout(t);
  }, [open, autoplayActive, hover, childModalOpen, videoPlaying, total, SLIDE_MS, index]);

  // Reset video state when leaving a slide.
  useEffect(() => {
    setVideoPlaying(false);
    playingBeforeVideoRef.current = null;
  }, [index]);

  const handleVideoPlayingChange = (vp: boolean) => {
    setVideoPlaying(vp);
    if (vp) {
      if (playingBeforeVideoRef.current === null) playingBeforeVideoRef.current = playing;
      if (playing) setPlaying(false);
    } else {
      if (playingBeforeVideoRef.current) setPlaying(true);
      playingBeforeVideoRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { setIndex((i) => Math.min(total - 1, i + 1)); setPlaying(false); audio.onSlideChange(); }
      else if (e.key === "ArrowLeft") { setIndex((i) => Math.max(0, i - 1)); setPlaying(false); audio.onSlideChange(); }
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, total, audio]);

  // Cue on autoplay slide change
  useEffect(() => {
    if (open) audio.onSlideChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open, audio]);

  const goPrev = () => { setIndex((i) => Math.max(0, i - 1)); setPlaying(false); };
  const goNext = () => { setIndex((i) => Math.min(total - 1, i + 1)); setPlaying(false); };
  const handleOutroAction = () => { onOpenChange(false); navigate("/"); };

  // Sponsor sting voiceover — fire once per open, only on the intro slide.
  useEffect(() => {
    if (!open || !current) return;
    if (current.payload.kind !== "intro") return;
    const t = setTimeout(() => audio.playIntroVO(), 300);
    return () => clearTimeout(t);
  }, [open, current, audio]);

  const togglePlaying = () => {
    setPlaying((p) => {
      const next = !p;
      if (next && current?.payload.kind === "intro") audio.playIntroVO();
      return next;
    });
  };

  const handleGameClick = (g: RecapGame | MatchupGame) => {
    const full = games.find((x: any) => x.game_id === g.game_id);
    if (full) {
      setOpenGame({
        game_id: full.game_id,
        home_team: full.home_team,
        away_team: full.away_team,
        home_pts: full.home_pts ?? 0,
        away_pts: full.away_pts ?? 0,
        status: full.status,
        nba_game_url: full.nba_game_url,
        game_recap_url: full.game_recap_url,
        game_boxscore_url: full.game_boxscore_url,
        game_charts_url: full.game_charts_url,
        game_playbyplay_url: full.game_playbyplay_url,
        youtube_recap_id: (full as any).youtube_recap_id ?? null,
        tipoff_utc: full.tipoff_utc ?? null,
        gw: full.gw ?? null,
        day: full.day ?? null,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[85vh] h-[85vh] p-0 rounded-xl overflow-hidden bg-black border-white/10 [&>button]:hidden">
          <div
            ref={containerRef}
            tabIndex={-1}
            className="court-show-stage relative w-full h-full flex flex-col bg-black focus:outline-none"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2 text-white">
                <Clapperboard className="h-4 w-4 text-amber-400" />
                <span className="font-heading font-black text-xs uppercase tracking-wider">Daily Court Show</span>
                <span className="text-white/40 text-xs">·</span>
                <span className="text-xs text-white/70">GW {gw}.{day}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-white/60">{total > 0 ? `${index + 1} / ${total}` : "—"}</span>
                <button
                  onClick={audio.toggle}
                  className="text-white/60 hover:text-amber-400 transition-colors"
                  aria-label={audio.enabled ? "Mute sound" : "Unmute sound"}
                  title={audio.enabled ? "Mute sound" : "Unmute sound"}
                >
                  {audio.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="text-white/60 hover:text-amber-400 transition-colors"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Progress segments */}
            <div className="absolute top-10 inset-x-0 z-30 px-4 flex gap-1">
              {slides.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    key={`${i}-${index}-${playing}-${speed}`}
                    initial={{ width: i < index ? "100%" : "0%" }}
                    animate={{ width: i < index ? "100%" : i === index ? (autoplayActive && !hover && !childModalOpen && !videoPlaying ? "100%" : "0%") : "0%" }}
                    transition={{ duration: i === index && autoplayActive && !hover && !childModalOpen && !videoPlaying && SLIDE_MS > 0 ? SLIDE_MS / 1000 : 0, ease: "linear" }}
                    className="h-full bg-amber-400"
                  />
                </div>
              ))}
            </div>

            {/* Canvas */}
            <div className="relative flex-1 min-h-0">
              {isLoading || !current ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Skeleton className="h-32 w-2/3 bg-white/5" />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <CourtShowSlide
                    key={index}
                    slide={current}
                    onPlayerClick={setOpenPlayerId}
                    onTeamClick={setOpenTri}
                    onGameClick={handleGameClick}
                    onOutroAction={handleOutroAction}
                    onVideoPlayingChange={handleVideoPlayingChange}
                    pageMs={BASE_SLIDE_MS}
                    leagueCode={league}
                  />
                </AnimatePresence>
              )}
            </div>

            {/* Footer controls */}
            <div className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
              <button
                onClick={goPrev}
                disabled={index === 0}
                className="p-2 rounded-full bg-white/5 text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={togglePlaying}
                className="p-2 rounded-full bg-amber-400 text-black hover:bg-amber-300 transition-colors"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                onClick={goNext}
                disabled={index >= total - 1}
                className="p-2 rounded-full bg-white/5 text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="ml-3 inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-1">
                <Gauge className="h-3.5 w-3.5 text-white/50 mx-1" />
                {([
                  { key: "fast", label: "1.2" },
                  { key: "normal", label: "1" },
                  { key: "slow", label: "0.8" },
                  { key: "manual", label: "∞" },
                ] as const).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSpeed(s.key)}
                    className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-full transition-colors ${speed === s.key ? "bg-amber-400 text-black" : "text-white/60 hover:text-white"}`}
                    aria-label={`Speed ${s.key}`}
                    title={s.key}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PlayerModal playerId={openPlayerId} open={openPlayerId !== null} onOpenChange={(o) => !o && setOpenPlayerId(null)} />
      <TeamModal tricode={openTri} open={openTri !== null} onOpenChange={(o) => !o && setOpenTri(null)} />
      <GameDetailModal game={openGame} open={openGame !== null} onOpenChange={(o) => !o && setOpenGame(null)} />
    </>
  );
}