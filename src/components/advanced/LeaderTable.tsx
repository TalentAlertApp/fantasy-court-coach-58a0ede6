import { ReactNode } from "react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Badge } from "@/components/ui/badge";
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

function toneClass(tone: LeaderColumn["tone"], raw: string | number | ReactNode) {
  if (tone === "accent") return "text-red-500 font-bold";
  if (tone === "delta" && typeof raw === "number") {
    if (raw > 0) return "text-emerald-500 font-bold";
    if (raw < 0) return "text-destructive font-bold";
  }
  return "text-foreground font-semibold";
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

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-muted/60 via-muted/40 to-transparent border-b border-border">
        {icon}
        <span className="text-xs font-heading font-bold uppercase tracking-wider truncate">{title}</span>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground ml-auto truncate font-heading uppercase tracking-wider">{subtitle}</span>
        )}
      </div>

      {/* Rows */}
      <div className="max-h-[520px] overflow-y-auto divide-y divide-border/40">
        {sliced.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        )}
        {sliced.map((r, i) => {
          const logo = getTeamLogo(r.team);
          const isFc = r.fc_bc === "FC";
          return (
            <div
              key={r.id}
              className={cn(
                "relative overflow-hidden flex items-center gap-2.5 px-3 py-2 hover:bg-accent/30 transition-colors group",
              )}
            >
              {/* Watermark team logo */}
              {logo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTeamClick(r.team); }}
                  aria-label={r.team}
                  className="pointer-events-auto absolute -top-4 -right-4 w-20 h-20 z-0 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity rotate-12"
                  tabIndex={-1}
                >
                  <img src={logo} alt="" className="w-full h-full object-contain select-none" draggable={false} />
                </button>
              )}

              {/* Rank */}
              <span className="relative z-10 text-[10px] font-mono font-bold text-muted-foreground w-5 shrink-0 tabular-nums text-right">
                {i + 1}
              </span>

              {/* Photo */}
              <div className="relative z-10 shrink-0">
                {r.photo ? (
                  <img
                    src={r.photo}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover bg-muted ring-1 ring-border"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted ring-1 ring-border" />
                )}
              </div>

              {/* FC/BC + Name */}
              <div className="relative z-10 flex items-center gap-1.5 min-w-0 flex-1">
                <Badge
                  variant={isFc ? "destructive" : "default"}
                  className="text-[8px] px-1 py-0 rounded font-heading shrink-0 min-w-[20px] justify-center"
                >
                  {r.fc_bc}
                </Badge>
                <button
                  className="truncate text-sm font-semibold hover:text-primary hover:underline text-left"
                  onClick={() => onPlayerClick(r.id)}
                >
                  {r.name}
                </button>
              </div>

              {/* Stats: horizontal pill row */}
              <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                {columns.map((c, ci) => {
                  const v = r.values[ci];
                  const display = typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v;
                  return (
                    <div
                      key={c.key}
                      className="flex flex-col items-center justify-center min-w-[44px] px-1.5 py-1 rounded-md bg-muted/40 border border-border/50"
                    >
                      <span className="text-[8px] font-heading uppercase tracking-wider text-muted-foreground leading-none">
                        {c.label}
                      </span>
                      <span className={cn("font-mono tabular-nums text-[12px] leading-tight mt-0.5", toneClass(c.tone, v))}>
                        {display}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
