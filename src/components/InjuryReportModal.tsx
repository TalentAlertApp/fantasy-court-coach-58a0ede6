import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, RefreshCw, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAMS, getTeamByTricode } from "@/lib/nba-teams";
import nbaLogo from "@/assets/nba-logo.svg";
import { cn } from "@/lib/utils";
import PlayerModal from "@/components/PlayerModal";
import { useRosterQuery } from "@/hooks/useRosterQuery";

interface InjuryRecord {
  player_name: string;
  team: string;
  team_abbr: string;
  injury_type: string;
  status: string;
  estimated_return: string | null;
  notes: string;
  last_updated: string;
  source: string;
}

interface InjuryPayload {
  generated_at: string;
  total_players: number;
  sources_failed?: string[];
  by_team: Record<string, InjuryRecord[]>;
  all: InjuryRecord[];
}

interface EnrichedRecord extends InjuryRecord {
  player_id: number | null;
  pos: string | null;
  fc_bc: string | null;
  photo: string | null;
  team_tricode: string;
  team_full_name: string;
  on_roster: boolean;
}

interface InjuryReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CACHE_KEY = "nbaf:injury-report:v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

function readCache(): InjuryPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; payload: InjuryPayload };
    if (!parsed?.savedAt || !parsed?.payload) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCache(payload: InjuryPayload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // ignore quota
  }
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tricodeFromTeamString(s: string): string {
  if (!s) return "";
  const upper = s.toUpperCase().trim();
  const exact = NBA_TEAMS.find((t) => t.tricode === upper);
  if (exact) return exact.tricode;
  const lower = s.toLowerCase();
  const byName = NBA_TEAMS.find(
    (t) => lower.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(lower),
  );
  return byName?.tricode ?? upper.slice(0, 3);
}

function fullNameFromTricode(tricode: string): string {
  return NBA_TEAMS.find((t) => t.tricode === tricode)?.name ?? tricode;
}

