import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { aiExplainTrade } from "@/lib/api";
import type { z } from "zod";
import type { PlayerListItemSchema } from "@/lib/contracts";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface TradeReportProps {
  outPlayers: PlayerListItem[];
  inPlayers: PlayerListItem[];
  bankRemaining: number;
  salaryCap: number;
  rosterPlayers: PlayerListItem[];
  gw: number;
  day: number;
  teamId: string | null;
  committing: boolean;
  onClose: () => void;
  onCommit: () => void;
}

function PlayerCard({ p, variant }: { p: PlayerListItem; variant: "out" | "in" }) {
  const isOut = variant === "out";
  const logo = getTeamLogo(p.core.team);
  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 p-3 flex items-center gap-3 ${
        isOut
          ? "bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/40 shadow-[0_4px_20px_-8px_hsl(var(--destructive)/0.4)]"
          : "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/40 shadow-[0_4px_20px_-8px_hsl(142_76%_36%/0.4)]"
      }`}
    >
      {/* Premium watermark — oversized team logo invading the top-right corner */}
      {logo && (
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -top-6 -right-6 h-32 w-32 object-contain opacity-[0.18] rotate-12 select-none"
        />
      )}
      <Avatar className="h-12 w-12 shrink-0 relative z-10">
        {p.core.photo && <AvatarImage src={p.core.photo} />}
        <AvatarFallback>{p.core.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[8px] px-1 py-0 rounded">
            {p.core.fc_bc}
          </Badge>
          <span className="font-heading font-bold text-sm truncate">{p.core.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          <span>{p.core.team}</span>
          <span>·</span>
          <span>${p.core.salary}M</span>
        </div>
        <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] font-mono">
          <span>FP5 <b>{(p.last5 as any)?.fp5?.toFixed(1) ?? "0.0"}</b></span>
          <span>V5 <b>{(p.computed as any)?.value5?.toFixed(1) ?? "0.0"}</b></span>
          <span>S5 <b>{(p.computed as any)?.stocks5?.toFixed(1) ?? "0.0"}</b></span>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, before, after, format = (n: number) => n.toFixed(1), invert = false }: {
  label: string; before: number; after: number;
  format?: (n: number) => string; invert?: boolean;
}) {
  const delta = after - before;
  const isGood = invert ? delta < 0 : delta > 0;
  const isBad = invert ? delta > 0 : delta < 0;
  const cls = Math.abs(delta) < 0.01 ? "text-muted-foreground" : isGood ? "text-emerald-500" : isBad ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="grid grid-cols-4 items-center gap-2 px-3 py-2 border-b border-border/40 last:border-0 text-xs font-mono">
      <span className="font-heading uppercase text-[10px] text-muted-foreground tracking-wider">{label}</span>
      <span className="text-right">{format(before)}</span>
      <span className="text-right font-bold">{format(after)}</span>
      <span className={`text-right font-bold ${cls}`}>{delta >= 0 ? "+" : ""}{format(delta)}</span>
    </div>
  );
}

export default function TradeReport(props: TradeReportProps) {
  const { outPlayers, inPlayers, bankRemaining, salaryCap, rosterPlayers, gw, day, teamId, committing, onClose, onCommit } = props;

  // Compute before/after metrics
  const beforeSalary = rosterPlayers.reduce((s, p) => s + p.core.salary, 0);
  const afterSalary = beforeSalary - outPlayers.reduce((s, p) => s + p.core.salary, 0) + inPlayers.reduce((s, p) => s + p.core.salary, 0);
  const beforeFp5 = rosterPlayers.reduce((s, p) => s + ((p.last5 as any)?.fp5 ?? 0), 0);
  const afterFp5 = beforeFp5 - outPlayers.reduce((s, p) => s + ((p.last5 as any)?.fp5 ?? 0), 0) + inPlayers.reduce((s, p) => s + ((p.last5 as any)?.fp5 ?? 0), 0);
  const beforeStocks5 = rosterPlayers.reduce((s, p) => s + ((p.computed as any)?.stocks5 ?? 0), 0);
  const afterStocks5 = beforeStocks5 - outPlayers.reduce((s, p) => s + ((p.computed as any)?.stocks5 ?? 0), 0) + inPlayers.reduce((s, p) => s + ((p.computed as any)?.stocks5 ?? 0), 0);
  const beforeBank = bankRemaining;
  const afterBank = salaryCap - afterSalary;

  // Extra last-5 aggregates
  const sumLast5 = (rows: PlayerListItem[], key: "pts5" | "reb5" | "ast5" | "mpg5") =>
    rows.reduce((s, p) => s + ((p.last5 as any)?.[key] ?? 0), 0);
  const beforePts5 = sumLast5(rosterPlayers, "pts5");
  const afterPts5 = beforePts5 - sumLast5(outPlayers, "pts5") + sumLast5(inPlayers, "pts5");
  const beforeReb5 = sumLast5(rosterPlayers, "reb5");
  const afterReb5 = beforeReb5 - sumLast5(outPlayers, "reb5") + sumLast5(inPlayers, "reb5");
  const beforeAst5 = sumLast5(rosterPlayers, "ast5");
  const afterAst5 = beforeAst5 - sumLast5(outPlayers, "ast5") + sumLast5(inPlayers, "ast5");
  const beforeMpg5 = sumLast5(rosterPlayers, "mpg5");
  const afterMpg5 = beforeMpg5 - sumLast5(outPlayers, "mpg5") + sumLast5(inPlayers, "mpg5");

  // Team distribution count
  const beforeTeams = new Set(rosterPlayers.map((p) => p.core.team)).size;
  const postRoster = [
    ...rosterPlayers.filter((p) => !outPlayers.some((o) => o.core.id === p.core.id)),
    ...inPlayers,
  ];
  const afterTeams = new Set(postRoster.map((p) => p.core.team)).size;

  // AI verdict
  const [verdict, setVerdict] = useState<{ verdict: string; summary: string; pros: string[]; cons: string[]; confidence: number } | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(true);
  const [verdictError, setVerdictError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVerdictLoading(true);
    setVerdictError(null);
    setVerdict(null);
    aiExplainTrade(
      {
        outs: outPlayers.map((p) => p.core.id),
        ins: inPlayers.map((p) => p.core.id),
        gw,
        day,
      },
      teamId ?? undefined,
    )
      .then((res) => { if (!cancelled) setVerdict(res as any); })
      .catch((e) => { if (!cancelled) setVerdictError(e?.message ?? "AI verdict unavailable"); })
      .finally(() => { if (!cancelled) setVerdictLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outPlayers.map((p) => p.core.id).join(","), inPlayers.map((p) => p.core.id).join(","), gw, day, teamId]);

  const verdictColor =
    verdict?.verdict === "favorable" ? "text-emerald-500 border-emerald-500/40 bg-emerald-500/10"
    : verdict?.verdict === "unfavorable" ? "text-destructive border-destructive/40 bg-destructive/10"
    : "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10";

  return (
    <div className="rounded-xl border-2 border-accent/40 bg-gradient-to-br from-background via-background to-accent/[0.03] shadow-[0_20px_60px_-15px_hsl(var(--accent)/0.35)] ring-1 ring-accent/10">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-card/60 via-card/40 to-accent/[0.06] rounded-t-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h3 className="font-heading uppercase text-sm tracking-[0.2em] font-bold">Trade Report</h3>
          <Badge variant="outline" className="font-mono text-[10px]">GW{gw} · Day {day}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close report">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 max-h-[70vh] flex flex-col">
        {/* A. Side-by-side diff — full width */}
        <div className="shrink-0">
          <h4 className="font-heading uppercase text-[10px] tracking-[0.2em] text-muted-foreground mb-2">Players</h4>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div className="space-y-2">
              {outPlayers.map((p) => <PlayerCard key={p.core.id} p={p} variant="out" />)}
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-2">
              {inPlayers.map((p) => <PlayerCard key={p.core.id} p={p} variant="in" />)}
            </div>
          </div>
        </div>

        {/* B + C. Two-column equal-height row */}
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          {/* Roster impact */}
          <div className="flex flex-col min-h-0">
            <h4 className="font-heading uppercase text-[10px] tracking-[0.2em] text-muted-foreground mb-2 shrink-0">Roster Impact</h4>
            <div className="rounded-lg border border-border bg-card/30 flex-1 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-border bg-muted/30 text-[10px] font-heading uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
                <span>Metric</span>
                <span className="text-right">Before</span>
                <span className="text-right">After</span>
                <span className="text-right">Δ</span>
              </div>
              <MetricRow label="Salary used" before={beforeSalary} after={afterSalary} format={(n) => `$${n.toFixed(1)}M`} invert />
              <MetricRow label="Bank" before={beforeBank} after={afterBank} format={(n) => `$${n.toFixed(1)}M`} />
              <MetricRow label="Sum FP5" before={beforeFp5} after={afterFp5} />
              <MetricRow label="Sum Stocks5" before={beforeStocks5} after={afterStocks5} />
              <MetricRow label="Teams used" before={beforeTeams} after={afterTeams} format={(n) => n.toFixed(0)} />
              <MetricRow label="Sum PTS5" before={beforePts5} after={afterPts5} />
              <MetricRow label="Sum REB5" before={beforeReb5} after={afterReb5} />
              <MetricRow label="Sum AST5" before={beforeAst5} after={afterAst5} />
              <MetricRow label="Sum MPG5" before={beforeMpg5} after={afterMpg5} />
            </div>
          </div>

          {/* AI verdict */}
          <div className="flex flex-col min-h-0">
            <h4 className="font-heading uppercase text-[10px] tracking-[0.2em] text-muted-foreground mb-2 shrink-0">AI Verdict</h4>
            {verdictLoading ? (
              <div className="space-y-2 rounded-lg border border-border bg-card/30 p-3 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : verdictError ? (
              <div className="rounded-lg border border-border bg-card/30 p-3 flex-1">
                <p className="text-xs text-muted-foreground italic">AI verdict unavailable: {verdictError}</p>
              </div>
            ) : verdict ? (
              <div className={`rounded-lg border-2 p-3 flex-1 overflow-y-auto ${verdictColor}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="uppercase font-heading text-[10px] tracking-wider border-current">
                    {verdict.verdict}
                  </Badge>
                  <span className="text-[10px] font-mono opacity-70">
                    confidence {(verdict.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm leading-relaxed mb-3 text-foreground">{verdict.summary}</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-heading uppercase tracking-wider opacity-70 mb-1">Pros</p>
                    <ul className="space-y-1 text-[11px] text-foreground">
                      {verdict.pros.map((s, i) => <li key={i}>+ {s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-heading uppercase tracking-wider opacity-70 mb-1">Cons</p>
                    <ul className="space-y-1 text-[11px] text-foreground">
                      {verdict.cons.length === 0
                        ? <li className="opacity-60">None flagged</li>
                        : verdict.cons.map((s, i) => <li key={i}>− {s}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-gradient-to-r from-card/40 via-card/60 to-card/40 rounded-b-xl">
        <Button variant="outline" size="sm" onClick={onClose} disabled={committing}>
          ← Back to picking
        </Button>
        <Button size="sm" onClick={onCommit} disabled={committing}>
          {committing ? "Committing…" : "Commit Trade"}
        </Button>
      </div>
    </div>
  );
}