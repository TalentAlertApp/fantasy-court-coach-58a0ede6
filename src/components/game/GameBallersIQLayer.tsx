import { useMemo } from "react";
import { Flame, TrendingUp, Crown, AlertTriangle, DollarSign, Activity, Zap } from "lucide-react";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { cn } from "@/lib/utils";

interface Props {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homePts: number;
  awayPts: number;
  compact?: boolean;
}

const n = (v: unknown, d = 0) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : d;
};

export default function GameBallersIQLayer({
  gameId, homeTeam, awayTeam, homePts, awayPts, compact = false,
}: Props) {
  const { data, isLoading } = useGameBoxscoreQuery(gameId);
  const players = (data?.players ?? []) as any[];

  const intel = useMemo(() => {
    if (!players.length) return null;
    const sorted = [...players].sort((a, b) => n(b.fp) - n(a.fp));
    const mvp = sorted[0];
    const top3 = sorted.slice(0, 3);
    const valueAce = [...players]
      .filter((p) => n(p.salary) > 0 && n(p.fp) > 0)
      .sort((a, b) => n(b.fp) / n(b.salary, 1) - n(a.fp) / n(a.salary, 1))[0];
    const totalPts = homePts + awayPts;
    const chips: { label: string; tone: "amber" | "sky" | "rose" | "emerald" }[] = [];
    if (totalPts >= 230) chips.push({ label: "HIGH FP GAME", tone: "amber" });
    if (totalPts > 0 && totalPts <= 180) chips.push({ label: "LOW SCORING", tone: "sky" });
    if (Math.abs(homePts - awayPts) <= 4 && totalPts > 0) chips.push({ label: "CLOSE GAME", tone: "rose" });
    if (Math.abs(homePts - awayPts) >= 20) chips.push({ label: "BLOWOUT", tone: "emerald" });
    if (n(mvp?.fp) >= 45) chips.push({ label: "MVP SHOWING", tone: "amber" });
    return { mvp, top3, valueAce, chips };
  }, [players, homePts, awayPts]);

  if (isLoading) {
    return (
      <div className="border-t border-amber-400/20 bg-gradient-to-b from-amber-400/[0.06] to-transparent px-3 py-2 text-[10px] font-heading uppercase tracking-[0.18em] text-amber-200/70">
        Loading Ballers.IQ live…
      </div>
    );
  }
  if (!intel) return null;

  const recap = buildRecap({ homeTeam, awayTeam, homePts, awayPts, mvp: intel.mvp, valueAce: intel.valueAce });

  return (
    <div className="relative border-t border-amber-400/25 bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.10),transparent_60%)] bg-black/40 backdrop-blur-md">
      {/* hairline top glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent shadow-[0_0_10px_rgba(252,211,77,0.4)]" />

      <div className={cn("px-3", compact ? "py-2 space-y-2" : "py-2.5 space-y-2.5")}>
        {/* Header strip */}
        <div className="flex items-center gap-2">
          <BallersIQBrand variant="emblem" size="sm" forceTheme="dark" transparent />
          <span className="text-[9.5px] font-heading font-bold uppercase tracking-[0.24em] text-amber-200/90">
            Ballers.IQ Live
          </span>
          <span className="h-3 w-px bg-amber-400/30" />
          <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-white/55">Recap Intelligence</span>
          <div className="ml-auto flex flex-wrap gap-1 justify-end">
            {intel.chips.map((c) => (
              <span key={c.label} className={cn(
                "px-1.5 py-0.5 rounded-md border text-[9px] font-heading font-bold tracking-[0.18em]",
                CHIP_TONE[c.tone],
              )}>{c.label}</span>
            ))}
          </div>
        </div>

        {/* Recap card + Top Performers row */}
        <div className={cn("grid gap-2", compact ? "grid-cols-1" : "md:grid-cols-[1.3fr_1fr]")}>
          {/* Recap card */}
          <div className="rounded-lg border border-amber-400/25 bg-gradient-to-br from-black/60 via-black/40 to-black/60 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="h-3 w-3 text-amber-300" />
              <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-amber-200/90">Ballers.IQ Recap</span>
            </div>
            <p className="text-[11.5px] leading-snug text-white/85">{recap}</p>
          </div>

          {/* Top Performers */}
          <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className="h-3 w-3 text-amber-300" />
              <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/70">Top Fantasy Performers</span>
            </div>
            <ul className="space-y-0.5">
              {intel.top3.map((p, i) => {
                const isMvp = i === 0;
                const isValue = p.player_id === intel.valueAce?.player_id;
                return (
                  <li key={p.player_id} className="flex items-center gap-1.5 text-[11px]">
                    <span className={cn("font-mono w-3 text-[9.5px]", isMvp ? "text-amber-300" : "text-white/40")}>{i + 1}</span>
                    <span className="truncate font-medium text-white/90">{p.name}</span>
                    <span className="text-[9px] text-white/40 truncate">{p.team}</span>
                    <div className="ml-auto flex items-center gap-1">
                      {isMvp && <Badge tone="amber" icon={<Flame className="h-2.5 w-2.5" />} label="MVP" />}
                      {isValue && <Badge tone="emerald" icon={<DollarSign className="h-2.5 w-2.5" />} label="VALUE" />}
                      {n(p.mp) <= 18 && n(p.fp) >= 25 && <Badge tone="sky" icon={<Zap className="h-2.5 w-2.5" />} label="SPIKE" />}
                      <span className="font-mono font-bold tabular-nums text-amber-200 text-[11px] w-9 text-right">{n(p.fp).toFixed(1)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Market reaction strip */}
        {!compact && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/55">Market Reaction</span>
            {intel.mvp && n(intel.mvp.fp) >= 40 && (
              <Pill icon={<TrendingUp className="h-2.5 w-2.5" />} tone="emerald" label={`SELL HIGH · ${intel.mvp.name}`} />
            )}
            {intel.valueAce && (
              <Pill icon={<DollarSign className="h-2.5 w-2.5" />} tone="amber" label={`WAIVER TARGET · ${intel.valueAce.name}`} />
            )}
            {players.filter((p) => n(p.fp) >= 30 && n(p.salary) <= 4).slice(0, 1).map((p) => (
              <Pill key={p.player_id} icon={<Crown className="h-2.5 w-2.5" />} tone="violet" label={`CAPTAIN EDGE · ${p.name}`} />
            ))}
            {players.filter((p) => n(p.mp) >= 30 && n(p.fp) <= 12).slice(0, 1).map((p) => (
              <Pill key={`r-${p.player_id}`} icon={<AlertTriangle className="h-2.5 w-2.5" />} tone="rose" label={`COLD · ${p.name}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const CHIP_TONE: Record<string, string> = {
  amber: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  sky: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  rose: "border-rose-400/40 bg-rose-400/15 text-rose-200",
  emerald: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
};

function Badge({ tone, icon, label }: { tone: "amber" | "emerald" | "sky"; icon: React.ReactNode; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1 py-px rounded border text-[8.5px] font-heading font-bold tracking-[0.14em]",
      CHIP_TONE[tone],
    )}>{icon}{label}</span>
  );
}

function Pill({ tone, icon, label }: { tone: "amber" | "emerald" | "rose" | "violet"; icon: React.ReactNode; label: string }) {
  const map: Record<string, string> = {
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    rose: "border-rose-400/40 bg-rose-400/10 text-rose-200",
    violet: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-heading font-bold tracking-[0.16em]", map[tone])}>
      {icon}{label}
    </span>
  );
}

function buildRecap({
  homeTeam, awayTeam, homePts, awayPts, mvp, valueAce,
}: { homeTeam: string; awayTeam: string; homePts: number; awayPts: number; mvp: any; valueAce: any }) {
  const winner = homePts > awayPts ? homeTeam : awayTeam;
  const loser = homePts > awayPts ? awayTeam : homeTeam;
  const diff = Math.abs(homePts - awayPts);
  const tone = diff >= 20 ? "controlled" : diff >= 10 ? "pulled away from" : "edged";
  const mvpLine = mvp ? `${mvp.name} led the slate with ${n(mvp.fp).toFixed(1)} fantasy points` : "Production was spread across the roster";
  const valueLine = valueAce && valueAce.player_id !== mvp?.player_id
    ? `, while ${valueAce.name} generated elite value at $${n(valueAce.salary).toFixed(1)}M`
    : "";
  return `${winner} ${tone} ${loser} ${homePts}-${awayPts}. ${mvpLine}${valueLine}.`;
}