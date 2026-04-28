import { ReactNode, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LeaderColumn, LeaderRow } from "./LeaderTable";

export interface LeaderSubject {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  columns: LeaderColumn[];
  rows: LeaderRow[];
}

function toneClass(tone: LeaderColumn["tone"], raw: string | number | ReactNode) {
  if (tone === "accent") return "text-red-500 font-bold";
  if (tone === "delta" && typeof raw === "number") {
    if (raw > 0) return "text-emerald-500 font-bold";
    if (raw < 0) return "text-destructive font-bold";
  }
  return "text-foreground font-semibold";
}

interface Props {
  subjects: LeaderSubject[];
  initialIndex?: number;
  onPlayerClick: (id: number) => void;
  onTeamClick: (tricode: string) => void;
  maxRows?: number;
}

export default function RotatingLeaderCard({
  subjects, initialIndex = 0, onPlayerClick, onTeamClick, maxRows = 10,
}: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const safeIdx = ((idx % subjects.length) + subjects.length) % subjects.length;
  const subject = subjects[safeIdx];
  const sliced = subject.rows.slice(0, maxRows);

  const prev = () => setIdx((i) => i - 1);
  const next = () => setIdx((i) => i + 1);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card flex flex-col shadow-sm">
      {/* Header with rotating arrows */}
      <div className="flex items-center gap-2 px-2 py-2 bg-gradient-to-r from-muted/60 via-muted/40 to-transparent border-b border-border">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous leaderboard"
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
          {subject.icon}
          <span className="text-xs font-heading font-bold uppercase tracking-wider truncate">{subject.title}</span>
          {subject.subtitle && (
            <span className="text-[10px] text-muted-foreground truncate font-heading uppercase tracking-wider hidden sm:inline">
              · {subject.subtitle}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label="Next leaderboard"
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1 py-1 bg-muted/20 border-b border-border/50">
        {subjects.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Show ${s.title}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === safeIdx ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
            )}
          />
        ))}
      </div>

      {/* Rows */}
      <div className="max-h-[560px] overflow-y-auto divide-y divide-border/40">
        {sliced.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No data available</div>
        )}
        {sliced.map((r, i) => {
          const logo = getTeamLogo(r.team);
          const isFc = r.fc_bc === "FC";
          return (
            <div
              key={`${subject.id}-${r.id}`}
              className="relative overflow-hidden flex items-center gap-2.5 px-3 py-2 hover:bg-accent/30 transition-colors group"
            >
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
              <span className="relative z-10 text-[10px] font-mono font-bold text-muted-foreground w-5 shrink-0 tabular-nums text-right">{i + 1}</span>
              <div className="relative z-10 shrink-0">
                {r.photo ? (
                  <img src={r.photo} alt="" className="w-9 h-9 rounded-full object-cover bg-muted ring-1 ring-border" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted ring-1 ring-border" />
                )}
              </div>
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
                  title={r.name}
                >
                  {r.name}
                </button>
              </div>
              <div className="relative z-10 flex items-center gap-1 shrink-0">
                {subject.columns.map((c, ci) => {
                  const v = r.values[ci];
                  const display = typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v;
                  return (
                    <div
                      key={c.key}
                      className="flex flex-col items-center justify-center min-w-[42px] px-1.5 py-1 rounded-md bg-muted/40 border border-border/50"
                    >
                      <span className="text-[8px] font-heading uppercase tracking-wider text-muted-foreground leading-none">{c.label}</span>
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