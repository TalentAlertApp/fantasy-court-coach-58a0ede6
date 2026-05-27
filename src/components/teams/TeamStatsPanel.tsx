import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import type { LeagueTeam } from "@/hooks/useLeagueTeams";
import NationalityFlag from "@/components/NationalityFlag";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Player = {
  core: { id: number; name: string; team: string; fc_bc: string; salary: number; photo: string | null; nationality?: string | null };
  season: { gp: number; fp: number; mpg: number };
  last5: { fp5: number; mpg5: number };
  computed: { value: number; value5: number };
};

type Category = "fantasy" | "efficiency" | "depth" | "schedule";

interface Props {
  leagueTeams: LeagueTeam[];
  players: Player[];
  leagueId: string | undefined;
  leagueLogo: string;
  loading: boolean;
  onTeamClick: (tricode: string) => void;
}

interface TeamAgg {
  tricode: string;
  name: string;
  logo: string;
  primaryColor: string;
  players: Player[];
  gp: number;
  wins: number;
  losses: number;
  fpg: number;
  fpg5: number;
  topPlayer: Player | null;
  fcFpg: number;
  bcFpg: number;
  fcCount: number;
  bcCount: number;
  activePlayers: number;
  salaryTotal: number;
  avgValue: number;
  bestValuePlayer: Player | null;
  top3Share: number;
  depthIndex: number;
}

