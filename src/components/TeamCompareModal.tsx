import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Swords, ExternalLink } from "lucide-react";
import { getTeamByTricode, getTeamLogo } from "@/lib/nba-teams";
import { useStandingsContext } from "@/hooks/useStandingsContext";
import GameDetailModal, { type GameDetailGame } from "@/components/GameDetailModal";

interface TeamCompareModalProps {
  teamA: string | null;
  teamB: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmt(n: number | null | undefined, dec = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(dec);
}

function MetricRow({
  label, a, b, higherBetter = true, dec = 1,
}: { label: string; a: number | null; b: number | null; higherBetter?: boolean; dec?: number }) {
  const aWin =
    a != null && b != null && (higherBetter ? a > b : a < b);
  const bWin =
    a != null && b != null && (higherBetter ? b > a : b < a);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
      <div className={`text-right text-sm font-mono tabular-nums ${aWin ? "text-[hsl(var(--nba-yellow))] font-bold" : "text-foreground/80"}`}>
        {fmt(a, dec)}
      </div>
      <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground text-center px-2">
        {label}
      </div>
      <div className={`text-left text-sm font-mono tabular-nums ${bWin ? "text-[hsl(var(--nba-yellow))] font-bold" : "text-foreground/80"}`}>
        {fmt(b, dec)}
      </div>
    </div>
  );
}

