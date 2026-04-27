import { ReactNode } from "react";
import { getTeamLogo } from "@/lib/nba-teams";
import { cn } from "@/lib/utils";

export interface LeaderRow {
  id: number;
  name: string;
  team: string;
  photo: string | null;
  fc_bc: "FC" | "BC";
  /** Cell values keyed by column. */
  values: (string | number | ReactNode)[];
}

export interface LeaderColumn {
  key: string;
  label: string;
  /** tailwind text-align utility, default text-right */
  align?: "left" | "right" | "center";
  /** Cell highlight: 'accent' (red FP-style) or 'positive-negative' (color by sign) */
  tone?: "default" | "accent" | "delta";
}

interface LeaderTableProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  rows: LeaderRow[];
  columns: LeaderColumn[];
  onPlayerClick: (id: number) => void;
  onTeamClick: (tricode: string) => void;
  emptyLabel?: string;
  maxRows?: number;
}

function alignClass(a: LeaderColumn["align"]) {
  if (a === "left") return "text-left";
  if (a === "center") return "text-center";
  return "text-right";
}

function toneClass(tone: LeaderColumn["tone"], raw: string | number | ReactNode) {
  if (tone === "accent") return "text-red-500 font-bold";
  if (tone === "delta" && typeof raw === "number") {
    if (raw > 0) return "text-emerald-500 font-bold";
    if (raw < 0) return "text-destructive font-bold";
  }
  return "";
}

export default function LeaderTable({
  title,
  subtitle,
  icon,
  rows,
  columns,
  onPlayerClick,
  onTeamClick,
  emptyLabel = "No data available",
  maxRows = 10,
}: LeaderTableProps) {
  const sliced = rows.slice(0, maxRows);
  const grid = `grid grid-cols-[1fr_repeat(${columns.length},minmax(48px,1fr))] gap-0`;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
        {icon}
        <span className="text-xs font-heading font-bold uppercase tracking-wider truncate">{title}</span>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground ml-auto truncate">{subtitle}</span>
        )}
      </div>
      <div className={cn(grid, "px-3 py-1.5 text-[10px] font-heading uppercase text-muted-foreground border-b bg-muted/20")}>
        <span>Player</span>
        {columns.map((c) => (
          <span key={c.key} className={alignClass(c.align)}>{c.label}</span>
        ))}
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {sliced.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        )}
        {sliced.map((r, i) => {
          const logo = getTeamLogo(r.team);
          return (
            <div
              key={r.id}
              className={cn(grid, "px-3 py-1.5 items-center text-xs border-b border-border/30 hover:bg-accent/30 transition-colors", i % 2 === 0 ? "bg-card" : "bg-muted/20")}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] font-mono text-muted-foreground w-4 shrink-0 tabular-nums">{i + 1}</span>
                {r.photo ? (
                  <img src={r.photo} alt="" className="w-6 h-6 rounded-full object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                )}
                <button
                  className="truncate font-medium hover:text-primary hover:underline text-left"
                  onClick={() => onPlayerClick(r.id)}
                >
                  {r.name}
                </button>
                {logo && (
                  <button onClick={() => onTeamClick(r.team)} className="shrink-0">
                    <img src={logo} alt={r.team} className="w-4 h-4 hover:scale-125 transition-transform" />
                  </button>
                )}
              </div>
              {columns.map((c, ci) => {
                const v = r.values[ci];
                const display = typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v;
                return (
                  <span key={c.key} className={cn("font-mono tabular-nums", alignClass(c.align), toneClass(c.tone, v))}>
                    {display}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}