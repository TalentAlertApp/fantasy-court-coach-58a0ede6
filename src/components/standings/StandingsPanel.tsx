import { useState } from "react";
import StandingsFilters, { type StandingsView } from "./StandingsFilters";
import StandingsTable from "./StandingsTable";
import type { StandingRow } from "@/types/standings";
import nbaLogo from "@/assets/nba-logo.svg";

const DIVISIONS = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

interface Props {
  standings: StandingRow[];
  onTeamClick?: (tricode: string) => void;
  /** Optional controlled view; when omitted, the panel shows its own filter UI. */
  view?: StandingsView;
  onViewChange?: (v: StandingsView) => void;
}

export default function StandingsPanel({ standings, onTeamClick, view: viewProp, onViewChange }: Props) {
  const [internalView, setInternalView] = useState<StandingsView>("division");
  const view = viewProp ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const showOwnFilters = viewProp === undefined;

  const east = standings.filter((r) => r.conference === "East").sort((a, b) => b.pct - a.pct || b.w - a.w);
  const west = standings.filter((r) => r.conference === "West").sort((a, b) => b.pct - a.pct || b.w - a.w);

  const Watermark = () => (
    <img
      src={nbaLogo}
      alt=""
      aria-hidden
      className="pointer-events-none absolute inset-0 m-auto h-[60%] max-h-[420px] w-auto opacity-[0.05] dark:opacity-[0.06] select-none z-0"
    />
  );

  return (
    <div className="space-y-4">
      {showOwnFilters && <StandingsFilters view={view} onChange={setView} />}

      {view === "league" && (
        <div className="relative">
          <Watermark />
          <div className="relative z-[1]">
            <StandingsTable rows={standings} showCutoffs={false} onTeamClick={onTeamClick} />
          </div>
        </div>
      )}

      {view === "conference" && (
        <div className="relative">
          <Watermark />
          <div className="relative z-[1] grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StandingsTable rows={east} title="Eastern Conference" showCutoffs compact onTeamClick={onTeamClick} />
            <StandingsTable rows={west} title="Western Conference" showCutoffs compact onTeamClick={onTeamClick} />
          </div>
        </div>
      )}

      {view === "division" && (
        <div className="relative">
          <Watermark />
          <div className="relative z-[1] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DIVISIONS.map((div) => {
              const divTeams = standings.filter((r) => r.division === div).sort((a, b) => b.pct - a.pct || b.w - a.w);
              return <StandingsTable key={div} rows={divTeams} title={div} compact onTeamClick={onTeamClick} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
