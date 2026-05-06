import type { BIQTeamDifficulty } from "./types";

export type DifficultyLabel = BIQTeamDifficulty["label"];

/** Map BIQ team-difficulty label to a ring color (HSL string) for opponent badges. */
export function difficultyRingColor(label: DifficultyLabel | undefined | null): string {
  switch (label) {
    case "Elite": return "hsl(0 84% 60%)";       // red — very hard
    case "Tough":
    case "Trap Spot": return "hsl(25 95% 55%)";  // orange — hard
    case "Neutral": return "hsl(220 90% 60%)";   // blue — even
    case "Easy": return "hsl(142 76% 45%)";      // green — easy
    default: return "hsl(var(--muted-foreground))";
  }
}

export function difficultyTooltip(opp: string, isHome: boolean, label?: DifficultyLabel, score?: number): string {
  const venue = isHome ? "vs" : "@";
  const tag = label ? ` · ${label}${score != null ? ` (${Math.round(score)})` : ""}` : "";
  return `Next: ${venue} ${opp}${tag}`;
}
