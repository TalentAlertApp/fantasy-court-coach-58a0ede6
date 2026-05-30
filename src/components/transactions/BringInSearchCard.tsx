import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Crosshair, Search } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { cn } from "@/lib/utils";

/** Strip diacritics for search matching ("donc" → "Dončić"). */
function norm(str: string): string {
  return (str ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

interface Props {
  /** Full searchable pool (any player, not only the visible table page). */
  players: any[];
  /** Open the Bring In planner for the chosen target. */
  onSelect: (playerId: number) => void;
}

/**
 * Premium "Bring In a Target" card — start an acquisition from any player
 * before choosing who to release. Replaces the per-row crosshair icons.
 */
export default function BringInSearchCard({ players, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return players
      .filter((p) => norm(p.core?.name).includes(q) || norm(p.core?.team).includes(q))
      .slice(0, 8);
  }, [players, query]);

  const pick = (p: any) => {
    onSelect(p.core.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-card via-card to-amber-500/[0.04] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),0_18px_50px_-30px_hsl(var(--nba-navy)/0.6)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--nba-yellow))]/15 text-[hsl(var(--nba-yellow))] ring-1 ring-[hsl(var(--nba-yellow))]/30">
            <Crosshair className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-foreground">
              Bring In a Target
            </div>
            <div className="text-[10.5px] text-muted-foreground leading-tight">
              Search any player and see how they fit your roster.
            </div>
          </div>
        </div>

        <div className="relative flex-1 min-w-0 sm:max-w-md sm:ml-auto">
          <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                  onFocus={() => { if (matches.length) setOpen(true); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matches[0]) { e.preventDefault(); pick(matches[0]); }
                    if (e.key === "Escape") setOpen(false);
                  }}
                  placeholder="Search player name or team…"
                  className="h-10 pl-9 pr-3 rounded-xl bg-background/70"
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={6}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)] max-h-[320px] overflow-y-auto z-[60]"
            >
              {matches.map((p) => {
                const logo = getTeamLogo(p.core.team);
                const fp5 = Number(p.last5?.fp5 ?? 0);
                return (
                  <button
                    key={p.core.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent/40 transition-colors text-left border-b border-border/60 last:border-b-0"
                  >
                    {p.core.photo ? (
                      <img src={p.core.photo} alt="" className="h-8 w-8 rounded-full object-cover object-[center_15%] bg-muted shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted inline-flex items-center justify-center text-[10px] font-bold shrink-0">
                        {p.core.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{p.core.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {logo && <img src={logo} alt="" className="h-3 w-3 object-contain" />}
                        <span>{p.core.team}</span>
                        <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-md h-3.5">
                          {p.core.fc_bc}
                        </Badge>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-[12px] font-bold text-[hsl(var(--nba-yellow))]">{fp5.toFixed(1)}<span className="text-[8px] text-muted-foreground ml-0.5">FP5</span></div>
                      <div className="font-mono text-[11px] text-muted-foreground">${p.core.salary}M</div>
                    </div>
                    <Crosshair className={cn("h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400")} />
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}