function fmt(n: number, d = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

export default function TeamStatsPanel({ leagueTeams, players, leagueId, leagueLogo, loading, onTeamClick }: Props) {
  const [category, setCategory] = useState<Category>("fantasy");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Fetch schedule with tipoff + status for record + schedule category
  const { data: schedRows, isLoading: schedLoading } = useQuery({
    queryKey: ["team-stats-schedule", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("home_team, away_team, home_pts, away_pts, status, tipoff_utc, gw")
        .eq("league_id", leagueId!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 120_000,
  });

  const currentGw = useMemo(() => {
    if (!schedRows) return null;
    const now = Date.now();
    const future = schedRows
      .filter((g) => !String(g.status ?? "").toUpperCase().includes("FINAL"))
      .filter((g) => g.tipoff_utc && new Date(g.tipoff_utc).getTime() >= now - 6 * 3600_000)
      .sort((a, b) => new Date(a.tipoff_utc!).getTime() - new Date(b.tipoff_utc!).getTime());
    return future[0]?.gw ?? null;
  }, [schedRows]);

  const teamAggs = useMemo<TeamAgg[]>(() => {
    const byTeam: Record<string, Player[]> = {};
    for (const p of players ?? []) {
      const t = p.core.team;
      if (!t) continue;
      (byTeam[t] ??= []).push(p);
    }
    const records: Record<string, { w: number; l: number }> = {};
    for (const g of schedRows ?? []) {
      const isFinal = String(g.status ?? "").toUpperCase().includes("FINAL");
      if (!isFinal) continue;
      for (const t of [g.home_team, g.away_team]) {
        if (!t) continue;
        records[t] ??= { w: 0, l: 0 };
        const isHome = t === g.home_team;
        const won = isHome ? (g.home_pts ?? 0) > (g.away_pts ?? 0) : (g.away_pts ?? 0) > (g.home_pts ?? 0);
        if (won) records[t].w++; else records[t].l++;
      }
    }

    return leagueTeams.map((t) => {
      const list = byTeam[t.tricode] ?? [];
      const active = list.filter((p) => (p.season.fp ?? 0) > 0 || (p.season.mpg ?? 0) > 0);
      const fcs = list.filter((p) => p.core.fc_bc === "FC");
      const bcs = list.filter((p) => p.core.fc_bc === "BC");
      const sum = (arr: Player[], k: (p: Player) => number) => arr.reduce((s, p) => s + (Number(k(p)) || 0), 0);
      const fpg = sum(list, (p) => p.season.fp);
      const fpg5 = sum(list, (p) => p.last5.fp5);
      const topPlayer = list.reduce<Player | null>((best, p) => (!best || p.season.fp > best.season.fp ? p : best), null);
      const bestValuePlayer = list.reduce<Player | null>((best, p) => {
        const v = p.computed.value5 || p.computed.value;
        const bv = best ? best.computed.value5 || best.computed.value : -Infinity;
        return !best || v > bv ? p : best;
      }, null);
      const valueVals = list.map((p) => p.computed.value5 || p.computed.value).filter((v) => v > 0);
      const avgValue = valueVals.length ? valueVals.reduce((a, b) => a + b, 0) / valueVals.length : 0;
      const salaryTotal = sum(list, (p) => p.core.salary);
      const sortedFp = [...list].map((p) => p.season.fp).sort((a, b) => b - a);
      const top3 = sortedFp.slice(0, 3).reduce((a, b) => a + b, 0);
      const top3Share = fpg > 0 ? top3 / fpg : 0;
      const depthIndex = fpg > 0 ? 1 - top3Share : 0;
      const rec = records[t.tricode] ?? { w: 0, l: 0 };
      const gp = rec.w + rec.l;
      return {
        tricode: t.tricode,
        name: t.name,
        logo: t.logo,
        primaryColor: t.primaryColor,
        players: list,
        gp,
        wins: rec.w,
        losses: rec.l,
        fpg,
        fpg5,
        topPlayer,
        fcFpg: sum(fcs, (p) => p.season.fp),
        bcFpg: sum(bcs, (p) => p.season.fp),
        fcCount: fcs.length,
        bcCount: bcs.length,
        activePlayers: active.length,
        salaryTotal,
        avgValue,
        bestValuePlayer,
        top3Share,
        depthIndex,
      };
    });
  }, [leagueTeams, players, schedRows]);

  const scheduleStats = useMemo(() => {
    const map: Record<string, { upcoming: number; thisGw: number; next7: number; nextOpp: string | null; nextTipoff: string | null; nextScore: number; label: string }> = {};
    const now = Date.now();
    const week = now + 7 * 86400_000;
    for (const t of leagueTeams) {
      map[t.tricode] = { upcoming: 0, thisGw: 0, next7: 0, nextOpp: null, nextTipoff: null, nextScore: 0, label: "Light" };
    }
    const future = (schedRows ?? [])
      .filter((g) => !String(g.status ?? "").toUpperCase().includes("FINAL"))
      .filter((g) => g.tipoff_utc && new Date(g.tipoff_utc).getTime() >= now - 3 * 3600_000)
      .sort((a, b) => new Date(a.tipoff_utc!).getTime() - new Date(b.tipoff_utc!).getTime());
    for (const g of future) {
      const ts = new Date(g.tipoff_utc!).getTime();
      for (const side of ["home", "away"] as const) {
        const t = side === "home" ? g.home_team : g.away_team;
        const opp = side === "home" ? g.away_team : g.home_team;
        if (!t || !map[t]) continue;
        map[t].upcoming++;
        if (currentGw != null && g.gw === currentGw) map[t].thisGw++;
        if (ts <= week) map[t].next7++;
        if (!map[t].nextOpp) {
          map[t].nextOpp = opp ?? null;
          map[t].nextTipoff = g.tipoff_utc ?? null;
        }
      }
    }
    for (const k of Object.keys(map)) {
      const m = map[k];
      m.nextScore = m.next7 * 2 + m.thisGw;
      m.label = m.next7 >= 4 ? "Strong" : m.next7 === 3 ? "Good" : m.next7 === 2 ? "Neutral" : "Light";
    }
    return map;
  }, [schedRows, leagueTeams, currentGw]);

  // Filtered + sorted rows for the current category
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamAggs.filter((t) => !q || t.tricode.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }, [teamAggs, search]);

  const fpPerSalary = (t: TeamAgg) => (t.salaryTotal > 0 ? t.fpg / t.salaryTotal : 0);

  const getSortValue = (t: TeamAgg, key: string): number | string => {
    const sch = scheduleStats[t.tricode];
    switch (key) {
      case "team": return t.tricode;
      case "gp": return t.gp;
      case "record": return t.gp ? t.wins / t.gp : 0;
      case "fpg": return t.fpg;
      case "fpg5": return t.fpg5;
      case "deltaFp": return t.fpg5 - t.fpg;
      case "topFp": return t.topPlayer?.season.fp ?? 0;
      case "fcFpg": return t.fcFpg;
      case "bcFpg": return t.bcFpg;
      case "fpPerSalary": return fpPerSalary(t);
      case "avgValue": return t.avgValue;
      case "salaryTotal": return t.salaryTotal;
      case "players": return t.players.length;
      case "active": return t.activePlayers;
      case "fcCount": return t.fcCount;
      case "bcCount": return t.bcCount;
      case "top3Share": return t.top3Share;
      case "depthIndex": return t.depthIndex;
      case "upcoming": return sch?.upcoming ?? 0;
      case "thisGw": return sch?.thisGw ?? 0;
      case "next7": return sch?.next7 ?? 0;
      case "scheduleScore": return sch?.nextScore ?? 0;
      default: return 0;
    }
  };

  const defaultSort: Record<Category, string> = {
    fantasy: "fpg",
    efficiency: "fpPerSalary",
    depth: "depthIndex",
    schedule: "scheduleScore",
  };
  const activeSortKey = sortKey || defaultSort[category];

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = getSortValue(a, activeSortKey);
      const vb = getSortValue(b, activeSortKey);
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      return sortDir === "desc" ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });
    return arr;
  }, [filtered, activeSortKey, sortDir, scheduleStats]);

  // Summary cards
  const summary = useMemo(() => {
    const ranked = (key: (t: TeamAgg) => number) =>
      [...teamAggs].filter((t) => key(t) > 0).sort((a, b) => key(b) - key(a))[0] ?? null;
    return {
      topFantasy: ranked((t) => t.fpg),
      bestValue: ranked((t) => fpPerSalary(t)),
      bestForm: ranked((t) => t.fpg5 - t.fpg),
      deepest: ranked((t) => (t.fpg > 0 ? t.depthIndex : 0)),
      bestSchedule: [...teamAggs]
        .map((t) => ({ t, s: scheduleStats[t.tricode]?.nextScore ?? 0 }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)[0]?.t ?? null,
    };
  }, [teamAggs, scheduleStats]);

  const isLoading = loading || schedLoading;

  const CATEGORIES: { value: Category; label: string }[] = [
    { value: "fantasy", label: "Fantasy" },
    { value: "efficiency", label: "Efficiency" },
    { value: "depth", label: "Depth" },
    { value: "schedule", label: "Schedule" },
  ];

  const onSort = (key: string) => {
    if (activeSortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <p className="text-xs text-muted-foreground -mt-2">
        Fantasy production, value, roster depth and schedule context.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <SummaryCard label="Top Fantasy Team" team={summary.topFantasy} value={summary.topFantasy ? `${fmt(summary.topFantasy.fpg, 0)} FP` : "—"} onClick={onTeamClick} />
        <SummaryCard label="Best Value Team" team={summary.bestValue} value={summary.bestValue ? `${fmt(fpPerSalary(summary.bestValue) * 100, 1)}` : "—"} onClick={onTeamClick} />
        <SummaryCard label="Best Form Team" team={summary.bestForm} value={summary.bestForm ? `Δ ${fmt(summary.bestForm.fpg5 - summary.bestForm.fpg, 1)}` : "—"} onClick={onTeamClick} />
        <SummaryCard label="Deepest Rotation" team={summary.deepest} value={summary.deepest ? `${fmt(summary.deepest.depthIndex * 100, 0)}%` : "—"} onClick={onTeamClick} />
        <SummaryCard label="Best Schedule" team={summary.bestSchedule} value={summary.bestSchedule ? `${scheduleStats[summary.bestSchedule.tricode]?.next7 ?? 0} in 7d` : "—"} onClick={onTeamClick} />
      </div>

      {/* Category selector + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex bg-muted rounded-xl p-0.5 gap-0.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setSortKey(""); setSortDir("desc"); }}
              className={cn(
                "px-3 py-1 text-xs font-heading uppercase rounded-xl transition-colors",
                category === c.value ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team…"
            className="h-8 w-48 pl-7 text-xs rounded-xl"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (
        <StatsTable
          category={category}
          rows={sorted}
          scheduleStats={scheduleStats}
          leagueLogo={leagueLogo}
          sortKey={activeSortKey}
          sortDir={sortDir}
          onSort={onSort}
          onTeamClick={onTeamClick}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, team, value, onClick }: { label: string; team: TeamAgg | null; value: string; onClick: (t: string) => void }) {
  if (!team) return null;
  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-xl border relative overflow-hidden group"
      style={{ borderColor: `${team.primaryColor}30` }}
      onClick={() => onClick(team.tricode)}
    >
      <img src={team.logo} alt="" aria-hidden className="absolute -right-3 -bottom-3 h-20 w-20 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" />
      <CardContent className="p-3 relative z-[1]">
        <p className="text-[9px] font-heading font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <img src={team.logo} alt="" className="h-7 w-7 object-contain" />
          <div className="min-w-0">
            <p className="font-heading font-black text-sm leading-tight">{team.tricode}</p>
            <p className="text-[10px] text-muted-foreground truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ColDef = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  tip?: React.ReactNode;
  /** When set, cell text gets a green/red shade based on rank within visible rows. */
  grade?: { value: (t: TeamAgg) => number; invert?: boolean };
  render: (t: TeamAgg, ctx: { sch: ReturnType<typeof scheduleSlot>; rank: number }) => React.ReactNode;
};
function scheduleSlot(_t: TeamAgg) { return {} as any; }

function StatsTable({
  category, rows, scheduleStats, leagueLogo, sortKey, sortDir, onSort, onTeamClick,
}: {
  category: Category;
  rows: TeamAgg[];
  scheduleStats: Record<string, { upcoming: number; thisGw: number; next7: number; nextOpp: string | null; nextTipoff: string | null; nextScore: number; label: string }>;
  leagueLogo: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (k: string) => void;
  onTeamClick: (tri: string) => void;
}) {
  // Empty state checks
  const hasFp = rows.some((r) => r.fpg > 0);
  const hasSalary = rows.some((r) => r.salaryTotal > 0);
  const hasSchedule = rows.some((r) => (scheduleStats[r.tricode]?.upcoming ?? 0) > 0);

  if (category === "fantasy" && !hasFp) return <EmptyState text="Not enough player fantasy data to build team fantasy rankings." />;
  if (category === "efficiency" && (!hasFp || !hasSalary)) return <EmptyState text="Salary/value data is not available for this league yet." />;
  if (category === "schedule" && !hasSchedule) return <EmptyState text="No upcoming games found for this league." />;

  const teamCell = (t: TeamAgg) => (
    <div className="flex items-center gap-2 min-w-0">
      <img src={t.logo} alt="" className="h-5 w-5 object-contain shrink-0" />
      <span className="font-heading font-bold text-xs">{t.tricode}</span>
      <span className="text-[10px] text-muted-foreground truncate hidden md:inline">{t.name}</span>
    </div>
  );

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  };

  const cols: ColDef[] = (() => {
    if (category === "fantasy") return [
      { key: "team", label: "Team", align: "left", render: (t) => teamCell(t) },
      { key: "gp", label: "GP", align: "right", render: (t) => t.gp || "—" },
      { key: "record", label: "Record", align: "right", render: (t) => `${t.wins}-${t.losses}` },
      { key: "fpg", label: "Team FP/G", align: "right", render: (t) => fmt(t.fpg, 1) },
      { key: "fpg5", label: "Last 5 FP/G", align: "right", render: (t) => t.fpg5 > 0 ? fmt(t.fpg5, 1) : "—" },
      { key: "deltaFp", label: "Δ FP", align: "right", render: (t) => {
        const d = t.fpg5 - t.fpg;
        if (!t.fpg5) return "—";
        return <span className={cn("font-mono", d >= 0 ? "text-emerald-500" : "text-rose-500")}>{d >= 0 ? "+" : ""}{fmt(d, 1)}</span>;
      } },
      { key: "topFp", label: "Top FP Player", align: "left", render: (t) => t.topPlayer ? (
        <span className="text-[11px] truncate inline-block max-w-[140px]">{t.topPlayer.core.name}</span>
      ) : "—" },
      { key: "topFpVal", label: "Top FP/G", align: "right", render: (t) => t.topPlayer ? fmt(t.topPlayer.season.fp, 1) : "—" },
      { key: "fcFpg", label: "FC FP/G", align: "right", render: (t) => fmt(t.fcFpg, 1) },
      { key: "bcFpg", label: "BC FP/G", align: "right", render: (t) => fmt(t.bcFpg, 1) },
    ];
    if (category === "efficiency") return [
      { key: "team", label: "Team", align: "left", render: (t) => teamCell(t) },
      { key: "fpg", label: "Team FP/G", align: "right", render: (t) => fmt(t.fpg, 1) },
      { key: "fpPerSalary", label: "FP / $M", align: "right", render: (t) => t.salaryTotal > 0 ? fmt(t.fpg / t.salaryTotal, 2) : "—" },
      { key: "avgValue", label: "Avg Value", align: "right", render: (t) => t.avgValue > 0 ? fmt(t.avgValue, 2) : "—" },
      { key: "bestVal", label: "Best Value Player", align: "left", render: (t) => t.bestValuePlayer ? (
        <span className="text-[11px] truncate inline-block max-w-[140px]">{t.bestValuePlayer.core.name}</span>
      ) : "—" },
      { key: "bestValScore", label: "Score", align: "right", render: (t) => {
        const p = t.bestValuePlayer; if (!p) return "—";
        const v = p.computed.value5 || p.computed.value;
        return v > 0 ? fmt(v, 2) : "—";
      } },
      { key: "salaryTotal", label: "Salary Total", align: "right", render: (t) => t.salaryTotal > 0 ? `$${fmt(t.salaryTotal, 1)}M` : "—" },
    ];
    if (category === "depth") return [
      { key: "team", label: "Team", align: "left", render: (t) => teamCell(t) },
      { key: "players", label: "Players", align: "right", render: (t) => t.players.length },
      { key: "active", label: "Active", align: "right", render: (t) => t.activePlayers },
      { key: "fcCount", label: "FC", align: "right", render: (t) => t.fcCount },
      { key: "bcCount", label: "BC", align: "right", render: (t) => t.bcCount },
      { key: "top3Share", label: "Top 3 Share", align: "right", render: (t) => t.fpg > 0 ? `${fmt(t.top3Share * 100, 0)}%` : "—" },
      { key: "depthShare", label: "Depth Share", align: "right", render: (t) => t.fpg > 0 ? `${fmt((1 - t.top3Share) * 100, 0)}%` : "—" },
      { key: "depthIndex", label: "Depth Index", align: "right", render: (t) => t.fpg > 0 ? fmt(t.depthIndex * 100, 0) : "—" },
      { key: "starDep", label: "Star Dep.", align: "center", render: (t) => {
        if (t.fpg <= 0) return "—";
        const s = t.top3Share;
        const label = s > 0.65 ? "High" : s >= 0.5 ? "Medium" : "Low";
        const color = s > 0.65 ? "bg-rose-500/15 text-rose-500 border-rose-500/30" : s >= 0.5 ? "bg-amber-500/15 text-amber-500 border-amber-500/30" : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
        return <Badge variant="outline" className={cn("text-[9px] rounded-xl", color)}>{label}</Badge>;
      } },
    ];
    // schedule
    return [
      { key: "team", label: "Team", align: "left", render: (t) => teamCell(t) },
      { key: "upcoming", label: "Upcoming", align: "right", render: (t) => scheduleStats[t.tricode]?.upcoming ?? 0 },
      { key: "thisGw", label: "This GW", align: "right", render: (t) => scheduleStats[t.tricode]?.thisGw ?? 0 },
      { key: "next7", label: "Next 7d", align: "right", render: (t) => scheduleStats[t.tricode]?.next7 ?? 0 },
      { key: "nextOpp", label: "Next Opp", align: "left", render: (t) => scheduleStats[t.tricode]?.nextOpp ?? "—" },
      { key: "nextTip", label: "Tipoff", align: "left", render: (t) => fmtDate(scheduleStats[t.tricode]?.nextTipoff ?? null) },
      { key: "scheduleScore", label: "Score", align: "right", render: (t) => scheduleStats[t.tricode]?.nextScore ?? 0 },
      { key: "scheduleLabel", label: "Outlook", align: "center", render: (t) => {
        const s = scheduleStats[t.tricode];
        if (!s || s.upcoming === 0) return "—";
        const color =
          s.label === "Strong" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" :
          s.label === "Good" ? "bg-sky-500/15 text-sky-500 border-sky-500/30" :
          s.label === "Neutral" ? "bg-muted text-muted-foreground" :
          "bg-rose-500/10 text-rose-500 border-rose-500/30";
        return <Badge variant="outline" className={cn("text-[9px] rounded-xl", color)}>{s.label}</Badge>;
      } },
    ];
  })();

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40 inline ml-1" />;
    return sortDir === "desc" ? <ArrowDown className="h-3 w-3 inline ml-1" /> : <ArrowUp className="h-3 w-3 inline ml-1" />;
  };

  return (
    <div className="relative rounded-xl border border-border/60 bg-card/60 overflow-hidden">
      <img src={leagueLogo} alt="" aria-hidden className="pointer-events-none absolute inset-0 m-auto h-[55%] max-h-[360px] w-auto opacity-[0.04] dark:opacity-[0.05] select-none z-0" />
      <div className="relative z-[1] overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border/60 bg-muted/30">
            <tr>
              <th className="px-2 py-2 text-left font-heading uppercase tracking-wider text-[10px] text-muted-foreground w-10">#</th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-2 py-2 font-heading uppercase tracking-wider text-[10px] text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  )}
                  onClick={() => onSort(c.key)}
                >
                  {c.label}<SortIcon k={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr
                key={t.tricode}
                className="border-b border-border/30 last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => onTeamClick(t.tricode)}
              >
                <td className="px-2 py-1.5 text-muted-foreground font-mono text-[10px]">{i + 1}</td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-2 py-1.5 whitespace-nowrap",
                      c.align === "right" ? "text-right font-mono" : c.align === "center" ? "text-center" : "text-left",
                    )}
                  >
                    {c.render(t, { sch: scheduleSlot(t), rank: i + 1 })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}