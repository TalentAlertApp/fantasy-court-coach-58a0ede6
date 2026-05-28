import { useMemo, useState } from "react";
import { Flame, TrendingUp, Crown, AlertTriangle, DollarSign, Activity, Zap, Sparkles } from "lucide-react";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import PlayerModal from "@/components/PlayerModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTeamLogo } from "@/lib/nba-teams";
import { useLeague } from "@/contexts/LeagueContext";
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
  const { league } = useLeague();
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
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
            <div className="rounded-lg border border-amber-400/30 bg-gradient-to-br from-black/60 via-black/40 to-black/60 px-3 py-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-amber-200/90">Recap Story</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-white/90">{recap}</p>
            </div>

            {/* Intelligence chips */}
            {intel.chips.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-3">
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/55 mb-2">Game Intelligence</div>
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
              <button
                type="button"
                onClick={() => intel.mvp.player_id && setOpenPlayerId(Number(intel.mvp.player_id))}
                className="group relative w-full text-left overflow-hidden rounded-lg border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-black/40 to-black/60 px-3 py-3.5 hover:border-violet-300/60 transition-colors"
              >
                {(() => {
                  const wm = getTeamLogo(intel.mvp.team, league);
                  return wm ? (
                    <img
                      src={wm}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 h-16 w-16 object-contain opacity-25 transition-all duration-300 ease-out group-hover:scale-125 group-hover:opacity-60 group-hover:drop-shadow-[0_0_12px_rgba(252,211,77,0.5)]"
                    />
                  ) : null;
                })()}
                <div className="relative flex items-center gap-1.5 mb-2">
                  <Crown className="h-3 w-3 text-violet-300" />
                  <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-violet-200">Captain Edge</span>
                </div>
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-7 w-7 shrink-0 ring-2 ring-violet-300/50">
                      {intel.mvp.photo && <AvatarImage src={intel.mvp.photo} alt={intel.mvp.name} className="object-cover object-[center_15%]" />}
                      <AvatarFallback className="text-[9px]">{intel.mvp.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-[12.5px] font-bold text-white truncate">{intel.mvp.name}</span>
                  </div>
                  <span className="font-mono font-black text-amber-200 tabular-nums text-sm shrink-0 pr-1">{(n(intel.mvp.fp) * 2).toFixed(1)} <span className="text-[9px] font-heading uppercase tracking-wider text-white/50">C·FP</span></span>
                </div>
              </button>
            )}
          </>
        ) : (
          <>
            {/* Top Performers */}
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/70">Top Fantasy Performers</span>
              </div>
              <ul className="space-y-1.5">
                {intel.top5.map((p, i) => {
                  const isMvp = i === 0;
                  const isValue = p.player_id === intel.valueAce?.player_id;
                  const tLogo = getTeamLogo(p.team, league);
                  return (
                    <li key={p.player_id} className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn("font-mono w-3 text-[9.5px]", isMvp ? "text-amber-300" : "text-white/40")}>{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => p.player_id && setOpenPlayerId(Number(p.player_id))}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left hover:text-amber-200 transition-colors"
                      >
                        <span className="truncate font-medium text-white/90">{p.name}</span>
                        {tLogo && <img src={tLogo} alt={p.team} className="h-3.5 w-3.5 shrink-0 object-contain" />}
                      </button>
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
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/70">Market Reaction</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {intel.mvp && n(intel.mvp.fp) >= 40 && (
                  <Pill icon={<TrendingUp className="h-2.5 w-2.5" />} tone="emerald" label="SELL HIGH" player={intel.mvp} onOpen={setOpenPlayerId} />
                )}
                {intel.valueAce && (
                  <Pill icon={<DollarSign className="h-2.5 w-2.5" />} tone="amber" label="WAIVER" player={intel.valueAce} onOpen={setOpenPlayerId} />
                )}
                {players.filter((p) => n(p.fp) >= 30 && n(p.salary) <= 4).slice(0, 1).map((p) => (
                  <Pill key={p.player_id} icon={<Crown className="h-2.5 w-2.5" />} tone="violet" label="CAPTAIN" player={p} onOpen={setOpenPlayerId} />
                ))}
                {players.filter((p) => n(p.mp) >= 30 && n(p.fp) <= 12).slice(0, 1).map((p) => (
                  <Pill key={`r-${p.player_id}`} icon={<AlertTriangle className="h-2.5 w-2.5" />} tone="rose" label="COLD" player={p} onOpen={setOpenPlayerId} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <PlayerModal
        playerId={openPlayerId}
        open={openPlayerId !== null}
        onOpenChange={(o) => !o && setOpenPlayerId(null)}
      />
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

function Pill({
  tone, icon, label, player, onOpen,
}: {
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  label: string;
  player?: { player_id?: number | string; name: string; photo?: string };
  onOpen?: (id: number) => void;
}) {
  const clickable = !!player?.player_id && !!onOpen;
  const content = (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-heading font-bold tracking-[0.16em]", TONE[tone], clickable && "hover:brightness-125 transition")}>
      {icon}
      <span>{label}</span>
      {player && (
        <>
          <span className="opacity-60">·</span>
          {player.photo && (
            <img
              src={player.photo}
              alt=""
              className="h-4 w-4 rounded-full object-cover object-[center_15%] ring-1 ring-white/20"
            />
          )}
          <span className="normal-case tracking-normal">{player.name}</span>
        </>
      )}
    </span>
  );
  if (clickable) {
    return (
      <button type="button" onClick={() => onOpen!(Number(player!.player_id))}>
        {content}
      </button>
    );
  }
  return content;
}