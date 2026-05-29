import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import BallersIQBrand from "./BallersIQBrand";
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle, CalendarDays, DollarSign, Repeat, ChevronUp, ChevronDown } from "lucide-react";
import { normalizePlayerHealth, isHealthUnavailable, isHealthRisky, getHealthLabel } from "@/lib/health";

interface MarketPlayer {
  id: number;
  name: string;
  team?: string | null;
  fc_bc?: string | null;
  salary?: number | null;
  fp_pg5?: number | null;
  fp_pg_t?: number | null;
  value5?: number | null;
  delta_fp?: number | null;
  delta_mpg?: number | null;
  injury?: string | null;
}

interface Props {
  market: MarketPlayer[];        // available pool (not on roster)
  rosterPlayers: MarketPlayer[]; // current roster
  bankRemaining: number;
  todayTeams?: string[];
  className?: string;
  onPickPlayer?: (id: number) => void;
}

const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};

function topByMetric<T>(arr: T[], score: (x: T) => number, n = 3): T[] {
  return [...arr].filter((x) => Number.isFinite(score(x))).sort((a, b) => score(b) - score(a)).slice(0, n);
}

export default function BallersIQMarketWatch({
  market, rosterPlayers, bankRemaining, todayTeams = [], className, onPickPlayer,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(() => {
    const affordable = market.filter((p) => num(p.salary) <= bankRemaining + 0.01);

    // Value Adds — best fp_pg5 / salary among affordable
    const valueAdds = topByMetric(affordable.filter((p) => num(p.salary) > 0 && num(p.fp_pg5) > 0),
      (p) => num(p.fp_pg5) / num(p.salary), 3);

    // Buy Low — recently down on form but seasonal fp solid
    const buyLow = topByMetric(affordable.filter((p) => num(p.fp_pg_t) > 0 && num(p.delta_fp) < -1),
      (p) => num(p.fp_pg_t) - Math.abs(num(p.delta_fp)) * 0.3, 3);

    // Schedule Streams — affordable, plays today, decent fp
    const todaySet = new Set(todayTeams);
    const streams = topByMetric(
      affordable.filter((p) => p.team && todaySet.has(p.team) && num(p.fp_pg5) >= 15),
      (p) => num(p.fp_pg5), 3,
    );

    // Salary Traps — high salary, low value5
    const traps = topByMetric(market.filter((p) => num(p.salary) >= 8 && num(p.value5) > 0),
      (p) => -num(p.value5), 3,
    ).filter((p) => num(p.value5) < 1.6);

    // Drop Risks (from roster) — injury OR negative form trend
    const _hh = (p: MarketPlayer) => normalizePlayerHealth(p);
    const _injured = (p: MarketPlayer) => {
      const h = _hh(p);
      return isHealthUnavailable(h) || isHealthRisky(h);
    };
    const dropRisks = topByMetric(
      rosterPlayers.filter((p) => _injured(p) || num(p.delta_fp) < -3 || num(p.delta_mpg) < -4),
      (p) => Math.abs(num(p.delta_fp)) + (_injured(p) ? 5 : 0),
      3,
    );

    // Sell High — roster players overperforming form vs season
    const sellHigh = topByMetric(rosterPlayers.filter((p) => num(p.delta_fp) > 3 && num(p.salary) >= 6),
      (p) => num(p.delta_fp), 3);

    // Best Swap — out = lowest fp_pg5 starter+bench, in = best affordable Value Add of same fc_bc that fits cap
    let bestSwap: { out: MarketPlayer; in: MarketPlayer; fpDelta: number } | null = null;
    if (rosterPlayers.length && valueAdds.length) {
      const candidates: { out: MarketPlayer; in: MarketPlayer; fpDelta: number }[] = [];
      for (const out of rosterPlayers) {
        const cap = bankRemaining + num(out.salary);
        const sameType = market.filter((m) => m.fc_bc === out.fc_bc && num(m.salary) <= cap + 0.01 && num(m.fp_pg5) > num(out.fp_pg5));
        const best = sameType.sort((a, b) => num(b.fp_pg5) - num(a.fp_pg5))[0];
        if (best) candidates.push({ out, in: best, fpDelta: num(best.fp_pg5) - num(out.fp_pg5) });
      }
      bestSwap = candidates.sort((a, b) => b.fpDelta - a.fpDelta)[0] ?? null;
    }

    return { valueAdds, buyLow, streams, traps, dropRisks, sellHigh, bestSwap };
  }, [market, rosterPlayers, bankRemaining, todayTeams]);

  if (!market.length && !rosterPlayers.length) return null;

  const lanesGrid = (
    <div className="relative grid grid-cols-2 gap-2">
      <Lane label="Value Adds" icon={<Sparkles className="h-3 w-3 text-emerald-400" />} tone="emerald"
        rows={data.valueAdds.map((p) => ({ id: p.id, name: p.name, meta: `${num(p.fp_pg5).toFixed(1)} FP5 · $${num(p.salary).toFixed(1)}M` }))}
        onPick={onPickPlayer} />
      <Lane label="Drop Risks" icon={<AlertTriangle className="h-3 w-3 text-red-400" />} tone="red"
        rows={data.dropRisks.map((p) => {
          const h = normalizePlayerHealth(p);
          const meta = (isHealthUnavailable(h) || isHealthRisky(h))
            ? getHealthLabel(h)
            : `Δ${num(p.delta_fp).toFixed(1)} FP`;
          return { id: p.id, name: p.name, meta };
        })}
        onPick={onPickPlayer} />
      <Lane label="Buy Low" icon={<TrendingDown className="h-3 w-3 text-sky-400" />} tone="sky"
        rows={data.buyLow.map((p) => ({ id: p.id, name: p.name, meta: `Δ${num(p.delta_fp).toFixed(1)} · ${num(p.fp_pg_t).toFixed(1)} FPT` }))}
        onPick={onPickPlayer} />
      <Lane label="Sell High" icon={<TrendingUp className="h-3 w-3 text-amber-400" />} tone="amber"
        rows={data.sellHigh.map((p) => ({ id: p.id, name: p.name, meta: `+${num(p.delta_fp).toFixed(1)} Δ · $${num(p.salary).toFixed(1)}M` }))}
        onPick={onPickPlayer} />
      <Lane label="Schedule Streams" icon={<CalendarDays className="h-3 w-3 text-violet-400" />} tone="violet"
        rows={data.streams.map((p) => ({ id: p.id, name: p.name, meta: `${p.team} tonight · ${num(p.fp_pg5).toFixed(1)} FP5` }))}
        onPick={onPickPlayer} />
      <Lane label="Salary Traps" icon={<DollarSign className="h-3 w-3 text-zinc-400" />} tone="zinc"
        rows={data.traps.map((p) => ({ id: p.id, name: p.name, meta: `$${num(p.salary).toFixed(1)}M · V5 ${num(p.value5).toFixed(1)}` }))}
        onPick={onPickPlayer} />
    </div>
  );

  return (
    <section className={cn(
      "relative rounded-xl border border-amber-400/40 p-3 overflow-hidden",
      "bg-amber-400/15 dark:bg-gradient-to-br dark:from-amber-400/[0.05] dark:via-card dark:to-card",
      className,
    )}>
      <BallersIQBrand
        variant="emblem"
        forceTheme="light"
        transparent
        className="pointer-events-none absolute -top-6 -right-6 !h-32 !w-32 object-contain opacity-[0.12] rotate-12 select-none"
      />
      <header className="relative flex items-center gap-2 mb-2">
        <BallersIQBrand variant="wordmark" size="sm" forceTheme="light" transparent className="dark:hidden" />
        <BallersIQBrand variant="wordmark" size="sm" forceTheme="dark" transparent className="hidden dark:block" />
        <span className="text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground border-l border-border pl-2">
          Market Watch
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">Bank ${bankRemaining.toFixed(1)}M</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse market watch" : "Expand market watch"}
          className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-black/20 px-1.5 py-0.5 text-[9px] font-heading font-bold uppercase tracking-wider text-amber-200 transition-colors hover:bg-amber-400/10"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          {expanded ? "Less" : "Expand"}
        </button>
      </header>

      {data.bestSwap && (
        <div className="relative mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Repeat className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] font-heading uppercase tracking-wider text-emerald-300">Best Swap</span>
            <span className="ml-auto text-[10px] font-mono text-emerald-300">+{data.bestSwap.fpDelta.toFixed(1)} FP5</span>
          </div>
          <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
            <button onClick={() => onPickPlayer?.(data.bestSwap!.out.id)} className="text-destructive font-medium hover:underline">↓ {data.bestSwap.out.name}</button>
            <span className="text-muted-foreground">→</span>
            <button onClick={() => onPickPlayer?.(data.bestSwap!.in.id)} className="text-emerald-400 font-medium hover:underline">↑ {data.bestSwap.in.name}</button>
            <span className="text-muted-foreground text-[10px]">${num(data.bestSwap.in.salary).toFixed(1)}M</span>
          </div>
        </div>
      )}

      {/* Lanes grid: hidden by default, expands UPWARD as an overlay to avoid scrolling */}
      {expanded && (
        <div className="absolute inset-x-3 bottom-full mb-2 z-30 rounded-xl border border-amber-400/40 bg-card p-3 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Market Signals
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Collapse market watch"
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-black/20 px-1.5 py-0.5 text-[9px] font-heading font-bold uppercase tracking-wider text-amber-200 transition-colors hover:bg-amber-400/10"
            >
              <ChevronDown className="h-3 w-3" /> Less
            </button>
          </div>
          {lanesGrid}
        </div>
      )}
    </section>
  );
}

const TONE: Record<string, string> = {
  emerald: "border-emerald-500/20",
  red: "border-red-500/20",
  sky: "border-sky-500/20",
  amber: "border-amber-500/20",
  violet: "border-violet-500/20",
  zinc: "border-zinc-500/20",
};

function Lane({
  label, icon, rows, tone, onPick,
}: {
  label: string; icon: React.ReactNode; tone: keyof typeof TONE;
  rows: { id: number; name: string; meta: string }[]; onPick?: (id: number) => void;
}) {
  return (
    <div className={cn("rounded-lg border bg-amber-400/10 dark:bg-card/50 p-2", TONE[tone])}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/70 italic">No signals.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onPick?.(r.id)}
                className="w-full text-left text-[10.5px] flex items-center gap-1.5 hover:bg-muted/40 rounded px-1 py-0.5 transition-colors"
              >
                <span className="font-medium truncate">{r.name}</span>
                <span className="ml-auto font-mono text-[9.5px] text-muted-foreground truncate">{r.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}