import { useState, useRef } from "react";
import { Trophy, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useScoringHistory, type ScoringGameDay, type ScoringWeek } from "@/hooks/useScoringHistory";
import { getTeamLogo } from "@/lib/nba-teams";
import TeamModal from "@/components/TeamModal";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Dot } from "recharts";

export default function ScoringPage() {
  const { data, isLoading } = useScoringHistory();
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [teamModalTeam, setTeamModalTeam] = useState<string | null>(null);
  const rosterRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse font-heading text-lg">Loading scoring data…</div>
      </div>
    );
  }

  if (!data || data.game_days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Trophy className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground font-heading">No scoring data available yet</p>
      </div>
    );
  }

  const { weeks, game_days, transactions } = data;
  const seasonTotal = weeks.reduce((s, w) => s + w.total_fp, 0);
  const currentGw = weeks.length > 0 ? weeks[weeks.length - 1].gw : 1;

  // Transaction dates for highlighting
  const txnDates = new Set(transactions.map((t: any) => t.created_at?.substring(0, 10)));

  // Timeline data
  const timelineData = game_days.map((gd, i) => ({
    label: `W${gd.gw}D${gd.day}`,
    fp: gd.total_fp,
    index: i,
    hasTxn: txnDates.has(gd.game_date),
  }));

  const selectedDay: ScoringGameDay | null =
    selectedDayIdx != null ? game_days[selectedDayIdx] : game_days[game_days.length - 1];
  const selectedIdx = selectedDayIdx ?? game_days.length - 1;

  const navigateDay = (dir: -1 | 1) => {
    const next = selectedIdx + dir;
    if (next >= 0 && next < game_days.length) {
      setSelectedDayIdx(next);
    }
  };

  return (
    <div className="px-6 py-5 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-[hsl(var(--nba-yellow))]" />
        <h1 className="text-2xl font-heading font-bold uppercase tracking-wider">Scoring</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-heading uppercase">Season Total</span>
          <span className="text-xl font-heading font-bold text-[hsl(var(--nba-yellow))]">{seasonTotal.toFixed(1)} FP</span>
        </div>
      </div>

      {/* ── WEEKLY LEADERBOARD ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Weekly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 text-left">Week</th>
                <th className="px-4 py-2 text-right">Total FP</th>
                <th className="px-4 py-2 text-left">Best Player</th>
                <th className="px-4 py-2 text-left">Worst Player</th>
                <th className="px-4 py-2 text-right">Cpt Bonus</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr
                  key={w.gw}
                  className={`border-b border-border/50 transition-colors ${
                    w.gw === currentGw
                      ? "bg-[hsl(var(--nba-yellow))]/10 font-bold"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <td className="px-4 py-2 font-heading font-bold">
                    W{w.gw}
                    {w.gw === currentGw && (
                      <Badge variant="outline" className="ml-2 text-[8px] px-1 py-0">CURRENT</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{w.total_fp.toFixed(1)}</td>
                  <td className="px-4 py-2">
                    {w.best_player && (
                      <span className="text-green-500">
                        {w.best_player.name} <span className="text-muted-foreground font-mono">({w.best_player.fp})</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {w.worst_player && (
                      <span className="text-destructive">
                        {w.worst_player.name} <span className="text-muted-foreground font-mono">({w.worst_player.fp})</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{w.captain_bonus}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold">
                <td className="px-4 py-2 font-heading">TOTAL</td>
                <td className="px-4 py-2 text-right font-mono text-[hsl(var(--nba-yellow))]">{seasonTotal.toFixed(1)}</td>
                <td className="px-4 py-2" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── TIMELINE ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">FP Timeline</h2>
        </div>
        <div className="px-4 py-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={35} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Line
                type="monotone"
                dataKey="fp"
                stroke="hsl(var(--nba-yellow))"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.index === selectedIdx;
                  const hasTxn = payload.hasTxn;
                  return (
                    <circle
                      key={payload.index}
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : hasTxn ? 5 : 3}
                      fill={hasTxn ? "hsl(var(--destructive))" : isSelected ? "hsl(var(--nba-yellow))" : "hsl(var(--primary))"}
                      stroke={isSelected ? "white" : "none"}
                      strokeWidth={isSelected ? 2 : 0}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setSelectedDayIdx(payload.index);
                        rosterRef.current?.scrollIntoView({ behavior: "smooth" });
                      }}
                    />
                  );
                }}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Game Day</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Roster Change</div>
        </div>
      </div>

      {/* ── GAME DAY ROSTER TABLE ── */}
      {selectedDay && (
        <div ref={rosterRef} className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Navigation header */}
          <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
            <button
              onClick={() => navigateDay(-1)}
              disabled={selectedIdx <= 0}
              className="p-1 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <h2 className="text-base font-heading font-bold uppercase tracking-wider">
                GW{selectedDay.gw} Day {selectedDay.day}
              </h2>
              <span className="text-xs text-muted-foreground">{selectedDay.game_date}</span>
            </div>
            <button
              onClick={() => navigateDay(1)}
              disabled={selectedIdx >= game_days.length - 1}
              className="p-1 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Starting 5 mini visual */}
          <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">Starting 5</span>
            </div>
            <div className="flex items-center gap-3">
              {selectedDay.players
                .filter((p) => p.is_starter)
                .slice(0, 5)
                .map((p) => (
                  <div key={p.player_id} className="flex flex-col items-center">
                    {p.photo ? (
                      <img src={p.photo} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
                        {p.name.substring(0, 2)}
                      </div>
                    )}
                    <span className="text-[8px] font-heading font-bold mt-0.5 truncate max-w-[60px]">{p.name.split(" ").pop()}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[9px] font-heading uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left w-8">Pos</th>
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="px-3 py-2 text-center">Opp</th>
                  <th className="px-3 py-2 text-center">Res</th>
                  <th className="px-3 py-2 text-right">FP</th>
                  <th className="px-3 py-2 text-right">$</th>
                  <th className="px-3 py-2 text-right">V</th>
                  <th className="px-3 py-2 text-right">MP</th>
                  <th className="px-3 py-2 text-right">PS</th>
                  <th className="px-3 py-2 text-right">A</th>
                  <th className="px-3 py-2 text-right">R</th>
                  <th className="px-3 py-2 text-right">B</th>
                  <th className="px-3 py-2 text-right">S</th>
                </tr>
              </thead>
              <tbody>
                {selectedDay.players.map((p) => {
                  const isFc = p.fc_bc === "FC";
                  const oppLogo = getTeamLogo(p.opp);
                  const playerTeamLogo = getTeamLogo(p.team);
                  const isAway = p.home_away === "A";

                  return (
                    <tr key={p.player_id} className="border-b border-border/30 hover:bg-muted/30 transition-colors group">
                      {/* Pos */}
                      <td className="px-3 py-2">
                        <Badge variant={isFc ? "destructive" : "default"} className="text-[8px] px-1.5 py-0 rounded h-4">
                          {p.fc_bc}
                        </Badge>
                      </td>
                      {/* Player */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 relative">
                          {p.photo ? (
                            <img src={p.photo} alt={p.name} className="w-9 h-9 rounded-full object-cover border border-border transition-transform group-hover:scale-110" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
                              {p.name.substring(0, 2)}
                            </div>
                          )}
                          <span className="text-sm font-heading font-bold">{p.name}</span>
                          {/* Team watermark */}
                          {playerTeamLogo && (
                            <img
                              src={playerTeamLogo}
                              alt={p.team}
                              className="absolute right-0 h-10 w-10 opacity-10 group-hover:opacity-25 transition-all group-hover:scale-110 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); setTeamModalTeam(p.team); }}
                            />
                          )}
                        </div>
                      </td>
                      {/* Opp */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-0.5">
                          {isAway && <span className="text-[9px] text-muted-foreground">@</span>}
                          {oppLogo ? (
                            <img
                              src={oppLogo}
                              alt={p.opp}
                              className="w-7 h-7 object-contain cursor-pointer transition-transform hover:scale-110"
                              onClick={(e) => { e.stopPropagation(); setTeamModalTeam(p.opp); }}
                            />
                          ) : (
                            <span className="text-xs font-mono">{p.opp}</span>
                          )}
                        </div>
                      </td>
                      {/* Result */}
                      <td className="px-3 py-2 text-center">
                        {p.result_wl ? (
                          p.nba_game_url ? (
                            <a
                              href={p.nba_game_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs font-bold inline-flex items-center gap-0.5 hover:underline ${
                                p.result_wl === "W" ? "text-green-500" : "text-destructive"
                              }`}
                            >
                              {p.result_wl}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : (
                            <span className={`text-xs font-bold ${p.result_wl === "W" ? "text-green-500" : "text-destructive"}`}>
                              {p.result_wl}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {/* Stats */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-[hsl(var(--nba-yellow))]">{p.fp}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{p.salary}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{p.value.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.mp}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.pts}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.ast}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.reb}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.blk}</td>
                      <td className="px-3 py-2 text-right font-mono">{p.stl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {teamModalTeam && (
        <TeamModal team={teamModalTeam} onClose={() => setTeamModalTeam(null)} />
      )}
    </div>
  );
}
