import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeamOfTheWeek, TOTWPlayer } from "@/hooks/useTeamOfTheWeek";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Heart } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Badge } from "@/components/ui/badge";
import courtBg from "@/assets/court-bg.png";
import PlayerModal from "@/components/PlayerModal";
import { useWishlist } from "@/hooks/useWishlist";
import { getCourtFormation } from "@/lib/court-layout";
import { useLeague } from "@/contexts/LeagueContext";
import { getLeagueLogo } from "@/lib/competitions";

function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  const firstInitial = parts[0][0];
  const lastName = parts[parts.length - 1];
  return `${firstInitial}.${lastName}`.toUpperCase();
}

function getFormation(players: TOTWPlayer[]) {
  const sortByFp = (a: TOTWPlayer, b: TOTWPlayer) => b.fp_avg - a.fp_avg;
  // Use whichever Starting-5 valid shape the data fits: 3FC+2BC or 2FC+3BC.
  const fcsAll = players.filter((p) => p.fc_bc === "FC").sort(sortByFp);
  const bcsAll = players.filter((p) => p.fc_bc === "BC").sort(sortByFp);
  let fcs = fcsAll.slice(0, 3);
  let bcs = bcsAll.slice(0, 2);
  if (fcsAll.length < 3 && bcsAll.length >= 3) {
    fcs = fcsAll.slice(0, 2);
    bcs = bcsAll.slice(0, 3);
  }
  const merged = [...fcs, ...bcs];
  // Mirror /MY ROSTER Starting 5 court via the SAME shared coordinate helper,
  // then shift the entire formation left so it visually centers within the
  // wider TOTW court canvas (the rightmost slot was sitting on the edge).
  const OFFSET_X = -14; // percent — shift formation left to visually center within the wide TOTW canvas
  const OFFSET_Y = -10; // percent — vertical position locked (already centered)
  return getCourtFormation(merged, (p) => p.fc_bc).map(({ item, style }) => {
    const leftPct = parseFloat(style.left);
    const topPct = parseFloat(style.top);
    return {
      player: item,
      style: { top: `${topPct + OFFSET_Y}%`, left: `${leftPct + OFFSET_X}%` },
    };
  });
}

function TOTWCard({ player, onClick }: { player: TOTWPlayer; onClick: () => void }) {
  const teamLogo = getTeamLogo(player.team);
  const isFc = player.fc_bc === "FC";
  const { isInWishlist, toggleWishlist } = useWishlist();
  const wishlisted = isInWishlist(player.id);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer group relative flex flex-col items-center"
      style={{ minWidth: 0 }}
    >
      {/* Wishlist toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleWishlist(player.id); }}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-black/60 rounded-full p-1.5 hover:bg-black/80"
        aria-label="Toggle wishlist"
      >
        <Heart className={`h-3.5 w-3.5 ${wishlisted ? "fill-destructive text-destructive" : "text-white"}`} />
      </button>

      {/* Team logo watermark behind player */}
      {teamLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-15">
          <img src={teamLogo} alt="" className="w-28 h-28" />
        </div>
      )}

      {/* Photo — large, cinematic */}
      <div className="relative z-10">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover object-top bg-black/20 shadow-2xl transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-black/40 flex items-center justify-center text-2xl font-heading font-bold text-white/80">
            {player.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <p className="text-sm md:text-base font-heading font-bold text-center text-white drop-shadow-lg leading-tight mt-1.5 truncate max-w-full z-10">
        {formatShortName(player.name)}
      </p>

      {/* FC/BC badge + salary pill */}
      <div className="flex items-center justify-center gap-1.5 mt-1 z-10">
        <Badge variant={isFc ? "destructive" : "default"} className="text-[10px] px-2 py-0 rounded h-5 inline-flex items-center shadow-md">
          {player.fc_bc}
        </Badge>
        <span className="rounded-md bg-card/90 border border-border/40 px-2 h-5 inline-flex items-center gap-0.5 text-[11px] font-mono font-bold text-foreground shadow-md">
          <span className="text-[hsl(var(--nba-yellow))]">$</span>{player.salary.toFixed(1)}M
        </span>
      </div>

      {/* GW FP — soft-pill matching width of FC + $ row above */}
      <div className="mt-1 z-10 mx-auto rounded-xl px-3 py-1 bg-emerald-500/85 text-black text-xs font-heading font-bold shadow-md text-center">
        {player.fp_avg} FP <span className="opacity-70 font-mono">({player.gp}G)</span>
      </div>
    </div>
  );
}

interface TeamOfTheWeekModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gw: number;
}

export default function TeamOfTheWeekModal({ open, onOpenChange, gw }: TeamOfTheWeekModalProps) {
  const { data, isLoading } = useTeamOfTheWeek(gw);
  const formation = data?.players ? getFormation(data.players) : [];
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const { league } = useLeague();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading uppercase tracking-wider">
              <Trophy className="h-5 w-5 text-accent" />
              Team of the Week — GW {gw}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : formation.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No game data available for this gameweek yet.
            </div>
          ) : (
            <div
              className="relative w-full rounded-lg overflow-hidden min-h-[640px] aspect-[16/10]"
              style={{
                backgroundImage: `url(${courtBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <img
                src={getLeagueLogo(league)}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute top-4 right-4 z-20 h-16 w-16 md:h-20 md:w-20 object-contain opacity-50 hover:opacity-100 hover:scale-125 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <span className="text-white/10 text-xl font-heading font-bold uppercase tracking-[0.3em]">
                  Team of the Week
                </span>
              </div>

              {formation.map(({ player, style }, i) => (
                <motion.div
                  key={player.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-[26%] md:w-[24%] lg:w-[22%] z-10"
                  style={{ top: style.top, left: style.left }}
                  initial={{ opacity: 0, y: 32, scale: 0.6, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  transition={{ delay: 0.5 + i * 0.5, type: "spring", stiffness: 220, damping: 20 }}
                >
                  <TOTWCard player={player} onClick={() => setSelectedPlayerId(player.id)} />
                </motion.div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(o) => { if (!o) setSelectedPlayerId(null); }}
      />
    </>
  );
}
