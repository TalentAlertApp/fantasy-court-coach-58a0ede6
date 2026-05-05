import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, X, Clapperboard } from "lucide-react";
import { useCourtShowData } from "./useCourtShowData";
import CourtShowSlide from "./CourtShowSlide";
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

const SLIDE_MS = 7500;

export default function CourtShowModal({ open, onOpenChange, gw, day }: Props) {
  const { data, isLoading, games } = useCourtShowData(gw, day);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);

  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [openTri, setOpenTri] = useState<string | null>(null);
  const [openGame, setOpenGame] = useState<GameDetailGame | null>(null);

  const childModalOpen = openPlayerId !== null || openTri !== null || openGame !== null;

  useEffect(() => {
    if (open) { setIndex(0); setPlaying(true); }
  }, [open, gw, day]);

  const slides = data?.slides ?? [];
  const total = slides.length;

  useEffect(() => {
    if (!open || !playing || hover || childModalOpen || total <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), SLIDE_MS);
    return () => clearInterval(t);
  }, [open, playing, hover, childModalOpen, total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(total - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, total]);

  const current = slides[index];

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
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[85vh] h-[85vh] p-0 rounded-xl overflow-hidden bg-black border-white/10 [&>button]:hidden">
          <div className="relative w-full h-full flex flex-col" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
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
                    key={`${i}-${index}-${playing}`}
                    initial={{ width: i < index ? "100%" : "0%" }}
                    animate={{ width: i < index ? "100%" : i === index ? (playing && !hover && !childModalOpen ? "100%" : "0%") : "0%" }}
                    transition={{ duration: i === index && playing && !hover && !childModalOpen ? SLIDE_MS / 1000 : 0, ease: "linear" }}
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
                  />
                </AnimatePresence>
              )}
            </div>

            {/* Footer controls */}
            <div className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="p-2 rounded-full bg-white/5 text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="p-2 rounded-full bg-amber-400 text-black hover:bg-amber-300 transition-colors"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index >= total - 1}
                className="p-2 rounded-full bg-white/5 text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
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