function TeamHeader({ tricode, side, rank, conf }: { tricode: string; side: "L" | "R"; rank?: number; conf?: string }) {
  const team = getTeamByTricode(tricode);
  return (
    <div className={`flex items-center gap-3 ${side === "R" ? "flex-row-reverse text-right" : ""}`}>
      <div className="shrink-0 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 p-2 shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.4)]">
        <img src={team?.logo} alt={team?.name ?? tricode} className="w-14 h-14 object-contain" />
      </div>
      <div className="min-w-0">
        <div className="font-heading font-black text-lg uppercase tracking-tight leading-tight truncate">
          {team?.name ?? tricode}
        </div>
        <div className={`mt-1 flex items-center gap-1.5 ${side === "R" ? "justify-end" : ""}`}>
          {rank != null && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] font-heading uppercase tracking-wider text-muted-foreground">
              <Trophy className="h-2.5 w-2.5 text-[hsl(var(--nba-yellow))]" />
              <span className="text-foreground font-bold">#{rank}</span>
              {conf ? <span>{conf}</span> : null}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamCompareModal({ teamA, teamB, open, onOpenChange }: TeamCompareModalProps) {
  const { standingsByTeam, isLoading: standingsLoading } = useStandingsContext();
  const [selectedGame, setSelectedGame] = useState<GameDetailGame | null>(null);

  const { data: h2h, isLoading: h2hLoading } = useQuery({
    queryKey: ["team-compare-h2h", teamA, teamB],
    enabled: open && !!teamA && !!teamB,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("*")
        .or(
          `and(home_team.eq.${teamA},away_team.eq.${teamB}),and(home_team.eq.${teamB},away_team.eq.${teamA})`,
        )
        .order("tipoff_utc", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const aRow = teamA ? standingsByTeam[teamA] : undefined;
  const bRow = teamB ? standingsByTeam[teamB] : undefined;

  // Conference rank
  const confRank = useMemo(() => {
    const result: Record<string, number> = {};
    for (const conf of ["East", "West"] as const) {
      const rows = Object.values(standingsByTeam)
        .filter((r) => r.conference === conf)
        .sort((a, b) => b.pct - a.pct || b.w - a.w);
      rows.forEach((r, i) => { result[r.tricode] = i + 1; });
    }
    return result;
  }, [standingsByTeam]);

  const leagueRank = useMemo(() => {
    const rows = Object.values(standingsByTeam).sort((a, b) => b.pct - a.pct || b.w - a.w);
    const m: Record<string, number> = {};
    rows.forEach((r, i) => { m[r.tricode] = i + 1; });
    return m;
  }, [standingsByTeam]);

  const h2hSplit = useMemo(() => {
    if (!teamA || !teamB || !h2h) return { aWins: 0, bWins: 0 };
    let aWins = 0, bWins = 0;
    for (const g of h2h) {
      if (!g.status?.toUpperCase().includes("FINAL")) continue;
      const aIsHome = g.home_team === teamA;
      const aPts = aIsHome ? g.home_pts : g.away_pts;
      const bPts = aIsHome ? g.away_pts : g.home_pts;
      if (aPts > bPts) aWins++; else if (bPts > aPts) bWins++;
    }
    return { aWins, bWins };
  }, [h2h, teamA, teamB]);

  if (!teamA || !teamB) return null;

  const teamAObj = getTeamByTricode(teamA);
  const teamBObj = getTeamByTricode(teamB);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          {/* Premium gradient header */}
          <DialogHeader className="relative overflow-hidden border-b border-border/50 px-6 pt-6 pb-5 shrink-0">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 0% 50%, hsl(var(--primary) / 0.25) 0%, transparent 55%), radial-gradient(circle at 100% 50%, hsl(var(--destructive) / 0.20) 0%, transparent 55%)",
              }}
            />
            <DialogTitle className="sr-only">
              {teamAObj?.name ?? teamA} vs {teamBObj?.name ?? teamB}
            </DialogTitle>
            <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <TeamHeader tricode={teamA} side="L" rank={confRank[teamA]} conf={aRow?.conference} />
              <div className="flex flex-col items-center gap-1">
                <Swords className="h-6 w-6 text-[hsl(var(--nba-yellow))]" />
                <div className="text-[10px] font-heading uppercase tracking-[0.25em] text-muted-foreground">Compare</div>
                {(h2hSplit.aWins + h2hSplit.bWins) > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-mono">
                    <span className="font-bold">{h2hSplit.aWins}</span>
                    <span className="text-muted-foreground">H2H</span>
                    <span className="font-bold">{h2hSplit.bWins}</span>
                  </div>
                )}
              </div>
              <TeamHeader tricode={teamB} side="R" rank={confRank[teamB]} conf={bRow?.conference} />
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-5 space-y-6">
              {/* Standings & metrics */}
              <section>
                <h3 className="text-[10px] font-heading uppercase tracking-[0.25em] text-muted-foreground mb-2">
                  Standings & Form
                </h3>
                {standingsLoading || !aRow || !bRow ? (
                  <Skeleton className="h-40" />
                ) : (
                  <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
                    <MetricRow label="League Rank" a={leagueRank[teamA] ?? null} b={leagueRank[teamB] ?? null} higherBetter={false} dec={0} />
                    <MetricRow label={`${aRow.conference === bRow.conference ? aRow.conference : "Conf"} Rank`} a={confRank[teamA] ?? null} b={confRank[teamB] ?? null} higherBetter={false} dec={0} />
                    <MetricRow label="Wins" a={aRow.w} b={bRow.w} dec={0} />
                    <MetricRow label="Losses" a={aRow.l} b={bRow.l} higherBetter={false} dec={0} />
                    <MetricRow label="Win %" a={aRow.pct * 100} b={bRow.pct * 100} dec={1} />
                    <MetricRow label="PPG" a={aRow.ppg} b={bRow.ppg} dec={1} />
                    <MetricRow label="Opp PPG" a={aRow.oppPpg} b={bRow.oppPpg} higherBetter={false} dec={1} />
                    <MetricRow label="Diff" a={aRow.diff} b={bRow.diff} dec={1} />
                    <MetricRow label="L10 W" a={aRow.l10W} b={bRow.l10W} dec={0} />
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5">
                      <div className="text-right text-sm font-mono tabular-nums">{aRow.strk}</div>
                      <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground text-center px-2">Streak</div>
                      <div className="text-left text-sm font-mono tabular-nums">{bRow.strk}</div>
                    </div>
                  </div>
                )}
              </section>

              {/* Head-to-Head this season */}
              <section>
                <h3 className="text-[10px] font-heading uppercase tracking-[0.25em] text-muted-foreground mb-2">
                  Head-to-Head — This Season
                </h3>
                {h2hLoading ? (
                  <Skeleton className="h-24" />
                ) : !h2h || h2h.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground font-heading uppercase tracking-wider">
                    No matchups recorded
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {h2h.map((g: any) => {
                      const isFinal = g.status?.toUpperCase().includes("FINAL");
                      const aIsHome = g.home_team === teamA;
                      const date = g.tipoff_utc
                        ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", day: "numeric", month: "short", year: "numeric" }).format(new Date(g.tipoff_utc))
                        : "—";
                      return (
                        <button
                          type="button"
                          key={g.game_id}
                          onClick={() => setSelectedGame({
                            game_id: g.game_id,
                            home_team: g.home_team, away_team: g.away_team,
                            home_pts: g.home_pts, away_pts: g.away_pts,
                            status: g.status,
                            game_boxscore_url: g.game_boxscore_url,
                            game_charts_url: g.game_charts_url,
                            game_playbyplay_url: g.game_playbyplay_url,
                            game_recap_url: g.game_recap_url,
                            nba_game_url: g.nba_game_url,
                            played: !!isFinal,
                          })}
                          className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-border/50 bg-card/60 hover:bg-accent/30 hover:border-primary/40 transition-all px-3 py-2 text-left group"
                        >
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs font-heading font-bold uppercase">{aIsHome ? "vs" : "@"} {aIsHome ? g.away_team : g.home_team}</span>
                            {getTeamLogo(aIsHome ? g.away_team : g.home_team) && (
                              <img src={getTeamLogo(aIsHome ? g.away_team : g.home_team)} alt="" className="w-5 h-5 object-contain" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-[120px] justify-center">
                            {isFinal ? (
                              <>
                                <span className={`font-mono text-base ${(aIsHome ? g.home_pts : g.away_pts) > (aIsHome ? g.away_pts : g.home_pts) ? "font-black text-foreground" : "text-muted-foreground"}`}>
                                  {aIsHome ? g.home_pts : g.away_pts}
                                </span>
                                <span className="text-muted-foreground text-xs">—</span>
                                <span className={`font-mono text-base ${(aIsHome ? g.away_pts : g.home_pts) > (aIsHome ? g.home_pts : g.away_pts) ? "font-black text-foreground" : "text-muted-foreground"}`}>
                                  {aIsHome ? g.away_pts : g.home_pts}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                                {g.status ?? "Scheduled"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-1">
                            {date}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <GameDetailModal
        game={selectedGame}
        open={selectedGame !== null}
        onOpenChange={(o) => { if (!o) setSelectedGame(null); }}
      />
    </>
  );
}