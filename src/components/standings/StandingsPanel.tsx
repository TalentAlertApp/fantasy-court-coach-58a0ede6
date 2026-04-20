import { useState } from "react";
import StandingsFilters, { type StandingsView } from "./StandingsFilters";
import StandingsTable from "./StandingsTable";
import type { StandingRow } from "@/types/standings";

const DIVISIONS = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

interface Props {
  standings: StandingRow[];
  onTeamClick?: (tricode: string) => void;
}

export default function StandingsPanel({ standings, onTeamClick }: Props) {
  const [view, setView] = useState<StandingsView>("division");

  const east = standings.filter((r) => r.conference === "East").sort((a, b) => b.pct - a.pct || b.w - a.w);
  const west = standings.filter((r) => r.conference === "West").sort((a, b) => b.pct - a.pct || b.w - a.w);

  return (
    <div className="space-y-4">
      <StandingsFilters view={view} onChange={setView} />

      {view === "league" && (
        <StandingsTable rows={standings} showCutoffs={false} onTeamClick={onTeamClick} />
      )}

      {view === "conference" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StandingsTable rows={east} title="Eastern Conference" showCutoffs compact onTeamClick={onTeamClick} />
          <StandingsTable rows={west} title="Western Conference" showCutoffs compact onTeamClick={onTeamClick} />
        </div>
      )}

      {view === "division" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DIVISIONS.map((div) => {
            const divTeams = standings.filter((r) => r.division === div).sort((a, b) => b.pct - a.pct || b.w - a.w);
            return <StandingsTable key={div} rows={divTeams} title={div} compact onTeamClick={onTeamClick} />;
          })}
        </div>
      )}
    </div>
  );
}
