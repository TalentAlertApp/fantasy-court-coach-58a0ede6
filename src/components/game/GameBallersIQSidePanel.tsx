import { useMemo } from "react";
import { Flame, TrendingUp, Crown, AlertTriangle, DollarSign, Activity, Zap, Sparkles } from "lucide-react";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { cn } from "@/lib/utils";

interface Props {
  side: "left" | "right";
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homePts: number;
  awayPts: number;
}

const n = (v: unknown, d = 0) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : d;
};

const TONE: Record<string, string> = {
  amber: "border-amber-400/45 bg-amber-400/15 text-amber-200",
  sky: "border-sky-400/45 bg-sky-400/15 text-sky-200",
  rose: "border-rose-400/45 bg-rose-400/15 text-rose-200",
  emerald: "border-emerald-400/45 bg-emerald-400/15 text-emerald-200",
  violet: "border-violet-400/45 bg-violet-400/15 text-violet-200",
};

export default function GameBallersIQSidePanel({
  side, gameId, homeTeam, awayTeam, homePts, awayPts,
}: Props) {
  const { data, isLoading } = useGameBoxscoreQuery(gameId);
  const players = (data?.players ?? []) as any[];

  const intel = useMemo(() => {
    if (!players.length) return null;
    const sorted = [...players].sort((a, b) => n(b.fp) - n(a.fp));
    const mvp = sorted[0];
    const top5 = sorted.slice(0, 5);
    const valueAce = [...players]
      .filter((p) => n(p.salary) > 0 && n(p.fp) > 0)
      .sort((a, b) => n(b.fp) / n(b.salary, 1) - n(a.fp) / n(a.salary, 1))[0];
    const totalPts = homePts + awayPts;
    const chips: { label: string; tone: keyof typeof TONE }[] = [];
    if (totalPts >= 230) chips.push({ label: "HIGH FP GAME", tone: "amber" });
    if (totalPts > 0 && totalPts <= 180) chips.push({ label: "LOW SCORING", tone: "sky" });
    if (Math.abs(homePts - awayPts) <= 4 && totalPts > 0) chips.push({ label: "CLOSE GAME", tone: "rose" });
    if (Math.abs(homePts - awayPts) >= 20) chips.push({ label: "BLOWOUT", tone: "emerald" });
    if (n(mvp?.fp) >= 45) chips.push({ label: "MVP SHOWING", tone: "amber" });
    return { mvp, top5, valueAce, chips };
  }, [players, homePts, awayPts]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] font-heading uppercase tracking-[0.18em] text-amber-200/70">
        Loading Ballers.IQ…
      </div>
    );
  }
  if (!intel) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
        No Ballers.IQ data
      </div>
    );
  }

  const winner = homePts > awayPts ? homeTeam : awayTeam;
  const loser = homePts > awayPts ? awayTeam : homeTeam;
  const diff = Math.abs(homePts - awayPts);
  const tone = diff >= 20 ? "controlled" : diff >= 10 ? "pulled away from" : "edged";
  const mvpLine = intel.mvp ? `${intel.mvp.name} led the slate with ${n(intel.mvp.fp).toFixed(1)} FP` : "Production was spread across the roster";
  const valueLine = intel.valueAce && intel.valueAce.player_id !== intel.mvp?.player_id
    ? ` ${intel.valueAce.name} delivered elite value at $${n(intel.valueAce.salary).toFixed(1)}M.`
    : "";
  const recap = `${winner} ${tone} ${loser} ${homePts}-${awayPts}. ${mvpLine}.${valueLine}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.10),transparent_60%)] bg-black/70 backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent shadow-[0_0_10px_rgba(252,211,77,0.4)]" />
      <BallersIQBrand
        variant="emblem"
        forceTheme="dark"
        transparent
        className="pointer-events-none absolute -bottom-6 -right-6 !h-40 !w-40 object-contain opacity-[0.08] rotate-12 select-none"
      />

      <div className="relative h-full flex flex-col overflow-y-auto px-3 py-2.5 gap-2.5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BallersIQBrand variant="emblem" size="sm" forceTheme="dark" transparent />
          <span className="text-[9.5px] font-heading font-bold uppercase tracking-[0.24em] text-amber-200">
            Ballers.IQ Live
          </span>
          <span className="ml-auto text-[8.5px] font-heading uppercase tracking-[0.2em] text-white/45">
            {side === "left" ? "Recap" : "Market"}
          </span>
        </div>

        {side === "left" ? (
          <>
            {/* Recap card */}
            <div className="rounded-lg border border-amber-400/30 bg-gradient-to-br from-black/60 via-black/40 to-black/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Activity className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-amber-200/90">Recap Story</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-white/90">{recap}</p>
            </div>

            {/* Intelligence chips */}
            {intel.chips.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/55 mb-1.5">Game Intelligence</div>
                <div className="flex flex-wrap gap-1">
                  {intel.chips.map((c) => (
                    <span key={c.label} className={cn(
                      "px-1.5 py-0.5 rounded-md border text-[9px] font-heading font-bold tracking-[0.16em]",
                      TONE[c.tone],
                    )}>{c.label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Captain pick */}
            {intel.mvp && (
              <div className="rounded-lg border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-black/40 to-black/60 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Crown className="h-3 w-3 text-violet-300" />
                  <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-violet-200">Captain Edge</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-bold text-white truncate">{intel.mvp.name}</span>
                  <span className="font-mono font-black text-amber-200 tabular-nums text-sm">{(n(intel.mvp.fp) * 2).toFixed(1)} <span className="text-[9px] font-heading uppercase tracking-wider text-white/50">C·FP</span></span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Top Performers */}
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Flame className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/70">Top Fantasy Performers</span>
              </div>
              <ul className="space-y-1">
                {intel.top5.map((p, i) => {
                  const isMvp = i === 0;
                  const isValue = p.player_id === intel.valueAce?.player_id;
                  return (
                    <li key={p.player_id} className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn("font-mono w-3 text-[9.5px]", isMvp ? "text-amber-300" : "text-white/40")}>{i + 1}</span>
                      <span className="truncate font-medium text-white/90 flex-1 min-w-0">{p.name}</span>
                      <span className="text-[9px] text-white/40 truncate">{p.team}</span>
                      <div className="flex items-center gap-1">
                        {isMvp && <Badge tone="amber" icon={<Flame className="h-2.5 w-2.5" />} label="MVP" />}
                        {isValue && <Badge tone="emerald" icon={<DollarSign className="h-2.5 w-2.5" />} label="VAL" />}
                        {n(p.mp) <= 18 && n(p.fp) >= 25 && <Badge tone="sky" icon={<Zap className="h-2.5 w-2.5" />} label="SPK" />}
                        <span className="font-mono font-bold tabular-nums text-amber-200 text-[11px] w-9 text-right">{n(p.fp).toFixed(1)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Market reaction */}
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/70">Market Reaction</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {intel.mvp && n(intel.mvp.fp) >= 40 && (
                  <Pill icon={<TrendingUp className="h-2.5 w-2.5" />} tone="emerald" label={`SELL HIGH · ${intel.mvp.name}`} />
                )}
                {intel.valueAce && (
                  <Pill icon={<DollarSign className="h-2.5 w-2.5" />} tone="amber" label={`WAIVER · ${intel.valueAce.name}`} />
                )}
                {players.filter((p) => n(p.fp) >= 30 && n(p.salary) <= 4).slice(0, 1).map((p) => (
                  <Pill key={p.player_id} icon={<Crown className="h-2.5 w-2.5" />} tone="violet" label={`CAPTAIN · ${p.name}`} />
                ))}
                {players.filter((p) => n(p.mp) >= 30 && n(p.fp) <= 12).slice(0, 1).map((p) => (
                  <Pill key={`r-${p.player_id}`} icon={<AlertTriangle className="h-2.5 w-2.5" />} tone="rose" label={`COLD · ${p.name}`} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Badge({ tone, icon, label }: { tone: keyof typeof TONE; icon: React.ReactNode; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1 py-px rounded border text-[8.5px] font-heading font-bold tracking-[0.14em]",
      TONE[tone],
    )}>{icon}{label}</span>
  );
}

function Pill({ tone, icon, label }: { tone: keyof typeof TONE; icon: React.ReactNode; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-heading font-bold tracking-[0.16em]", TONE[tone])}>
      {icon}{label}
    </span>
  );
}