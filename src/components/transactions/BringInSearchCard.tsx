import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Crosshair, History, Search } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { useLeague } from "@/contexts/LeagueContext";

/** Strip diacritics for search matching ("donc" → "Dončić"). */
function norm(str: string): string {
  return (str ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const RECENT_MAX = 5;
const recentKey = (league: string) => `bringIn:recent:${league}`;

/** Read the recently-searched player IDs for a league (most-recent first). */
function readRecent(league: string): number[] {
  try {
    const raw = localStorage.getItem(recentKey(league));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

interface Props {
  /** Full searchable pool (any player, not only the visible table page). */
  players: any[];
  /** Open the Bring In planner for the chosen target. */
  onSelect: (playerId: number) => void;
  /** Compact toolbar mode — no card chrome, sized to sit inside a button row. */
  inline?: boolean;
}

/**
 * Premium "Bring In a Target" card — start an acquisition from any player
 * before choosing who to release. Replaces the per-row crosshair icons.
 */
export default function BringInSearchCard({ players, onSelect, inline = false }: Props) {
  const { league } = useLeague();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<number[]>(() => readRecent(league));
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-read recents whenever the active league changes (league-scoped history).
  useEffect(() => {
    setRecentIds(readRecent(league));
    setRecentOpen(false);
  }, [league]);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return players
      .filter((p) => norm(p.core?.name).includes(q) || norm(p.core?.team).includes(q))
      .slice(0, 8);
  }, [players, query]);

  // Resolve recent IDs against the CURRENT league pool so only players from the
  // active league surface (e.g. a Celtics player never shows for a WNBA league).
  const recentPlayers = useMemo(() => {
    const byId = new Map<number, any>(players.map((p) => [p.core?.id, p]));
    return recentIds.map((id) => byId.get(id)).filter(Boolean).slice(0, RECENT_MAX);
  }, [players, recentIds]);

  const pick = useCallback((p: any) => {
    const id = p.core.id;
    onSelect(id);
    setQuery("");
    setOpen(false);
    setRecentOpen(false);
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(recentKey(league), JSON.stringify(next));
      } catch {
        /* ignore quota/private-mode errors */
      }
      return next;
    });
  }, [league, onSelect]);

  /** Shared row renderer for both live matches and recent history. */
  const renderRow = (p: any) => {
    const logo = getTeamLogo(p.core.team);
    const fp5 = Number(p.last5?.fp5 ?? 0);
    return (
      <button
        key={p.core.id}
        type="button"
        onClick={() => pick(p)}
        className="group relative w-full flex items-center gap-3 pl-3.5 pr-[4.5rem] py-2.5 hover:bg-accent/40 transition-colors text-left border-b border-border/60 last:border-b-0 overflow-hidden"
      >
        {/* Team badge — corner watermark, surge on hover (kept clear of content) */}
        {logo && (
          <img
            src={logo}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 -right-2 h-14 w-14 object-contain opacity-[0.14] rotate-12 select-none transition-all duration-300 group-hover:opacity-30 group-hover:scale-110"
          />
        )}
        {p.core.photo ? (
          <img src={p.core.photo} alt="" className="relative z-10 h-10 w-10 rounded-full object-cover object-[center_15%] bg-muted ring-1 ring-border/60 shrink-0" />
        ) : (
          <div className="relative z-10 h-10 w-10 rounded-full bg-muted inline-flex items-center justify-center text-[10px] font-bold shrink-0">
            {p.core.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="relative z-10 flex-1 min-w-0">
          <div className="text-[13px] font-heading font-bold truncate">{p.core.name}</div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-medium tracking-wide">{p.core.team}</span>
            <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-md h-3.5">
              {p.core.fc_bc}
            </Badge>
          </div>
        </div>
        <div className="relative z-10 shrink-0 text-right leading-tight">
          <div className="font-mono text-[13px] font-bold text-[hsl(var(--nba-yellow))]">{fp5.toFixed(1)}<span className="text-[8px] text-muted-foreground ml-0.5">FP5</span></div>
          <div className="font-mono text-[11px] text-muted-foreground">${p.core.salary}M</div>
        </div>
      </button>
    );
  };

  const results = (
    <PopoverContent
      align="start"
      side="bottom"
      sideOffset={6}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)] max-h-[320px] overflow-y-auto z-[60]"
    >
      {matches.map((p) => renderRow(p))}
    </PopoverContent>
  );

  /** Recent-searches dropdown — sized to show up to 5 rows without scrolling. */
  const recentDropdown = (
    <PopoverContent
      align="end"
      side="bottom"
      sideOffset={6}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="p-0 rounded-xl w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden z-[60]"
    >
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border/60 bg-muted/30">
        <History className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
          Recently searched
        </span>
      </div>
      {recentPlayers.length > 0 ? (
        recentPlayers.map((p) => renderRow(p))
      ) : (
        <div className="px-3.5 py-4 text-[11px] text-muted-foreground text-center">
          No recent searches yet.
        </div>
      )}
    </PopoverContent>
  );

  // Compact toolbar variant — no card chrome, sits inline in the workbench row.
  if (inline) {
    return (
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--nba-yellow))]/15 text-[hsl(var(--nba-yellow))] ring-1 ring-[hsl(var(--nba-yellow))]/30">
          <Crosshair className="h-3.5 w-3.5" />
        </span>
        <span className="hidden md:inline text-[10px] font-heading font-bold uppercase tracking-wider text-foreground whitespace-nowrap">
          Bring In
        </span>
        <div className="relative flex-1 min-w-0">
          <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                  onFocus={() => { if (matches.length) setOpen(true); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matches[0]) { e.preventDefault(); pick(matches[0]); }
                    if (e.key === "Escape") setOpen(false);
                  }}
                  placeholder="Search any player…"
                  className="h-8 pl-8 pr-9 rounded-lg bg-[hsl(var(--nba-yellow))]/10 border-[hsl(var(--nba-yellow))]/30 text-xs focus-visible:bg-[hsl(var(--nba-yellow))]/15"
                />
                {/* Recent searches — far-right, context-sensitive toggle */}
                <Popover open={recentOpen} onOpenChange={setRecentOpen}>
                  <Tooltip>
                    <PopoverAnchor asChild>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Recently searched players"
                          onClick={() => { setOpen(false); setRecentOpen((v) => !v); }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[hsl(var(--nba-yellow))]/70 hover:text-[hsl(var(--nba-yellow))] hover:bg-[hsl(var(--nba-yellow))]/15 transition-colors"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                    </PopoverAnchor>
                    <TooltipContent side="top">Recently searched</TooltipContent>
                  </Tooltip>
                  {recentDropdown}
                </Popover>
              </div>
            </PopoverAnchor>
            {results}
          </Popover>
        </div>
      </div>
    );
  }

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
                  className="h-10 pl-9 pr-11 rounded-xl bg-background/70"
                />
                <Popover open={recentOpen} onOpenChange={setRecentOpen}>
                  <Tooltip>
                    <PopoverAnchor asChild>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Recently searched players"
                          onClick={() => { setOpen(false); setRecentOpen((v) => !v); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                    </PopoverAnchor>
                    <TooltipContent side="top">Recently searched</TooltipContent>
                  </Tooltip>
                  {recentDropdown}
                </Popover>
              </div>
            </PopoverAnchor>
            {results}
          </Popover>
        </div>
      </div>
    </div>
  );
}