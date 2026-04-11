import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeamOfTheWeek, TOTWPlayer } from "@/hooks/useTeamOfTheWeek";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Heart } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Badge } from "@/components/ui/badge";
import courtBg from "@/assets/court-bg.png";
import PlayerModal from "@/components/PlayerModal";
import { useWishlist } from "@/hooks/useWishlist";

function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  const firstInitial = parts[0][0];
  const lastName = parts[parts.length - 1];
  return `${firstInitial}.${lastName}`.toUpperCase();
}

function getRowPositions(count: number, topPct: string): { top: string; left: string }[] {
  if (count === 3) {
    return [
      { top: topPct, left: "20%" },
      { top: topPct, left: "50%" },
      { top: topPct, left: "80%" },
    ];
  }
  return [
    { top: topPct, left: "33%" },
    { top: topPct, left: "67%" },
  ];
}

function getFormation(players: TOTWPlayer[]) {
  const fcs = players.filter((p) => p.fc_bc === "FC");
  const bcs = players.filter((p) => p.fc_bc === "BC");

  const fcPositions = getRowPositions(fcs.length, "30%");
  const bcPositions = getRowPositions(bcs.length, "72%");

  const positioned: { player: TOTWPlayer; style: { top: string; left: string } }[] = [];

  fcs.forEach((p, i) => {
    if (i < fcPositions.length) positioned.push({ player: p, style: fcPositions[i] });
  });
  bcs.forEach((p, i) => {
    if (i < bcPositions.length) positioned.push({ player: p, style: bcPositions[i] });
  });

  return positioned;
}

function TOTWCard({ player, onClick }: { player: TOTWPlayer; onClick: () => void }) {
  const teamLogo = getTeamLogo(player.team);
  const isFc = player.fc_bc === "FC";
  const { isInWishlist, toggleWishlist } = useWishlist();
  const wishlisted = isInWishlist(player.id);

  return (
    <div
      className="bg-card/95 backdrop-blur-sm border-t-2 rounded-lg overflow-hidden cursor-pointer hover:ring-1 hover:ring-accent transition-all relative group"
      style={{ borderColor: isFc ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}
      onClick={onClick}
    >
      {/* Wishlist toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleWishlist(player.id); }}
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Heart className={`h-3 w-3 ${wishlisted ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"}`} />
      </button>

      <div className="flex items-center justify-between px-1.5 pt-1">
        {teamLogo && <img src={teamLogo} alt={player.team} className="w-4 h-4" />}
        <span className="text-[8px] font-heading font-bold text-muted-foreground">{player.team}</span>
      </div>
      <div className="flex justify-center py-0.5">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            className="w-12 h-12 rounded-full object-cover bg-muted transition-transform duration-200 hover:scale-110"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-[10px] font-heading font-bold text-muted-foreground">
            {player.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-[10px] font-heading font-bold text-center truncate px-0.5 leading-tight">
        {formatShortName(player.name)}
      </p>
      <div className="flex items-center justify-center gap-1 py-0.5">
        <Badge variant={isFc ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-md h-3.5">
          {player.fc_bc}
        </Badge>
      </div>
      <div className="border-t border-border/50 px-1 py-1 text-center">
        <span className="text-[9px] font-heading font-bold text-emerald-400">{player.fp_avg} FP</span>
        <span className="text-[7px] text-muted-foreground ml-1">({player.gp}G)</span>
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
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
              className="relative w-full rounded-lg overflow-hidden"
              style={{
                aspectRatio: "5/3",
                backgroundImage: `url(${courtBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <span className="text-white/10 text-xl font-heading font-bold uppercase tracking-[0.3em]">
                  Team of the Week
                </span>
              </div>

              {formation.map(({ player, style }) => (
                <div
                  key={player.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-[18%] z-10"
                  style={{ top: style.top, left: style.left }}
                >
                  <TOTWCard player={player} onClick={() => setSelectedPlayerId(player.id)} />
                </div>
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
