import { MapPin } from "lucide-react";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { getVenue } from "@/lib/nba-venues";
import { formatTipoffLabel } from "@/hooks/useUpcomingByTeam";
import GameActionLinks from "@/components/game/GameActionLinks";
import { useLeague } from "@/contexts/LeagueContext";

export interface GameMatchupHeaderGame {
  game_id?: string;
  home_team: string;
  away_team: string;
  home_pts: number;
  away_pts: number;
  status?: string | null;
  game_boxscore_url?: string | null;
  game_charts_url?: string | null;
  game_playbyplay_url?: string | null;
  nba_game_url?: string | null;
  gw?: number | null;
  day?: number | null;
  tipoff_utc?: string | null;
}

interface Props {
  game: GameMatchupHeaderGame;
  /** Hide the GameActionLinks row (boxscore/charts/play-by-play). */
  hideActionLinks?: boolean;
  className?: string;
}

/**
 * Shared scoreboard header — venue watermark, GW/Day/tipoff/venue pills,
 * away · score · home banner with team logos and names, optional action links.
 * Visual parity with GameDetailModal's header, minus the in-modal toggles
 * (Watch Recap / Ballers.IQ) that only make sense there.
 */
export default function GameMatchupHeader({ game, hideActionLinks, className = "" }: Props) {
  const { teams: leagueTeams } = useLeagueTeams();
  const { league } = useLeague();
  const logoFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.logo;
  const nameFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.name ?? tri;
  const awayLogo = logoFor(game.away_team);
  const homeLogo = logoFor(game.home_team);
  const venue = getVenue(game.home_team);
  const tipoffLabel = game.tipoff_utc ? formatTipoffLabel(game.tipoff_utc) : null;
  const hasGwDay = game.gw != null && game.day != null;

  return (
    <div className={`relative px-4 pt-2 pb-1.5 overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card border border-border/40 rounded-xl ${className}`}>
      {venue?.image && (
        <img
          src={venue.image}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.18] dark:opacity-[0.28] select-none"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-card/60 via-card/30 to-card/60" />

      {(hasGwDay || tipoffLabel || venue?.name) && (
        <div className="relative flex items-center justify-center gap-2 flex-wrap">
          {hasGwDay && (
            <span className="inline-flex items-center gap-1 px-2 py-px rounded-md border border-border/60 bg-background/40 backdrop-blur-sm text-[10px] font-heading uppercase tracking-[0.18em] font-bold text-foreground/90">
              GW {game.gw} · D {game.day}
            </span>
          )}
          {tipoffLabel && (
            <span className="inline-flex items-center px-2 py-px rounded-md border border-border/60 bg-background/40 backdrop-blur-sm text-[10px] font-mono tabular-nums text-foreground/80">
              {tipoffLabel}
            </span>
          )}
          {venue?.name && (
            <span
              className="inline-flex items-center gap-1 px-2 py-px rounded-md border border-border/60 bg-background/40 backdrop-blur-sm text-[10px] font-heading uppercase tracking-[0.16em] font-semibold text-foreground/80 max-w-[260px] truncate"
              title={venue.name}
            >
              <MapPin className="h-2.5 w-2.5 opacity-70" /> {venue.name}
            </span>
          )}
        </div>
      )}

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-1">
        {/* Away */}
        <div className="relative h-24 flex items-center justify-end pr-2 overflow-hidden">
          {awayLogo && (
            <img
              src={awayLogo}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -left-4 top-1/2 -translate-y-1/2 h-32 w-32 object-contain opacity-30 -rotate-12 select-none"
            />
          )}
          <span className="relative z-[1] font-heading font-black uppercase tracking-wider text-sm md:text-base text-foreground/90 truncate max-w-full">
            {nameFor(game.away_team)}
          </span>
        </div>
        <div className="relative text-center">
          <span className="font-mono font-black text-3xl tabular-nums inline-flex items-center gap-2">
            <span>{game.away_pts}</span>
            <span className="text-muted-foreground">-</span>
            <span>{game.home_pts}</span>
          </span>
        </div>
        {/* Home */}
        <div className="relative h-24 flex items-center justify-start pl-2 overflow-hidden">
          {homeLogo && (
            <img
              src={homeLogo}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 h-32 w-32 object-contain opacity-30 rotate-12 select-none"
            />
          )}
          <span className="relative z-[1] font-heading font-black uppercase tracking-wider text-sm md:text-base text-foreground/90 truncate max-w-full">
            {nameFor(game.home_team)}
          </span>
        </div>
      </div>

      {!hideActionLinks && (
        <GameActionLinks
          league={league}
          boxscoreUrl={game.game_boxscore_url}
          chartsUrl={game.game_charts_url}
          playByPlayUrl={game.game_playbyplay_url}
          leagueGameUrl={game.nba_game_url}
        />
      )}
    </div>
  );
}