import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, RefreshCw, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAMS, getTeamByTricode } from "@/lib/nba-teams";
import nbaLogo from "@/assets/nba-logo.svg";
import { cn } from "@/lib/utils";

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
  // exact tricode hit
  const exact = NBA_TEAMS.find((t) => t.tricode === upper);
  if (exact) return exact.tricode;
  // full or partial name hit
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

function formatReturn(raw: string | null): { label: string; isSeasonEnd: boolean; isTbd: boolean } {
  if (!raw) return { label: "TBD", isSeasonEnd: false, isTbd: true };
  const trimmed = raw.trim();
  if (!trimmed) return { label: "TBD", isSeasonEnd: false, isTbd: true };
  if (/season-?ending/i.test(trimmed)) return { label: "Season-ending", isSeasonEnd: true, isTbd: false };
  if (/next season/i.test(trimmed)) return { label: "Next Season", isSeasonEnd: true, isTbd: false };
  // try ISO
  const iso = parseISO(trimmed);
  if (isValid(iso)) return { label: format(iso, "MMM d"), isSeasonEnd: false, isTbd: false };
  // try Date()
  const d = new Date(trimmed);
  if (isValid(d) && !isNaN(d.getTime())) return { label: format(d, "MMM d"), isSeasonEnd: false, isTbd: false };
  return { label: trimmed, isSeasonEnd: false, isTbd: false };
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (e: any) {
      setError(e?.message ?? "Failed to load injury report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !payload && !loading) {
      load();
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

  // Group by tricode and build sorted tab list
  const groups = useMemo(() => {
    const m = new Map<string, EnrichedRecord[]>();
    for (const rec of enriched) {
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
  }, [enriched]);

  const updatedLabel = payload?.generated_at ? `Updated ${relativeTime(payload.generated_at)}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none sm:w-full sm:max-w-3xl sm:h-auto sm:max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-none sm:rounded-lg">
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Shield className="h-5 w-5 text-accent" />
              INJURY REPORT
            </DialogTitle>
            <div className="flex items-center gap-2">
              {updatedLabel && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
                  {updatedLabel}
                </span>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={load}
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

        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* NBA logo watermark */}
          <img
            src={nbaLogo}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto w-1/2 max-w-[260px] opacity-[0.04]"
          />

          {loading && !payload && (
            <div className="relative h-full overflow-y-auto p-5 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="relative h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-semibold">Could not load injury report</p>
              <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
              <Button size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
            </div>
          )}

          {!loading && !error && payload && (
            <Tabs defaultValue="__all" className="relative h-full flex flex-col">
              <div className="px-3 pt-3 shrink-0 overflow-x-auto">
                <TabsList className="inline-flex h-9 w-max gap-1 bg-muted/60">
                  <TabsTrigger value="__all" className="font-heading text-[10px] uppercase rounded-md px-2 h-7">
                    All
                    <Badge variant="destructive" className="ml-1.5 px-1.5 h-4 text-[9px] leading-none rounded-md">
                      {enriched.length}
                    </Badge>
                  </TabsTrigger>
                  {groups.map((g) => (
                    <TabsTrigger
                      key={g.tricode}
                      value={g.tricode}
                      className="font-heading text-[10px] uppercase rounded-md px-2 h-7"
                    >
                      {g.tricode}
                      <Badge variant="destructive" className="ml-1.5 px-1.5 h-4 text-[9px] leading-none rounded-md">
                        {g.items.length}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 pt-2">
                <TabsContent value="__all" className="mt-0">
                  <InjuryList items={enriched} />
                </TabsContent>
                {groups.map((g) => (
                  <TabsContent key={g.tricode} value={g.tricode} className="mt-0">
                    <InjuryList items={g.items} />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InjuryList({ items }: { items: EnrichedRecord[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <CheckCircle2 className="h-7 w-7 text-green-600" />
        <p className="text-sm">No reported injuries</p>
      </div>
    );
  }
  return (
    <TooltipProvider delayDuration={150}>
      <ul className="divide-y divide-border/60">
        {items.map((rec, idx) => (
          <InjuryRow key={`${rec.player_name}-${idx}`} rec={rec} />
        ))}
      </ul>
    </TooltipProvider>
  );
}

function InjuryRow({ rec }: { rec: EnrichedRecord }) {
  const ret = formatReturn(rec.estimated_return);
  const injury = truncate(rec.injury_type || "—", 40);

  return (
    <li className="flex items-center gap-2 py-2 text-xs">
      <span
        className={cn(
          "inline-flex items-center justify-center px-2 h-5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
          statusClasses(rec.status),
        )}
      >
        {rec.status}
      </span>

      <span
        className={cn(
          "font-heading font-bold whitespace-nowrap",
          !rec.on_roster && "text-muted-foreground italic",
        )}
      >
        {rec.player_name}
        {!rec.on_roster && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">[Not on roster]</span>
        )}
      </span>

      {rec.on_roster && rec.pos && (
        <Badge variant="outline" className="h-4 px-1 text-[9px] rounded-md shrink-0">
          {rec.pos}
        </Badge>
      )}

      <span className="text-muted-foreground shrink-0">·</span>
      <span className="text-foreground/80 truncate min-w-0" title={rec.injury_type}>
        {injury}
      </span>

      <span className="text-muted-foreground shrink-0">·</span>
      <span
        className={cn(
          "shrink-0 ml-auto font-mono text-[11px]",
          ret.isSeasonEnd && "text-destructive font-semibold",
          ret.isTbd && "text-muted-foreground",
        )}
      >
        {ret.label}
      </span>

      {rec.notes && rec.notes.trim().length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
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