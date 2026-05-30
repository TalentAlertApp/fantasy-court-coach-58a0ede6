import { useMemo, useState } from "react";
import StandingsTable, { type SortKey } from "./StandingsTable";
import type { StandingRow } from "@/types/standings";
import type { LeagueTeam } from "@/hooks/useLeagueTeams";
import type { CompetitionCode } from "@/lib/competitions";
import { getTeamMarket } from "@/lib/team-markets";
import {
  type HomeSplit,
  homeWinPct,
  homePointDiff,
  homeEdgePct,
} from "@/lib/standings-home-splits";
import { cn } from "@/lib/utils";

interface Props {
  standings: StandingRow[];
  leagueTeams: LeagueTeam[];
  homeSplits: Record<string, HomeSplit>;
  league: CompetitionCode;
  onTeamClick?: (tricode: string) => void;
}

const ROW_H = "h-9";

/**
 * League-view standings with a venue companion table on the left (~1/4 width).
 * Both tables share a single sort state so the venue rows always mirror the
 * main table's order, including live header re-sorts.
 */
export default function LeagueStandingsWithVenue({
  standings,
  leagueTeams,
  homeSplits,
  league,
  onTeamClick,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Identical ordering logic to StandingsTable's internal sort.
  const ordered = useMemo(() => {
    if (!sortKey) return standings;
    return [...standings].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [standings, sortKey, sortDir]);

  const venueByTri = useMemo(() => {
    const m: Record<string, LeagueTeam> = {};
    for (const t of leagueTeams) m[t.tricode] = t;
    return m;
  }, [leagueTeams]);

  return (
    <div className="flex gap-3 items-start">
      {/* Venue companion — left, ~1/4 width, hidden on narrow screens */}
      <div className="hidden lg:block w-1/4 shrink-0">
        <VenueTable
          rows={ordered}
          venueByTri={venueByTri}
          homeSplits={homeSplits}
          league={league}
          onTeamClick={onTeamClick}
        />
      </div>
      {/* Main standings — remaining width, controlled sort */}
      <div className="flex-1 min-w-0">
        <StandingsTable
          rows={ordered}
          showCutoffs={false}
          onTeamClick={onTeamClick}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          rowHeightClass={ROW_H}
        />
      </div>
    </div>
  );
}

function VenueTable({
  rows,
  venueByTri,
  homeSplits,
  league,
  onTeamClick,
}: {
  rows: StandingRow[];
  venueByTri: Record<string, LeagueTeam>;
  homeSplits: Record<string, HomeSplit>;
  league: CompetitionCode;
  onTeamClick?: (tricode: string) => void;
}) {
  const COLS: { label: string; className: string; title?: string }[] = [
    { label: "Arena", className: "min-w-[120px]" },
    { label: "Market", className: "w-20" },
    { label: "Conf", className: "w-12 text-center" },
    { label: "HW%", className: "w-14 text-right", title: "Home win %" },
    { label: "HDIFF", className: "w-14 text-right", title: "Home point differential (per game)" },
    { label: "HE", className: "w-14 text-right", title: "Home edge = home win% − away win%" },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr>
            {COLS.map((c, i) => (
              <th
                key={i}
                title={c.title}
                className={cn(
                  "sticky top-0 z-20 bg-muted px-2 py-2 font-heading uppercase text-[10px] text-muted-foreground whitespace-nowrap border-b border-border",
                  c.className,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = venueByTri[r.tricode];
            const venueName = team?.venueName ?? "";
            const venueImage = team?.venueImage ?? "";
            const market = getTeamMarket(league, r.tricode, r.name);
            const conf = r.conference ? r.conference[0] : "—";
            const split = homeSplits[r.tricode];
            const hw = homeWinPct(split) * 100;
            const hdiff = homePointDiff(split);
            const he = homeEdgePct(split);
            return (
              <tr
                key={r.tricode}
                onClick={() => onTeamClick?.(r.tricode)}
                className={cn(
                  "border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer",
                  ROW_H,
                  i % 2 === 1 && "bg-muted/20",
                )}
              >
                {/* Arena — decorative venue image background, readable text on top */}
                <td className="relative p-0 overflow-hidden">
                  {venueImage && (
                    <img
                      src={venueImage}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 select-none"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/85 via-background/65 to-background/40"
                  />
                  <span className="relative z-[1] block truncate px-2 py-1.5 font-heading font-bold uppercase text-[11px] tracking-wide text-foreground drop-shadow-[0_1px_2px_hsl(var(--background))]">
                    {venueName || "—"}
                  </span>
                </td>
                <td className="px-2 py-1.5 truncate text-muted-foreground">{market || "—"}</td>
                <td className="px-2 py-1.5 text-center font-mono">{conf}</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold">
                  {split ? `${(hw).toFixed(0)}%` : "—"}
                </td>
                <td className={cn(
                  "px-2 py-1.5 text-right font-mono",
                  split ? (hdiff > 0 ? "text-green-500" : hdiff < 0 ? "text-destructive" : "") : "",
                )}>
                  {split ? `${hdiff > 0 ? "+" : ""}${hdiff.toFixed(1)}` : "—"}
                </td>
                <td className={cn(
                  "px-2 py-1.5 text-right font-mono font-bold",
                  split ? (he > 0 ? "text-green-500" : he < 0 ? "text-destructive" : "") : "",
                )}>
                  {split ? `${he > 0 ? "+" : ""}${he.toFixed(0)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}