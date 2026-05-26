import { useMemo } from "react";
import { Activity, Sparkles, TrendingUp, Flame, Shield, Zap, Trophy } from "lucide-react";
import { useStandingsContext } from "@/hooks/useStandingsContext";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { cn } from "@/lib/utils";

interface Props {
  side: "left" | "right";
  homeTeam: string;
  awayTeam: string;
}

const TONE: Record<string, string> = {
  amber: "border-amber-400/45 bg-amber-400/15 text-amber-200",
  sky: "border-sky-400/45 bg-sky-400/15 text-sky-200",
  rose: "border-rose-400/45 bg-rose-400/15 text-rose-200",
  emerald: "border-emerald-400/45 bg-emerald-400/15 text-emerald-200",
  violet: "border-violet-400/45 bg-violet-400/15 text-violet-200",
};

const n = (v: unknown, d = 0) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : d;
};

export default function GameBallersIQScheduledPanel({ side, homeTeam, awayTeam }: Props) {
  const { standingsByTeam, last5DetailByTeam, isLoading } = useStandingsContext();
  const a = standingsByTeam[awayTeam];
  const h = standingsByTeam[homeTeam];

  const intel = useMemo(() => {
    if (!a || !h) return null;
    const diffPct = (n(a.pct) - n(h.pct)) * 100;
    const favorite = diffPct >= 0 ? awayTeam : homeTeam;
    const underdog = diffPct >= 0 ? homeTeam : awayTeam;
    const formA = (last5DetailByTeam[awayTeam] ?? []).map((g) => g.result).join("");
    const formH = (last5DetailByTeam[homeTeam] ?? []).map((g) => g.result).join("");
    const winsA = (formA.match(/W/g) ?? []).length;
    const winsH = (formH.match(/W/g) ?? []).length;
    const pace = (n(a.ppg) + n(h.ppg)) / 2;
    const defEdgeTeam = n(a.oppPpg) < n(h.oppPpg) ? awayTeam : homeTeam;
    const offEdgeTeam = n(a.ppg) > n(h.ppg) ? awayTeam : homeTeam;
    const chips: { label: string; tone: keyof typeof TONE }[] = [];
    if (Math.abs(diffPct) >= 15) chips.push({ label: "CLEAR FAVORITE", tone: "amber" });
    if (Math.abs(diffPct) < 5) chips.push({ label: "EVEN MATCHUP", tone: "rose" });
    if (pace >= 110) chips.push({ label: "HIGH PACE", tone: "amber" });
    if (pace > 0 && pace <= 95) chips.push({ label: "LOW PACE", tone: "sky" });
    if (winsA >= 4 || winsH >= 4) chips.push({ label: "HOT STREAK", tone: "emerald" });
    if (winsA <= 1 && winsH <= 1) chips.push({ label: "COLD SLATE", tone: "violet" });
    return { diffPct, favorite, underdog, formA, formH, winsA, winsH, pace, defEdgeTeam, offEdgeTeam, chips };
  }, [a, h, awayTeam, homeTeam, last5DetailByTeam]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] font-heading uppercase tracking-[0.18em] text-amber-200/70">
        Loading Ballers.IQ…
      </div>
    );
  }
  if (!intel || !a || !h) {
    return (
      <div className="h-full flex items-center justify-center px-3 text-center text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
        No matchup data yet
      </div>
    );
  }

  const story = `${intel.favorite} enters favored (${(Math.abs(intel.diffPct)).toFixed(1)}% W% edge). ${intel.offEdgeTeam} owns the offensive edge; ${intel.defEdgeTeam} controls defensively. Watch the pace battle around ${intel.pace.toFixed(1)} PPG.`;

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
        <div className="flex items-center gap-2">
          <BallersIQBrand variant="emblem" size="sm" forceTheme="dark" transparent />
          <span className="text-[9.5px] font-heading font-bold uppercase tracking-[0.24em] text-amber-200">
            Ballers.IQ Live
          </span>
          <span className="ml-auto text-[8.5px] font-heading uppercase tracking-[0.2em] text-white/45">
            {side === "left" ? "Matchup" : "Edges"}
          </span>
        </div>

        {side === "left" ? (
          <>
            <div className="rounded-lg border border-amber-400/30 bg-gradient-to-br from-black/60 via-black/40 to-black/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Activity className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-amber-200/90">Matchup Story</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-white/90">{story}</p>
            </div>

            {intel.chips.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/55 mb-1.5">Matchup Intelligence</div>
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

            <div className="rounded-lg border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-black/40 to-black/60 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Trophy className="h-3 w-3 text-violet-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-violet-200">Lean</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-bold text-white truncate">{intel.favorite}</span>
                <span className="font-mono font-black text-amber-200 tabular-nums text-sm">
                  {Math.abs(intel.diffPct).toFixed(1)}%
                  <span className="text-[9px] font-heading uppercase tracking-wider text-white/50 ml-1">W% EDGE</span>
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Flame className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/70">Team Edges</span>
              </div>
              <ul className="space-y-1.5 text-[11px]">
                <EdgeRow icon={<TrendingUp className="h-3 w-3 text-amber-300" />} label="Offense" value={`${intel.offEdgeTeam} · ${Math.max(n(a.ppg), n(h.ppg)).toFixed(1)} PPG`} />
                <EdgeRow icon={<Shield className="h-3 w-3 text-sky-300" />} label="Defense" value={`${intel.defEdgeTeam} · ${Math.min(n(a.oppPpg), n(h.oppPpg)).toFixed(1)} OPP`} />
                <EdgeRow icon={<Zap className="h-3 w-3 text-emerald-300" />} label="Form" value={`${awayTeam} ${intel.winsA}W · ${homeTeam} ${intel.winsH}W (L5)`} />
                <EdgeRow icon={<Activity className="h-3 w-3 text-violet-300" />} label="Pace" value={`${intel.pace.toFixed(1)} avg PPG`} />
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/70">Fantasy Angles</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {intel.pace >= 105 && <Pill tone="amber" icon={<Flame className="h-2.5 w-2.5" />} label="STACK GAME" />}
                <Pill tone="emerald" icon={<TrendingUp className="h-2.5 w-2.5" />} label={`TARGET · ${intel.offEdgeTeam}`} />
                <Pill tone="sky" icon={<Shield className="h-2.5 w-2.5" />} label={`FADE vs ${intel.defEdgeTeam}`} />
                {Math.abs(intel.diffPct) >= 15 && <Pill tone="violet" icon={<Trophy className="h-2.5 w-2.5" />} label={`CAPTAIN · ${intel.favorite}`} />}
                {Math.abs(intel.diffPct) < 5 && <Pill tone="rose" icon={<Zap className="h-2.5 w-2.5" />} label="COIN FLIP" />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EdgeRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2">
      {icon}
      <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-white/55 w-14">{label}</span>
      <span className="text-white/90 font-medium truncate flex-1">{value}</span>
    </li>
  );
}

function Pill({ tone, icon, label }: { tone: keyof typeof TONE; icon: React.ReactNode; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-heading font-bold tracking-[0.16em]", TONE[tone])}>
      {icon}{label}
    </span>
  );
}