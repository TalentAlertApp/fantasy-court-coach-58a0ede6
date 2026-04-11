import { useState } from "react";
import type { StandingRow } from "@/types/standings";
import { cn } from "@/lib/utils";

type SortKey = keyof Pick<StandingRow, "w" | "l" | "pct" | "gb" | "ppg" | "oppPpg" | "diff" | "gp">;

interface Props {
  rows: StandingRow[];
  title?: string;
  showCutoffs?: boolean;
  compact?: boolean;
  onTeamClick?: (tricode: string) => void;
}

const ALL_COLS: { key: SortKey | null; label: string; className?: string; compactHide?: boolean }[] = [
  { key: null, label: "#", className: "w-8 text-center" },
  { key: null, label: "Team", className: "min-w-[100px]" },
  { key: "gp", label: "GP", className: "w-10 text-right" },
  { key: "w", label: "W", className: "w-10 text-right" },
  { key: "l", label: "L", className: "w-10 text-right" },
  { key: "pct", label: "PCT", className: "w-14 text-right" },
  { key: "gb", label: "GB", className: "w-12 text-right" },
  { key: null, label: "HOME", className: "w-14 text-right" },
  { key: null, label: "AWAY", className: "w-14 text-right" },
  { key: null, label: "CONF", className: "w-14 text-right", compactHide: true },
  { key: null, label: "DIV", className: "w-14 text-right", compactHide: true },
  { key: "ppg", label: "PPG", className: "w-14 text-right", compactHide: true },
  { key: "oppPpg", label: "OPP", className: "w-14 text-right", compactHide: true },
  { key: "diff", label: "DIFF", className: "w-14 text-right", compactHide: true },
  { key: null, label: "L10", className: "w-14 text-right", compactHide: true },
  { key: null, label: "STRK", className: "w-14 text-right", compactHide: true },
];

export default function StandingsTable({ rows, title, showCutoffs = false, compact = false, onTeamClick }: Props) {
  const COLS = compact ? ALL_COLS.filter((c) => !c.compactHide) : ALL_COLS;
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey] as number;
        const bv = b[sortKey] as number;
        return sortDir === "desc" ? bv - av : av - bv;
      })
    : rows;

  // Compute GB relative to this group's leader
  const leader = sorted[0];
  const withGb = sorted.map((r) => ({
    ...r,
    gb: leader ? ((leader.w - leader.l) - (r.w - r.l)) / 2 : 0,
  }));

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div>
      {title && <h3 className="text-sm font-heading font-bold uppercase mb-2 text-muted-foreground">{title}</h3>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 sticky top-0 z-10">
            <tr>
              {COLS.map((c, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(c.key)}
                  className={cn(
                    "px-2 py-2 font-heading uppercase text-[10px] text-muted-foreground whitespace-nowrap",
                    c.className,
                    c.key && "cursor-pointer hover:text-foreground",
                    sortKey === c.key && "text-foreground font-bold"
                  )}
                  aria-sort={sortKey === c.key ? (sortDir === "desc" ? "descending" : "ascending") : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withGb.map((r, i) => {
              const pos = i + 1;
              const isPlayIn = showCutoffs && pos === 7;
              const isElim = showCutoffs && pos === 11;

              return (
                <tr
                  key={r.tricode}
                  onClick={() => onTeamClick?.(r.tricode)}
                  className={cn(
                    "border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer",
                    i % 2 === 1 && "bg-muted/20",
                    isPlayIn && "border-t-2 border-t-amber-500",
                    isElim && "border-t-2 border-t-destructive"
                  )}
                >
                  <td className="px-2 py-1.5 text-center font-mono text-muted-foreground">{pos}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <img src={r.logo} alt={r.name} className="w-5 h-5" loading="lazy" />
                      <span className="font-heading font-bold uppercase text-xs">{r.tricode}</span>
                      {!compact && <span className="text-[10px] text-muted-foreground hidden md:inline">{r.name}</span>}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.gp}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold">{r.w}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.l}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold">{r.pct.toFixed(3).replace(/^0/, "")}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{r.gb === 0 ? "-" : r.gb.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.homeW}-{r.homeL}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.awayW}-{r.awayL}</td>
                  {!compact && <td className="px-2 py-1.5 text-right font-mono">{r.confW}-{r.confL}</td>}
                  {!compact && <td className="px-2 py-1.5 text-right font-mono">{r.divW}-{r.divL}</td>}
                  {!compact && <td className="px-2 py-1.5 text-right font-mono">{r.ppg.toFixed(1)}</td>}
                  {!compact && <td className="px-2 py-1.5 text-right font-mono">{r.oppPpg.toFixed(1)}</td>}
                  {!compact && <td className={cn("px-2 py-1.5 text-right font-mono font-bold", r.diff > 0 ? "text-green-500" : r.diff < 0 ? "text-destructive" : "")}>
                    {r.diff > 0 ? "+" : ""}{r.diff.toFixed(1)}
                  </td>}
                  {!compact && <td className="px-2 py-1.5 text-right font-mono">{r.l10W}-{r.l10L}</td>}
                  {!compact && <td className={cn("px-2 py-1.5 text-right font-mono font-bold", r.strk.startsWith("W") ? "text-green-500" : r.strk.startsWith("L") ? "text-destructive" : "")}>
                    {r.strk}
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCutoffs && rows.length >= 7 && (
        <div className="flex gap-4 mt-1.5 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> Play-In Zone</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-destructive inline-block" /> Eliminated</span>
        </div>
      )}
    </div>
  );
}
