import { Sparkles, AlertTriangle, Crown, Ban, Tv2 } from "lucide-react";

export type GameBadgeKey = "high_ceiling" | "trap_game" | "captain_active" | "no_owned" | "recap_ready";

export interface GameBadge {
  key: GameBadgeKey;
}

const META: Record<GameBadgeKey, { label: string; icon: any; classes: string }> = {
  high_ceiling: { label: "High Ceiling", icon: Sparkles, classes: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40" },
  trap_game: { label: "Trap Game", icon: AlertTriangle, classes: "bg-amber-500/15 text-amber-500 border-amber-500/40" },
  captain_active: { label: "Captain", icon: Crown, classes: "bg-[hsl(var(--nba-yellow))]/20 text-[hsl(var(--nba-yellow))] border-[hsl(var(--nba-yellow))]/40" },
  no_owned: { label: "No Owned", icon: Ban, classes: "bg-muted text-muted-foreground border-border" },
  recap_ready: { label: "Recap", icon: Tv2, classes: "bg-sky-500/15 text-sky-500 border-sky-500/40" },
};

export default function GameCardBadges({ badges }: { badges: GameBadge[] }) {
  // Intentionally rendered as no-op: schedule game cards no longer surface
  // top-right intelligence labels (TRAP GAME, NO OWNED, HIGH CEILING, RECAP, CAPTAIN).
  void badges; void META;
  return null;
}
