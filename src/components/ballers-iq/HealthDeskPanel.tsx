import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield, RefreshCw, Activity, Radar, AlertTriangle, CheckCircle2, Filter, Users, CalendarDays, Info, Heart, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { useQueryClient } from "@tanstack/react-query";
import PlayerModal from "@/components/PlayerModal";
import { getLeagueLogo } from "@/lib/competitions";
import { cn } from "@/lib/utils";
import {
  readInjuryCache, writeInjuryCache, normalizeName, tricodeFromTeamString,
  fullNameFromTricode, statusClasses, bucketRecord, formatReturn, dateColorClass,
  cleanInjuryNotes, relativeTime, truncate,
  type InjuryPayload, type EnrichedRecord,
} from "@/lib/injury-report";

type StatusBucket = "all" | "Out" | "Day-To-Day" | "Questionable" | "Probable";

const STATUS_CHIPS: { key: StatusBucket; label: string; tone: string }[] = [
  { key: "all",          label: "All",          tone: "bg-white/8 text-white/85 border-white/15" },
  { key: "Out",          label: "Out",          tone: "bg-destructive/20 text-red-200 border-red-500/40" },
  { key: "Day-To-Day",   label: "DTD",          tone: "bg-orange-500/15 text-orange-200 border-orange-500/40" },
  { key: "Questionable", label: "Questionable", tone: "bg-yellow-400/15 text-yellow-200 border-yellow-400/40" },
  { key: "Probable",     label: "Probable",     tone: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40" },
];

function GlassPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "relative rounded-xl border border-white/10 bg-black/45 backdrop-blur-xl",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_60px_-30px_rgba(0,0,0,0.9)]",
      className,
    )}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-heading font-bold uppercase tracking-[0.22em] text-amber-100/80">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

