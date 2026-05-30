import { useState } from "react";
import StandingsFilters, { type StandingsView } from "./StandingsFilters";
import StandingsTable from "./StandingsTable";
import LeagueStandingsWithVenue from "./LeagueStandingsWithVenue";
import type { StandingRow } from "@/types/standings";
import type { LeagueTeam } from "@/hooks/useLeagueTeams";
import type { CompetitionCode } from "@/lib/competitions";
import type { HomeSplit } from "@/lib/standings-home-splits";

interface Props {
  standings: StandingRow[];
  onTeamClick?: (tricode: string) => void;
  /** Optional controlled view; when omitted, the panel shows its own filter UI. */
  view?: StandingsView;
  onViewChange?: (v: StandingsView) => void;
  /** Division names to render (in order). When the rows have no divisions
   *  (e.g. WNBA), Division view falls back to Conference. */
  divisions?: string[];
  /** League-view venue companion table inputs (Arena/Market/Conf/HW%/HDIFF/HE). */
  leagueTeams?: LeagueTeam[];
  homeSplits?: Record<string, HomeSplit>;
  league?: CompetitionCode;
}

const NBA_DIVISIONS = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

export default function StandingsPanel({ standings, onTeamClick, view: viewProp, onViewChange, divisions, leagueTeams, homeSplits, league }: Props) {
  const [internalView, setInternalView] = useState<StandingsView>("division");
  const view = viewProp ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const showOwnFilters = viewProp === undefined;

  const inferred = Array.from(new Set(standings.map((r) => r.division).filter(Boolean)));
  const divs = (divisions && divisions.length > 0)
    ? divisions
    : (inferred.length > 0 ? inferred : NBA_DIVISIONS);
  const hasDivisions = inferred.length > 0;

  const east = standings.filter((r) => r.conference === "East").sort((a, b) => b.pct - a.pct || b.w - a.w);
  const west = standings.filter((r) => r.conference === "West").sort((a, b) => b.pct - a.pct || b.w - a.w);

  return (
    <div className="space-y-4">
      {showOwnFilters && <StandingsFilters view={view} onChange={setView} />}

      {view === "league" && (
        leagueTeams && homeSplits && league ? (
          <LeagueStandingsWithVenue
            standings={standings}
            leagueTeams={leagueTeams}
            homeSplits={homeSplits}
            league={league}
            onTeamClick={onTeamClick}
          />
        ) : (
          <StandingsTable rows={standings} showCutoffs={false} onTeamClick={onTeamClick} />
        )
      )}

      {view === "conference" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StandingsTable rows={east} title="Eastern Conference" showCutoffs compact onTeamClick={onTeamClick} />
          <StandingsTable rows={west} title="Western Conference" showCutoffs compact onTeamClick={onTeamClick} />
        </div>
      )}

      {view === "division" && hasDivisions && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {divs.map((div) => {
            const divTeams = standings.filter((r) => r.division === div).sort((a, b) => b.pct - a.pct || b.w - a.w);
            return <StandingsTable key={div} rows={divTeams} title={div} compact onTeamClick={onTeamClick} />;
          })}
        </div>
      )}

      {view === "division" && !hasDivisions && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StandingsTable rows={east} title="Eastern Conference" showCutoffs compact onTeamClick={onTeamClick} />
          <StandingsTable rows={west} title="Western Conference" showCutoffs compact onTeamClick={onTeamClick} />
        </div>
      )}
    </div>
  );
}
