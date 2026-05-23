import { Table2, BarChart3, Mic, ExternalLink } from "lucide-react";
import { getLeagueLogo } from "@/lib/competitions";
import type { CompetitionCode } from "@/lib/competitions";

export interface GameActionLinksProps {
  league: CompetitionCode | string;
  boxscoreUrl?: string | null;
  chartsUrl?: string | null;
  playByPlayUrl?: string | null;
  leagueGameUrl?: string | null;
  className?: string;
}

/**
 * Renders the BoxScore / Charts / PbP / League-site anchors used inside the
 * Game Played modal header. Each anchor is wired to the dataset URL passed in;
 * this component is the single source of truth for that wiring, so behaviour
 * can be covered by automated tests across all supported leagues.
 */
export default function GameActionLinks({
  league,
  boxscoreUrl,
  chartsUrl,
  playByPlayUrl,
  leagueGameUrl,
  className,
}: GameActionLinksProps) {
  const leagueName =
    league === "wnba" ? "WNBA" : league === "euroleague" ? "EuroLeague" : "NBA";
  const useLeagueLogo = league === "wnba" || league === "euroleague";

  return (
    <div
      className={
        className ??
        "relative z-[2] flex items-center justify-center gap-1.5 -mt-5 py-0 flex-wrap"
      }
    >
      {boxscoreUrl && (
        <a
          href={boxscoreUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="game-link-boxscore"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border"
        >
          <Table2 className="h-3.5 w-3.5" /> BoxScore
        </a>
      )}
      {chartsUrl && (
        <a
          href={chartsUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="game-link-charts"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Charts
        </a>
      )}
      {playByPlayUrl && (
        <a
          href={playByPlayUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="game-link-pbp"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border"
        >
          <Mic className="h-3.5 w-3.5" /> PbP
        </a>
      )}
      {leagueGameUrl && (
        <a
          href={leagueGameUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="game-link-league"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border"
        >
          {useLeagueLogo ? (
            <img
              src={getLeagueLogo(league)}
              alt=""
              aria-hidden
              className="h-3.5 w-3.5 object-contain"
            />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          {leagueName}
        </a>
      )}
    </div>
  );
}