function statusClasses(status: string): string {
  switch (status) {
    case "Out":
      return "bg-destructive text-destructive-foreground";
    case "Day-To-Day":
      return "bg-orange-500 text-white";
    case "Game-Time Decision":
      return "bg-amber-500 text-white";
    case "Questionable":
      return "bg-yellow-400 text-black";
    case "Probable":
      return "bg-green-600 text-white";
    case "Rest":
      return "bg-slate-500 text-white";
    case "Personal":
      return "bg-muted text-muted-foreground";
    case "Suspended":
      return "bg-red-900 text-white";
    case "G-League":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

interface ReturnInfo {
  label: string;
  isSeasonEnd: boolean;
  isTbd: boolean;
  daysAway: number | null;
}

function formatReturn(raw: string | null): ReturnInfo {
  if (!raw) return { label: "TBD", isSeasonEnd: false, isTbd: true, daysAway: null };
  const trimmed = raw.trim();
  if (!trimmed) return { label: "TBD", isSeasonEnd: false, isTbd: true, daysAway: null };
  if (/season-?ending/i.test(trimmed)) return { label: "Season-ending", isSeasonEnd: true, isTbd: false, daysAway: null };
  if (/next season/i.test(trimmed)) return { label: "Next Season", isSeasonEnd: true, isTbd: false, daysAway: null };
  const iso = parseISO(trimmed);
  if (isValid(iso)) {
    const days = differenceInCalendarDays(iso, new Date());
    return { label: format(iso, "MMM d"), isSeasonEnd: false, isTbd: false, daysAway: days };
  }
  const d = new Date(trimmed);
  if (isValid(d) && !isNaN(d.getTime())) {
    const days = differenceInCalendarDays(d, new Date());
    return { label: format(d, "MMM d"), isSeasonEnd: false, isTbd: false, daysAway: days };
  }
  return { label: trimmed, isSeasonEnd: false, isTbd: false, daysAway: null };
}

function dateColorClass(ret: ReturnInfo): string {
  if (ret.isSeasonEnd) return "text-red-500 font-bold";
  if (ret.isTbd) return "text-muted-foreground";
  if (ret.daysAway === null) return "text-muted-foreground";
  if (ret.daysAway <= 30) return "text-yellow-400 font-bold";
  return "text-red-500 font-bold";
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function InjuryReportModal({ open, onOpenChange }: InjuryReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InjuryPayload | null>(null);
  const [rosterMap, setRosterMap] = useState<Map<string, { id: number; team: string; pos: string | null; fc_bc: string; photo: string | null }>>(new Map());
  const [view, setView] = useState<"all" | string>("all");
  const [myRosterOnly, setMyRosterOnly] = useState(false);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "Out" | "Day-To-Day" | "Questionable" | "Probable">("all");

  const { data: rosterData } = useRosterQuery();
  const rosterIds = useMemo(() => {
    const set = new Set<number>();
    const slots = (rosterData as any)?.roster ?? (rosterData as any)?.slots ?? [];
    if (Array.isArray(slots)) {
      for (const s of slots) {
        const pid = s?.player_id ?? s?.player?.id ?? s?.id;
        if (typeof pid === "number") set.add(pid);
      }
    }
    return set;
  }, [rosterData]);

  const load = useCallback(async (force = false) => {
    setError(null);

    if (!force) {
      const cached = readCache();
      if (cached) {
        setPayload(cached);
        // still load roster map in background if not loaded
        const { data: playersRows } = await supabase.from("players").select("id, name, team, pos, fc_bc, photo");
        const map = new Map<string, { id: number; team: string; pos: string | null; fc_bc: string; photo: string | null }>();
        (playersRows ?? []).forEach((p: any) => {
          if (!p?.name) return;
          map.set(normalizeName(p.name), {
            id: p.id,
            team: p.team,
            pos: p.pos ?? null,
            fc_bc: p.fc_bc,
            photo: p.photo ?? null,
          });
        });
        setRosterMap(map);
        return;
      }
    }

    setLoading(true);
    try {
      const [{ data: injuryData, error: fnErr }, { data: playersRows, error: pErr }] = await Promise.all([
        supabase.functions.invoke("nba-injury-report"),
        supabase.from("players").select("id, name, team, pos, fc_bc, photo"),
      ]);
      if (fnErr) throw new Error(fnErr.message ?? "Failed to fetch injuries");
      if (pErr) throw new Error(pErr.message ?? "Failed to fetch players");

      const map = new Map<string, { id: number; team: string; pos: string | null; fc_bc: string; photo: string | null }>();
      (playersRows ?? []).forEach((p: any) => {
        if (!p?.name) return;
        map.set(normalizeName(p.name), {
          id: p.id,
          team: p.team,
          pos: p.pos ?? null,
          fc_bc: p.fc_bc,
          photo: p.photo ?? null,
        });
      });
      setRosterMap(map);
      setPayload(injuryData as InjuryPayload);
      writeCache(injuryData as InjuryPayload);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load injury report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !payload && !loading) {
      load(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enriched = useMemo<EnrichedRecord[]>(() => {
    if (!payload?.all) return [];
    return payload.all.map((r) => {
      const match = rosterMap.get(normalizeName(r.player_name));
      const tricode = match?.team
        ? tricodeFromTeamString(match.team)
        : tricodeFromTeamString(r.team_abbr || r.team);
      return {
        ...r,
        player_id: match?.id ?? null,
        pos: match?.pos ?? null,
        fc_bc: match?.fc_bc ?? null,
        photo: match?.photo ?? null,
        team_tricode: tricode,
        team_full_name: fullNameFromTricode(tricode),
        on_roster: !!match,
      };
    });
  }, [payload, rosterMap]);

  // Apply "My Roster only" filter to whole dataset (affects counts too)
  const filteredAll = useMemo<EnrichedRecord[]>(() => {
    if (!myRosterOnly) return enriched;
    return enriched.filter((r) => r.player_id != null && rosterIds.has(r.player_id));
  }, [enriched, myRosterOnly, rosterIds]);

  // Group by tricode (built from filtered set so badges reflect filter)
  const groups = useMemo(() => {
    const m = new Map<string, EnrichedRecord[]>();
    for (const rec of filteredAll) {
      const key = rec.team_tricode || "UNK";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(rec);
    }
    const arr = Array.from(m.entries()).map(([tricode, items]) => ({
      tricode,
      fullName: fullNameFromTricode(tricode),
      items,
    }));
    arr.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return arr;
  }, [filteredAll]);

  // If the currently selected team no longer exists in groups (e.g. filter removed it), reset to all
  useEffect(() => {
    if (view !== "all" && !groups.some((g) => g.tricode === view)) {
      setView("all");
    }
  }, [groups, view]);

  const updatedLabel = payload?.generated_at ? `Updated ${relativeTime(payload.generated_at)}` : "";

  const visibleItems =
    view === "all" ? filteredAll : groups.find((g) => g.tricode === view)?.items ?? [];

  const statusCounts = useMemo(() => {
    const counts = { Out: 0, "Day-To-Day": 0, Questionable: 0, Probable: 0 } as Record<string, number>;
    for (const r of visibleItems) {
      if (r.status in counts) counts[r.status]++;
    }
    return counts;
  }, [visibleItems]);

  const finalItems = useMemo(
    () => (statusFilter === "all" ? visibleItems : visibleItems.filter((r) => r.status === statusFilter)),
    [visibleItems, statusFilter],
  );

  const STATUS_CHIPS: { key: "all" | "Out" | "Day-To-Day" | "Questionable" | "Probable"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Out", label: "Out" },
    { key: "Day-To-Day", label: "Day-To-Day" },
    { key: "Questionable", label: "Questionable" },
    { key: "Probable", label: "Probable" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none sm:w-full sm:max-w-3xl sm:h-[80vh] sm:max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-none sm:rounded-lg">
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Shield className="h-5 w-5 text-accent" />
              INJURY REPORT
            </DialogTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Switch
                  checked={myRosterOnly}
                  onCheckedChange={setMyRosterOnly}
                  aria-label="My roster only"
                />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
                  My Roster only
                </span>
              </label>
              {updatedLabel && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
                  {updatedLabel}
                </span>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => load(true)}
                disabled={loading}
                aria-label="Refresh injury report"
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
          {updatedLabel && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground sm:hidden">
              {updatedLabel}
            </span>
          )}
        </DialogHeader>

        <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
          {/* NBA logo watermark */}
          <img
            src={nbaLogo}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto w-1/4 max-w-[140px] opacity-[0.035]"
          />

          {loading && !payload && (
            <div className="relative flex-1 overflow-y-auto p-5 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="relative flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-semibold">Could not load injury report</p>
              <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
              <Button size="sm" onClick={() => load(true)}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
            </div>
          )}

          {!loading && !error && payload && (
            <>
              {/* ALL | Team dropdown header bar (sticky-ish, equal widths) */}
              <div className="px-3 pt-3 pb-2 shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-sm relative z-20">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 max-w-xl mx-auto w-full">
                  <button
                    type="button"
                    onClick={() => setView("all")}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md font-heading text-[11px] uppercase tracking-wider transition-colors",
                      view === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    All
                    <Badge variant="destructive" className="px-1.5 h-4 text-[9px] leading-none rounded-md">
                      {filteredAll.length}
                    </Badge>
                  </button>

                  <span className="text-border select-none" aria-hidden="true">|</span>

                  <Select
                    value={view === "all" ? "" : view}
                    onValueChange={(v) => setView(v)}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No teams</div>
                      )}
                      {groups.map((g) => {
                        const team = getTeamByTricode(g.tricode);
                        return (
                          <SelectItem key={g.tricode} value={g.tricode}>
                            <div className="flex items-center gap-2">
                              {team?.logo && (
                                <img src={team.logo} alt="" className="h-5 w-5 object-contain" />
                              )}
                              <span className="text-xs">{g.fullName}</span>
                              <Badge
                                variant="destructive"
                                className="ml-auto px-1.5 h-4 text-[9px] leading-none rounded-md"
                              >
                                {g.items.length}
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status filter chips */}
                <div className="flex items-center justify-center flex-wrap gap-1.5 mt-2">
                  {STATUS_CHIPS.map((chip) => {
                    const isActive = statusFilter === chip.key;
                    const count = chip.key === "all" ? visibleItems.length : statusCounts[chip.key] ?? 0;
                    const colorCls =
                      chip.key === "all"
                        ? isActive
                          ? "bg-primary text-primary-foreground ring-1 ring-primary"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                        : isActive
                          ? cn(statusClasses(chip.key), "ring-2 ring-offset-1 ring-foreground/30")
                          : cn(statusClasses(chip.key), "opacity-50 hover:opacity-100");
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setStatusFilter(chip.key)}
                        className={cn(
                          "h-6 px-2 inline-flex items-center gap-1 text-[10px] font-heading uppercase tracking-wider rounded-md transition-all",
                          colorCls,
                        )}
                      >
                        {chip.label}
                        <span className="text-[9px] font-mono opacity-90">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-h-[60vh] sm:min-h-[60vh] overflow-y-auto overscroll-contain px-3 pb-4 pt-2 relative">
                <InjuryList
                  items={finalItems}
                  myRosterOnly={myRosterOnly}
                  onSelect={(id) => setOpenPlayerId(id)}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <PlayerModal
        playerId={openPlayerId}
        open={openPlayerId !== null}
        onOpenChange={(o) => !o && setOpenPlayerId(null)}
      />
    </Dialog>
  );
}

function InjuryList({
  items,
  myRosterOnly,
  onSelect,
}: {
  items: EnrichedRecord[];
  myRosterOnly: boolean;
  onSelect: (id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <CheckCircle2 className="h-7 w-7 text-green-600" />
        <p className="text-sm">
          {myRosterOnly ? "No injuries on your roster" : "No reported injuries"}
        </p>
      </div>
    );
  }
  return (
    <TooltipProvider delayDuration={150}>
      <ul className="divide-y divide-border/60">
        {items.map((rec, idx) => (
          <InjuryRow key={`${rec.player_name}-${idx}`} rec={rec} onSelect={onSelect} />
        ))}
      </ul>
    </TooltipProvider>
  );
}

function InjuryRow({ rec, onSelect }: { rec: EnrichedRecord; onSelect: (id: number) => void }) {
  const ret = formatReturn(rec.estimated_return);
  const injury = truncate(rec.injury_type || "—", 40);
  const team = getTeamByTricode(rec.team_tricode);
  const initials = rec.player_name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const clickable = rec.on_roster && rec.player_id != null;

  const handleClick = () => {
    if (clickable && rec.player_id != null) onSelect(rec.player_id);
  };

  return (
    <li
      className={cn(
        "group relative flex items-center gap-2 py-2.5 px-1 text-xs rounded-sm overflow-hidden",
        clickable && "cursor-pointer hover:bg-muted/40 transition-colors",
      )}
      onClick={handleClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Player photo as centered watermark */}
      {rec.photo && (
        <img
          src={rec.photo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-12 w-12 object-cover rounded-full opacity-[0.06] group-hover:opacity-[0.18] group-hover:scale-110 transition-all duration-300"
        />
      )}

      <span
        className={cn(
          "relative z-10 inline-flex items-center justify-center px-2 h-5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
          statusClasses(rec.status),
        )}
      >
        {rec.status}
      </span>

      {/* Team badge — moved next to status */}
      {team?.logo ? (
        <img
          src={team.logo}
          alt={team.tricode}
          className="relative z-10 h-7 w-7 object-contain shrink-0 transition-transform duration-200 group-hover:scale-110"
        />
      ) : (
        <span className="relative z-10 h-7 w-7 shrink-0" aria-hidden="true" />
      )}

      <span
        className={cn(
          "relative z-10 font-heading font-bold whitespace-nowrap shrink-0",
          !rec.on_roster && "text-muted-foreground italic",
        )}
      >
        {rec.player_name}
        {!rec.on_roster && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">[Not on roster]</span>
        )}
      </span>

      {rec.on_roster && rec.pos && (
        <Badge variant="outline" className="relative z-10 h-4 px-1 text-[9px] rounded-md shrink-0 bg-background/70">
          {rec.pos}
        </Badge>
      )}

      <span className="relative z-10 text-muted-foreground shrink-0">·</span>
      <span className="relative z-10 text-foreground/80 truncate flex-1 min-w-0 text-right" title={rec.injury_type}>
        {injury}
      </span>

      <span
        className={cn(
          "relative z-10 shrink-0 font-mono text-[11px]",
          dateColorClass(ret),
        )}
      >
        {ret.label}
      </span>

      {rec.notes && rec.notes.trim().length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Show notes"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs">
            {rec.notes}
          </TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}