export default function HealthDeskPanel() {
  const { teams: LEAGUE_TEAMS } = useLeagueTeams();
  const { isWnba, league } = useLeague();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InjuryPayload | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [rosterMap, setRosterMap] = useState<Map<string, { id: number; team: string; pos: string | null; fc_bc: string; photo: string | null }>>(new Map());
  const [myRosterOnly, setMyRosterOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusBucket>("all");
  const [teamFilter, setTeamFilter] = useState<string | "all">("all");
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);

  const { data: rosterData } = useRosterQuery();
  const rosterIds = useMemo(() => {
    const set = new Set<number>();
    const r: any = (rosterData as any)?.roster ?? rosterData;
    const collect = (arr: any) => {
      if (!Array.isArray(arr)) return;
      for (const s of arr) {
        const pid = typeof s === "number" ? s : (s?.player_id ?? s?.player?.id ?? s?.id);
        if (typeof pid === "number" && pid > 0) set.add(pid);
      }
    };
    if (r) {
      collect(r.starters); collect(r.bench); collect(r.slots);
      if (typeof r.captain_id === "number" && r.captain_id > 0) set.add(r.captain_id);
    }
    return set;
  }, [rosterData]);

  // Hydrate from cache silently on mount (no auto-fetch — user-driven).
  useEffect(() => {
    const cached = readInjuryCache();
    if (cached) {
      setPayload(cached.payload);
      setCachedAt(cached.savedAt);
      void hydratePlayers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydratePlayers = useCallback(async () => {
    const { data: playersRows } = await supabase.from("players").select("id, name, team, pos, fc_bc, photo");
    const map = new Map<string, { id: number; team: string; pos: string | null; fc_bc: string; photo: string | null }>();
    (playersRows ?? []).forEach((p: any) => {
      if (!p?.name) return;
      map.set(normalizeName(p.name), {
        id: p.id, team: p.team, pos: p.pos ?? null, fc_bc: p.fc_bc, photo: p.photo ?? null,
      });
    });
    setRosterMap(map);
  }, []);

  const load = useCallback(async (force = false) => {
    setError(null);
    if (!force) {
      const cached = readInjuryCache();
      if (cached) {
        setPayload(cached.payload);
        setCachedAt(cached.savedAt);
        await hydratePlayers();
        return;
      }
    }
    setLoading(true);
    try {
      const fnName =
        league === "euroleague" ? "euroleague-injury-report"
        : isWnba ? "wnba-injury-report"
        : "nba-injury-report";
      const [{ data: injuryData, error: fnErr }, { data: playersRows, error: pErr }] = await Promise.all([
        supabase.functions.invoke(fnName),
        supabase.from("players").select("id, name, team, pos, fc_bc, photo"),
      ]);
      if (fnErr) throw new Error(fnErr.message ?? "Failed to fetch injuries");
      if (pErr) throw new Error(pErr.message ?? "Failed to fetch players");

      const map = new Map<string, { id: number; team: string; pos: string | null; fc_bc: string; photo: string | null }>();
      (playersRows ?? []).forEach((p: any) => {
        if (!p?.name) return;
        map.set(normalizeName(p.name), {
          id: p.id, team: p.team, pos: p.pos ?? null, fc_bc: p.fc_bc, photo: p.photo ?? null,
        });
      });
      setRosterMap(map);
      setPayload(injuryData as InjuryPayload);
      setCachedAt(Date.now());
      writeInjuryCache(injuryData as InjuryPayload);
      const persisted = (injuryData as any)?.persisted;
      if (!persisted || persisted.matched > 0 || persisted.cleared > 0) {
        queryClient.invalidateQueries({ queryKey: ["players"] });
        queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load injury report");
    } finally {
      setLoading(false);
    }
  }, [isWnba, league, queryClient, hydratePlayers]);

  const enriched = useMemo<EnrichedRecord[]>(() => {
    if (!payload?.all) return [];
    return payload.all.map((r) => {
      const match = rosterMap.get(normalizeName(r.player_name));
      const tricode = match?.team
        ? tricodeFromTeamString(match.team, LEAGUE_TEAMS)
        : tricodeFromTeamString(r.team_abbr || r.team, LEAGUE_TEAMS);
      return {
        ...r,
        player_id: match?.id ?? null,
        pos: match?.pos ?? null,
        fc_bc: match?.fc_bc ?? null,
        photo: match?.photo ?? null,
        team_tricode: tricode,
        team_full_name: fullNameFromTricode(tricode, LEAGUE_TEAMS),
        on_roster: !!match,
      };
    });
  }, [payload, rosterMap, LEAGUE_TEAMS]);

  const filteredAll = useMemo<EnrichedRecord[]>(() => {
    if (!myRosterOnly) return enriched;
    return enriched.filter((r) => r.player_id != null && rosterIds.has(r.player_id));
  }, [enriched, myRosterOnly, rosterIds]);

  const teamGroups = useMemo(() => {
    const m = new Map<string, EnrichedRecord[]>();
    for (const rec of filteredAll) {
      const key = rec.team_tricode || "UNK";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(rec);
    }
    return Array.from(m.entries())
      .map(([tricode, items]) => ({ tricode, fullName: fullNameFromTricode(tricode, LEAGUE_TEAMS), items }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [filteredAll, LEAGUE_TEAMS]);

  const teamFiltered = useMemo(
    () => teamFilter === "all" ? filteredAll : filteredAll.filter((r) => r.team_tricode === teamFilter),
    [filteredAll, teamFilter],
  );

  const statusCounts = useMemo(() => {
    const counts = { Out: 0, "Day-To-Day": 0, Questionable: 0, Probable: 0 } as Record<string, number>;
    for (const r of teamFiltered) { const b = bucketRecord(r); if (b) counts[b]++; }
    return counts;
  }, [teamFiltered]);

  const items = useMemo(
    () => statusFilter === "all" ? teamFiltered : teamFiltered.filter((r) => bucketRecord(r) === statusFilter),
    [teamFiltered, statusFilter],
  );

  // Roster exposure
  const rosterAffected = useMemo(
    () => enriched.filter((r) => r.player_id != null && rosterIds.has(r.player_id)),
    [enriched, rosterIds],
  );
  const rosterOuts = rosterAffected.filter((r) => bucketRecord(r) === "Out").length;
  const rosterDTD  = rosterAffected.filter((r) => bucketRecord(r) === "Day-To-Day").length;
  const rosterRiskLevel: "low" | "moderate" | "high" =
    rosterOuts >= 2 ? "high" : rosterOuts + rosterDTD >= 2 ? "moderate" : "low";

  const leagueLogo = getLeagueLogo(league);
  const updatedLabel = payload?.generated_at ? `Updated ${relativeTime(payload.generated_at)}` : "";
  const cachedLabel = cachedAt ? `Cached ${relativeTime(new Date(cachedAt).toISOString())}` : "Not scanned yet";
  const leagueLabel = league === "euroleague" ? "EuroLeague" : isWnba ? "WNBA" : "NBA";

  /* -------------------- 1) PRE-SCAN STATE -------------------- */
  if (!payload && !loading && !error) {
    return (
      <div className="grid gap-3 md:grid-cols-12">
        {/* LEFT — Hero scanner */}
        <GlassPanel className="md:col-span-5 p-5 md:p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-full border border-amber-400/30" />
              <div className="absolute inset-2 rounded-full border border-amber-400/20" />
              <div className="absolute inset-4 rounded-full border border-amber-400/15" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="h-14 w-14 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.55)]" />
              </div>
              <div className="absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent,rgba(252,211,77,0.18),transparent_55%)] animate-spin" style={{ animationDuration: "5s" }} />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-xl md:text-2xl uppercase tracking-[0.18em] text-white">Scan Latest Injury Report</h3>
              <p className="text-[12px] text-white/65 max-w-[34ch] mx-auto">
                Fetch the latest availability updates before lineup lock.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              <Button
                size="lg"
                onClick={() => load(false)}
                className="w-full bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 shadow-[0_0_24px_-6px_rgba(252,211,77,0.7)] font-heading uppercase tracking-[0.18em]"
              >
                <Radar className="h-4 w-4 mr-2" /> Scan Injury Report
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => load(true)}
                className="w-full bg-transparent border-white/15 text-white/80 hover:text-white hover:bg-white/[0.05]"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" /> Force Refresh
              </Button>
              <label className="mt-1 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 cursor-pointer">
                <span className="text-[11px] font-heading uppercase tracking-[0.18em] text-white/80">My Roster only</span>
                <Switch checked={myRosterOnly} onCheckedChange={setMyRosterOnly} />
              </label>
              <p className="text-[10px] text-white/45 text-center">Reports are cached for 30 minutes to reduce API load.</p>
            </div>
          </div>
        </GlassPanel>

        {/* CENTER — What this scan checks */}
        <GlassPanel className="md:col-span-4 p-5">
          <SectionLabel icon={Activity}>What this scan checks</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Out",              cls: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-200" },
              { label: "Day-To-Day",       cls: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-200" },
              { label: "Questionable",     cls: "from-yellow-400/20 to-yellow-400/5 border-yellow-400/30 text-yellow-200" },
              { label: "Probable",         cls: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-200" },
              { label: "Estimated Return", cls: "from-sky-500/20 to-sky-500/5 border-sky-500/30 text-sky-200" },
              { label: "Source Notes",     cls: "from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-200" },
            ].map((c) => (
              <div key={c.label} className={cn("rounded-lg border bg-gradient-to-b px-3 py-2.5 text-[10.5px] font-heading uppercase tracking-[0.16em]", c.cls)}>
                {c.label}
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* RIGHT — Report settings */}
        <GlassPanel className="md:col-span-3 p-5">
          <SectionLabel icon={Info}>Report Settings</SectionLabel>
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-3 py-2">
              {leagueLogo && <img src={leagueLogo} alt="" className="h-6 w-6 object-contain" />}
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-[0.2em] text-amber-100/70 font-heading">Active League</div>
                <div className="text-sm font-heading font-bold text-amber-50">{leagueLabel}</div>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/55 font-heading">Last Cache</div>
              <div className="text-[12px] text-white/85">{cachedLabel}</div>
            </div>
            <div className="space-y-1.5">
              {(["NBA feed","WNBA feed","EuroLeague feed"] as const).map((src) => {
                const isActive =
                  (src === "NBA feed" && leagueLabel === "NBA") ||
                  (src === "WNBA feed" && leagueLabel === "WNBA") ||
                  (src === "EuroLeague feed" && leagueLabel === "EuroLeague");
                return (
                  <div key={src} className="flex items-center justify-between text-[11px]">
                    <span className="text-white/70">{src}</span>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[9px] font-heading uppercase tracking-[0.18em]",
                      isActive ? "text-emerald-300" : "text-white/35",
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-400 animate-pulse" : "bg-white/25")} />
                      {isActive ? "Online" : "Idle"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-white/45">Auto-refresh disabled — manual scan only.</p>
          </div>
        </GlassPanel>

        {/* BOTTOM — After the scan */}
        <GlassPanel className="md:col-span-12 p-5">
          <SectionLabel icon={Newspaper}>After the scan, you will see</SectionLabel>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { icon: Heart,        label: "Injury List" },
              { icon: Filter,       label: "Team Filters" },
              { icon: AlertTriangle,label: "Status Chips" },
              { icon: Info,         label: "Source Notes" },
              { icon: Users,        label: "Roster Impact" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-amber-300/80" />
                <span className="text-[11px] font-heading uppercase tracking-[0.16em] text-white/75">{label}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    );
  }

  /* -------------------- 2) SCANNING STATE -------------------- */
  if (loading) {
    return (
      <GlassPanel className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative w-28 h-28">
            <div className="absolute inset-0 rounded-full border border-amber-400/30 animate-ping" />
            <div className="absolute inset-3 rounded-full border border-amber-400/40 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Radar className="h-12 w-12 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.6)]" />
            </div>
          </div>
          <div>
            <h3 className="font-heading text-lg uppercase tracking-[0.2em] text-amber-100">Fetching latest injury report…</h3>
            <p className="text-[11px] text-white/55 mt-1">Pinging sources and cross-matching your roster.</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-heading uppercase tracking-[0.2em]">
            {[
              { name: "NBA feed",        active: leagueLabel === "NBA" },
              { name: "WNBA feed",       active: leagueLabel === "WNBA" },
              { name: "EuroLeague feed", active: leagueLabel === "EuroLeague" },
            ].map((s) => (
              <span key={s.name} className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                s.active
                  ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-white/40",
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", s.active ? "bg-emerald-400 animate-pulse" : "bg-white/25")} />
                {s.name}
              </span>
            ))}
          </div>
          <div className="w-full mt-2 space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md bg-white/5" />
            ))}
          </div>
        </div>
      </GlassPanel>
    );
  }

  /* -------------------- ERROR STATE -------------------- */
  if (error) {
    return (
      <GlassPanel className="p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="mt-2 text-sm font-semibold text-white">Could not load injury report</p>
        <p className="text-xs text-white/60 max-w-md mx-auto mt-1">{error}</p>
        <Button size="sm" onClick={() => load(true)} className="mt-3">
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
        </Button>
      </GlassPanel>
    );
  }

  /* -------------------- 3) REPORT GENERATED STATE -------------------- */
  const riskTone =
    rosterRiskLevel === "high" ? "from-red-500/30 to-red-500/5 border-red-500/40 text-red-100"
    : rosterRiskLevel === "moderate" ? "from-yellow-400/30 to-yellow-400/5 border-yellow-400/40 text-yellow-100"
    : "from-emerald-500/25 to-emerald-500/5 border-emerald-500/40 text-emerald-100";
  const riskLabel = rosterRiskLevel === "high" ? "High Risk" : rosterRiskLevel === "moderate" ? "Moderate Risk" : "Low Risk";

  const teamsOnRoster = new Set(rosterAffected.map((r) => r.team_tricode));

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="grid gap-3 md:grid-cols-12 flex-1 min-h-0">
        {/* LEFT — Main Injury Board */}
        <GlassPanel className="md:col-span-8 p-0 flex flex-col min-h-0 overflow-hidden">
          {/* Sticky header inside the panel */}
          <div className="shrink-0 p-4 pb-3 border-b border-white/8 bg-black/30">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <SectionLabel icon={Shield}>Main Injury Board</SectionLabel>
              <div className="flex items-center gap-2">
                <label className="hidden sm:flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-2.5 py-1 cursor-pointer">
                  <Switch checked={myRosterOnly} onCheckedChange={setMyRosterOnly} />
                  <span className="text-[10px] uppercase tracking-[0.18em] font-heading text-white/85">My Roster only</span>
                </label>
                <Button size="sm" variant="outline" onClick={() => load(true)} disabled={loading} className="h-7 bg-black/30 border-white/15 text-white/85 hover:bg-white/[0.06]">
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} /> Refresh
                </Button>
                <span className="hidden md:inline text-[10px] font-heading uppercase tracking-[0.18em] text-white/55">
                  {items.length} {items.length === 1 ? "entry" : "entries"} · {updatedLabel}
                </span>
              </div>
            </div>

            {/* Row: status chips (left) + team dropdown (right) */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_CHIPS.map((chip) => {
                  const count = chip.key === "all" ? teamFiltered.length : statusCounts[chip.key] ?? 0;
                  const isActive = statusFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setStatusFilter(chip.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-heading uppercase tracking-[0.16em] text-[10px] transition-all",
                        chip.tone,
                        isActive ? "ring-1 ring-amber-300/60 shadow-[0_0_14px_-4px_rgba(252,211,77,0.6)]" : "opacity-70 hover:opacity-100",
                      )}
                    >
                      {chip.label}
                      <span className="text-[9px] font-mono opacity-80">{count}</span>
                    </button>
                  );
                })}
              </div>

              <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v as any)}>
                <SelectTrigger className="h-7 w-[180px] text-[11px] bg-black/40 border-white/15 text-white/85">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="text-xs">All Teams</span>
                  </SelectItem>
                  {teamGroups.map((g) => {
                    const team = LEAGUE_TEAMS.find((t) => t.tricode === g.tricode);
                    return (
                      <SelectItem key={g.tricode} value={g.tricode}>
                        <div className="flex items-center gap-2">
                          {team?.logo && <img src={team.logo} alt="" className="h-4 w-4 object-contain" />}
                          <span className="text-xs">{g.fullName}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground">({g.items.length})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
            <TooltipProvider delayDuration={150}>
              <ul className="divide-y divide-white/5">
                {items.length === 0 && (
                  <li className="py-10 flex flex-col items-center justify-center gap-2 text-white/55">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    <p className="text-sm">{myRosterOnly ? "No injuries on your roster" : "No reported injuries"}</p>
                  </li>
                )}
                {items.map((rec, idx) => (
                  <InjuryRow key={`${rec.player_name}-${idx}`} rec={rec} onSelect={(id) => setOpenPlayerId(id)} />
                ))}
              </ul>
            </TooltipProvider>
          </div>
        </GlassPanel>

        {/* RIGHT — Roster Exposure */}
        <GlassPanel className="md:col-span-4 p-4 overflow-y-auto min-h-0">
          <SectionLabel icon={Users}>Roster Exposure</SectionLabel>
          {rosterAffected.length === 0 ? (
            <div className="mt-4 flex flex-col items-center text-center gap-2 py-6">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              <p className="text-sm text-white/75">Your roster is clean.</p>
              <p className="text-[11px] text-white/45">No flagged availability concerns.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-white/55 font-heading">Players</div>
                  <div className="text-base font-heading font-bold text-white">{rosterAffected.length}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-white/55 font-heading">Teams</div>
                  <div className="text-base font-heading font-bold text-white">{teamsOnRoster.size}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-white/55 font-heading">Out</div>
                  <div className="text-base font-heading font-bold text-red-300">{rosterOuts}</div>
                </div>
              </div>
              <ul className="space-y-1.5">
                {rosterAffected.slice(0, 8).map((r, i) => {
                  const team = LEAGUE_TEAMS.find((t) => t.tricode === r.team_tricode);
                  return (
                    <li
                      key={`${r.player_name}-${i}`}
                      onClick={() => r.player_id && setOpenPlayerId(r.player_id)}
                      className="group flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 cursor-pointer hover:bg-white/[0.06] transition-colors"
                    >
                      {team?.logo && <img src={team.logo} alt="" className="h-5 w-5 object-contain shrink-0" />}
                      <span className="text-[11px] text-white/90 font-heading truncate flex-1">{r.player_name}</span>
                      <span className={cn("inline-flex items-center px-1.5 h-4 rounded text-[8.5px] font-bold uppercase tracking-wider", statusClasses(r.status))}>
                        {r.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {rosterAffected.length > 8 && (
                <p className="text-[10px] text-white/45 text-center">+ {rosterAffected.length - 8} more</p>
              )}
              <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-[10px] text-white/55">
                <CalendarDays className="h-3 w-3" />
                <span>Check next games for these players.</span>
              </div>
            </div>
          )}
        </GlassPanel>

      </div>

      {/* BOTTOM — Notes / Sources (sticky pinned) */}
      <GlassPanel className="shrink-0 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SectionLabel icon={Newspaper}>News · Notes · Impact</SectionLabel>
            <div className="text-[10px] font-heading uppercase tracking-[0.18em] text-white/55">
              {payload?.sources_failed && payload.sources_failed.length > 0
                ? <span className="text-red-300">Sources failed: {payload.sources_failed.join(", ")}</span>
                : <span className="text-emerald-300">All sources online</span>}
              {cachedAt && <span className="ml-3 text-white/45">{cachedLabel}</span>}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.slice(0, 6).map((r, i) => {
              const cleaned = cleanInjuryNotes(r.notes, r.player_name);
              if (!cleaned) return null;
              return (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("inline-flex items-center px-1.5 h-4 rounded text-[8.5px] font-bold uppercase tracking-wider", statusClasses(r.status))}>
                      {r.status}
                    </span>
                    <span className="text-[11px] font-heading font-bold text-white">{r.player_name}</span>
                    <span className="text-[10px] text-white/45">{r.team_tricode}</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">{truncate(cleaned, 160)}</p>
                  {r.source && <div className="mt-1 text-[9px] text-white/40">Source: {r.source}</div>}
                </div>
              );
            })}
            {items.every((r) => !cleanInjuryNotes(r.notes, r.player_name)) && (
              <p className="text-[11px] text-white/45 italic">No source notes available for current selection.</p>
            )}
          </div>
        </GlassPanel>

      <PlayerModal
        playerId={openPlayerId}
        open={openPlayerId !== null}
        onOpenChange={(o) => !o && setOpenPlayerId(null)}
      />
    </div>
  );
}

function InjuryRow({ rec, onSelect }: { rec: EnrichedRecord; onSelect: (id: number) => void }) {
  const { teams: LEAGUE_TEAMS } = useLeagueTeams();
  const { league } = useLeague();
  const ret = formatReturn(rec.estimated_return);
  const rawInjury = (rec.injury_type ?? "").trim();
  const safeInjury = !rawInjury || /^see\s*news$/i.test(rawInjury) ? "—" : rawInjury;
  const injury = truncate(safeInjury, 40);
  const team = LEAGUE_TEAMS.find((t) => t.tricode === rec.team_tricode);
  const clickable = rec.on_roster && rec.player_id != null;

  const handleClick = () => { if (clickable && rec.player_id != null) onSelect(rec.player_id); };

  return (
    <li
      className={cn(
        "group relative flex items-center gap-2 py-2.5 px-1 text-xs overflow-hidden rounded-md",
        clickable && "cursor-pointer hover:bg-white/[0.04] transition-colors",
      )}
      onClick={handleClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleClick(); }
      }}
    >
      {rec.photo && (
        <img
          src={rec.photo}
          alt=""
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-14 w-14 object-cover rounded-full opacity-[0.18] saturate-150 contrast-110 brightness-110 group-hover:opacity-[0.5] group-hover:scale-110 transition-all duration-300",
            league === "euroleague" && "object-top",
          )}
        />
      )}
      <span className={cn("relative z-10 inline-flex items-center justify-center px-2 h-5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0", statusClasses(rec.status))}>
        {rec.status}
      </span>
      {team?.logo ? (
        <img src={team.logo} alt={team.tricode} className="relative z-10 h-7 w-7 object-contain shrink-0 transition-transform duration-200 group-hover:scale-110" />
      ) : <span className="relative z-10 h-7 w-7 shrink-0" aria-hidden />}
      <span className={cn("relative z-10 font-heading font-bold whitespace-nowrap shrink-0 text-white/95", !rec.on_roster && "text-white/55 italic")}>
        {rec.player_name}
        {!rec.on_roster && <span className="ml-1 text-[10px] font-normal text-white/45">[Not on roster]</span>}
      </span>
      {rec.on_roster && rec.fc_bc && (
        <Badge variant={rec.fc_bc === "FC" ? "destructive" : "default"} className="relative z-10 h-4 px-1.5 text-[9px] rounded-md shrink-0">
          {rec.fc_bc}
        </Badge>
      )}
      <span className="relative z-10 text-white/35 shrink-0">·</span>
      <span className="relative z-10 text-white/75 truncate flex-1 min-w-0 text-right" title={rec.injury_type}>{injury}</span>
      <span className={cn("relative z-10 shrink-0 font-mono text-[11px]", dateColorClass(ret))}>{ret.label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={(e) => e.stopPropagation()} className="relative z-10 shrink-0 text-white/45 hover:text-white transition-colors" aria-label="Show injury details">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs space-y-1">
          <div className="font-heading uppercase tracking-wider text-[10px] text-muted-foreground">{rec.player_name} · {rec.team_tricode}</div>
          <div><span className="text-muted-foreground">Status:</span> {rec.status}</div>
          <div><span className="text-muted-foreground">Injury:</span> {rec.injury_type || "—"}</div>
          <div><span className="text-muted-foreground">ETR:</span> {ret.label}</div>
          {(() => {
            const cleaned = cleanInjuryNotes(rec.notes, rec.player_name);
            return cleaned.length > 0 ? <div className="pt-1 border-t border-border/40">{cleaned}</div> : null;
          })()}
          {rec.source && <div className="pt-1 text-[10px] text-muted-foreground/80">Source: {rec.source}</div>}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}