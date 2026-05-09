import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Star, Clock, ExternalLink, Flame, ArrowRight, Brain, TrendingUp, Calendar, DollarSign, Shield, PlayCircle } from "lucide-react";
import { getTeamLogo, getTeamByTricode } from "@/lib/nba-teams";
import courtBg from "@/assets/court-bg.png";
import { format } from "date-fns";
import type { CourtShowSlideItem, MatchupGame, RecapGame, AIBallersIQCard, AIIndexKind } from "./types";
import { cn } from "@/lib/utils";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import RotatingBallersIQBadge from "./RotatingBallersIQBadge";
import TopPerformerBlock from "./TopPerformerBlock";

const LABEL_STYLES: Record<string, string> = {
  "STOCK ALERT": "bg-sky-400/15 text-sky-300 border-sky-400/40",
  "USAGE MONSTER": "bg-purple-400/15 text-purple-300 border-purple-400/40",
  "GLASS CLEANER": "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  "TWO-WAY JUICE": "bg-orange-400/15 text-orange-300 border-orange-400/40",
  "VALUE POP": "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  "CAPTAIN MATERIAL": "bg-amber-400/20 text-amber-300 border-amber-400/50",
  "TRAP GAME": "bg-red-400/15 text-red-300 border-red-400/40",
  "SLATE HAMMER": "bg-amber-400/20 text-amber-300 border-amber-400/50",
};

function StoryBadge({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md border text-[9px] font-heading font-black uppercase tracking-[0.14em]",
      LABEL_STYLES[label] ?? "border-white/20 text-white/70 bg-white/5",
    )}>{label}</span>
  );
}

function BallersIQInline({
  headline,
  body,
  tone = "amber",
}: {
  headline: string;
  body: string;
  tone?: "amber" | "emerald" | "sky";
}) {
  const accent =
    tone === "emerald"
      ? "border-emerald-400/30 from-emerald-400/[0.06]"
      : tone === "sky"
      ? "border-sky-400/30 from-sky-400/[0.06]"
      : "border-amber-400/30 from-amber-400/[0.06]";
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "relative mt-3 rounded-lg border bg-gradient-to-br to-transparent p-2.5 overflow-hidden",
        accent,
      )}
    >
      <div className="absolute -top-2 -right-2 opacity-[0.18] pointer-events-none">
        <BallersIQBrand variant="emblem" size="lg" forceTheme="dark" />
      </div>
      <div className="relative flex items-center gap-1.5 mb-1">
        <BallersIQBrand variant="wordmark" size="sm" forceTheme="dark" />
      </div>
      <p className="relative text-[11px] font-heading font-black uppercase tracking-wider text-white leading-tight">
        {headline}
      </p>
      <p className="relative text-[10.5px] text-white/70 leading-snug mt-0.5">{body}</p>
    </div>
  );
}

function recapBlurb(g: RecapGame): { headline: string; body: string } {
  const margin = g.margin;
  const mood =
    margin >= 20 ? "Blowout" : margin >= 10 ? "Comfortable win" : margin >= 5 ? "Solid win" : "Coin flip";
  const top = g.topPerformer;
  const headline = top
    ? `${top.name} powers ${g.winner} (${top.fp.toFixed(1)} FP)`
    : `${g.winner} closes it out`;
  const stats = top
    ? `${top.pts ?? 0} PTS · ${top.reb ?? 0} REB · ${top.ast ?? 0} AST · ${top.mp ?? 0} MIN`
    : "";
  const body = `${mood} by ${margin}. ${stats}`.trim();
  return { headline, body };
}

function matchupBlurb(g: MatchupGame): { headline: string; body: string } {
  const comp = Math.round(g.competitiveScore);
  const heat =
    comp >= 80 ? "Marquee matchup" : comp >= 60 ? "High-stakes tilt" : comp >= 40 ? "Solid slate game" : "Sleeper spot";
  const headline = g.label ? `${g.label} · ${g.away_team} @ ${g.home_team}` : `${heat}: ${g.away_team} @ ${g.home_team}`;
  const parts: string[] = [];
  if (g.competitiveScore > 0) parts.push(`Competitive ${comp}`);
  if (g.starPower > 0) parts.push(`Star power ${g.starPower}`);
  if (g.rosterRelevant > 0) parts.push(`${g.rosterRelevant} fantasy-rel.`);
  return { headline, body: parts.join(" · ") || "Watch tipoff for fantasy edges." };
}


interface Props {
  slide: CourtShowSlideItem;
  onPlayerClick: (id: number) => void;
  onTeamClick: (tri: string) => void;
  onGameClick: (game: RecapGame | MatchupGame) => void;
  onOutroAction?: () => void;
}

function fmtDeadline(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "EEE, MMM d · HH:mm");
  } catch { return ""; }
}

function TeamBadge({ tricode, size = 56, onClick }: { tricode: string; size?: number; onClick?: () => void }) {
  const logo = getTeamLogo(tricode);
  const team = getTeamByTricode(tricode);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1 hover:scale-105 transition-transform"
    >
      {logo ? (
        <img src={logo} alt={tricode} style={{ height: size, width: size }} className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]" />
      ) : (
        <div style={{ height: size, width: size }} className="rounded-full bg-white/10" />
      )}
      <span className="font-heading font-black text-xs uppercase tracking-wider text-white/90">{tricode}</span>
      {team?.name && <span className="text-[9px] text-white/50 hidden md:block">{team.name}</span>}
    </button>
  );
}

function PlayerHero({ p, onClick, accent = "amber" }: { p: { player_id: number; name: string; team: string; photo: string | null }; onClick: () => void; accent?: string }) {
  const logo = getTeamLogo(p.team);
  const ring = accent === "amber" ? "ring-amber-400/60" : accent === "red" ? "ring-red-400/60" : "ring-sky-400/60";
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-2">
      <div className={cn("relative h-24 w-24 rounded-full overflow-hidden ring-2 transition-transform group-hover:scale-105", ring)}>
        {p.photo ? (
          <img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-white/10" />
        )}
        {logo && <img src={logo} alt="" className="absolute -bottom-1 -right-1 h-8 w-8 object-contain" />}
      </div>
      <div className="text-center">
        <p className="font-heading font-black text-sm text-white leading-tight">{p.name}</p>
        <p className="text-[10px] text-white/60 uppercase tracking-wider">{p.team}</p>
      </div>
    </button>
  );
}

/** Inline team logo + tricode used inside Ballers.IQ cards.
 *  No container; surge on hover. Logo position is configurable so callers
 *  can render `[logo] AWY` for the away side and `HOM [logo]` for the home side. */
function InlineTeamMark({
  tri,
  side,
  onClick,
}: {
  tri: string;
  side: "left" | "right";
  onClick?: (tri: string) => void;
}) {
  const logo = getTeamLogo(tri);
  const order = side === "left" ? "flex-row" : "flex-row-reverse";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(tri); }}
      className={cn("group/team inline-flex items-center gap-2", order)}
      aria-label={tri}
    >
      {logo ? (
        <img
          src={logo}
          alt=""
          className="h-7 w-7 object-contain transition-all duration-200 group-hover/team:scale-125 group-hover/team:drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]"
        />
      ) : (
        <span className="h-7 w-7 rounded-full bg-white/10" />
      )}
      <span className="font-heading font-black text-sm tracking-wider text-white/90 group-hover/team:text-amber-300 transition-colors">
        {tri}
      </span>
    </button>
  );
}

function BiqPlayedCard({
  g,
  onGameClick,
  onTeamClick,
  onPlayerClick,
}: {
  g: RecapGame;
  onGameClick: () => void;
  onTeamClick: (tri: string) => void;
  onPlayerClick: (id: number) => void;
}) {
  const awayWon = g.winner === g.away_team;
  const tp = g.topPerformer;
  return (
    <button
      onClick={onGameClick}
      className="group relative w-full text-left rounded-xl border border-amber-400/25 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-white/[0.01] p-4 overflow-hidden transition-all hover:border-amber-400/55 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-12px_rgba(251,191,36,0.35)]"
    >
      {/* sheen sweep */}
      <span aria-hidden className="pointer-events-none absolute -inset-y-2 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[600%] transition-transform duration-1000" />
      <div className="relative flex items-center justify-between gap-2 mb-3">
        <span className="text-[9px] uppercase tracking-[0.32em] font-heading font-black text-emerald-300/80">FINAL · margin {g.margin}</span>
        {g.game_recap_url && (
          <a
            href={g.game_recap_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-amber-300"
          >
            Recap <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <InlineTeamMark tri={g.away_team} side="left" onClick={onTeamClick} />
          <span className={cn("font-mono font-black text-2xl", awayWon ? "text-white" : "text-white/45")}>{g.away_pts}</span>
        </div>
        <span className="text-white/30 font-heading text-xs">—</span>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono font-black text-2xl", !awayWon ? "text-white" : "text-white/45")}>{g.home_pts}</span>
          <InlineTeamMark tri={g.home_team} side="right" onClick={onTeamClick} />
        </div>
      </div>
      {tp && (
        <button
          onClick={(e) => { e.stopPropagation(); onPlayerClick(tp.player_id); }}
          className="relative mt-3 flex items-center gap-3 w-full rounded-lg bg-black/30 border border-white/5 px-3 py-2 text-left hover:border-amber-400/40 hover:bg-black/40 transition-colors"
        >
          {tp.photo ? (
            <img src={tp.photo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-amber-400/40" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-white/10" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Flame className="h-3 w-3 text-amber-400" />
              <span className="font-heading font-black text-[12px] text-white truncate">{tp.name}</span>
              <span className="ml-auto font-mono font-bold text-[12px] text-amber-300">{tp.fp.toFixed(1)} FP</span>
            </div>
            <p className="text-[10px] text-white/55 mt-0.5">
              {(tp.pts ?? 0)} PTS · {(tp.reb ?? 0)} REB · {(tp.ast ?? 0)} AST · {(tp.stl ?? 0)} STL · {(tp.blk ?? 0)} BLK
            </p>
          </div>
        </button>
      )}
    </button>
  );
}

function BiqScheduledCard({
  g,
  onGameClick,
  onTeamClick,
  onPlayerClick,
}: {
  g: MatchupGame;
  onGameClick: () => void;
  onTeamClick: (tri: string) => void;
  onPlayerClick: (id: number) => void;
}) {
  const sp = g.starPlayer ?? null;
  return (
    <button
      onClick={onGameClick}
      className="group relative w-full text-left rounded-xl border border-sky-400/25 bg-gradient-to-br from-sky-400/[0.06] via-white/[0.03] to-white/[0.01] p-4 overflow-hidden transition-all hover:border-amber-400/55 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-12px_rgba(56,189,248,0.35)]"
    >
      <span aria-hidden className="pointer-events-none absolute -inset-y-2 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[600%] transition-transform duration-1000" />
      <div className="relative flex items-center justify-between gap-2 mb-3">
        <span className="text-[9px] uppercase tracking-[0.32em] font-heading font-black text-sky-300/80">
          {g.tipoff_utc ? format(new Date(g.tipoff_utc), "EEE · HH:mm") : "Scheduled"}
        </span>
        {g.label && <StoryBadge label={g.label} />}
      </div>
      <div className="relative flex items-center justify-between gap-3">
        <InlineTeamMark tri={g.away_team} side="left" onClick={onTeamClick} />
        <span className="px-2 py-0.5 rounded-md bg-amber-400/90 text-black text-[10px] font-heading font-black tracking-wider">VS</span>
        <InlineTeamMark tri={g.home_team} side="right" onClick={onTeamClick} />
      </div>
      {g.story && (
        <p className="relative mt-3 text-[12px] text-white/75 leading-snug">
          {g.story}
        </p>
      )}
      <div className="relative mt-2 flex items-center gap-2 flex-wrap text-[10px]">
        {g.competitiveScore > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/65">
            Competitive {g.competitiveScore}
          </span>
        )}
        {g.starPower > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/65">
            Star {g.starPower}
          </span>
        )}
        {g.rosterRelevant > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/65">
            {g.rosterRelevant} fantasy-rel.
          </span>
        )}
      </div>
      {sp && (
        <button
          onClick={(e) => { e.stopPropagation(); onPlayerClick(sp.player_id); }}
          className="relative mt-3 flex items-center gap-3 w-full rounded-lg bg-black/30 border border-white/5 px-3 py-2 text-left hover:border-amber-400/40 hover:bg-black/40 transition-colors"
        >
          {sp.photo ? (
            <img src={sp.photo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-sky-400/40" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-white/10" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Star className="h-3 w-3 text-sky-300 fill-sky-300" />
              <span className="font-heading font-black text-[12px] text-white truncate">{sp.name}</span>
              <span className="ml-auto text-[10px] text-white/40 uppercase tracking-wider">{sp.team}</span>
            </div>
            <p className="text-[10px] text-white/55 mt-0.5">
              Season: {(sp.season_pts ?? 0).toFixed(1)} PTS · {(sp.season_reb ?? 0).toFixed(1)} REB · {(sp.season_ast ?? 0).toFixed(1)} AST · {(sp.season_fp ?? 0).toFixed(1)} FP{sp.gp ? ` (${sp.gp}G)` : ""}
            </p>
          </div>
        </button>
      )}
    </button>
  );
}

export default function CourtShowSlide({ slide, onPlayerClick, onTeamClick, onGameClick, onOutroAction }: Props) {
  const watermarkTri =
    (slide.payload.kind === "performances" && slide.payload.data[0]?.team) ||
    (slide.payload.kind === "value" && slide.payload.data[0]?.team) ||
    (slide.payload.kind === "captain" && slide.payload.data[0]?.team) ||
    (slide.payload.kind === "recap" && slide.payload.data[0]?.winner) ||
    (slide.payload.kind === "matchups" && slide.payload.data[0]?.home_team) ||
    null;
  const watermarkLogo = watermarkTri ? getTeamLogo(watermarkTri) : null;
  const isBiq = slide.payload.kind === "ballersiq";
  const biqWatermark = isBiq ? "/brand/ballers-iq-league-watermark.png" : null;

  return (
    <motion.div
      key={slide.kind}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col"
      style={{
        backgroundImage: `radial-gradient(ellipse at top, hsl(var(--nba-navy)) 0%, #050912 70%)`,
      }}
    >
      {/* court texture */}
      <img src={courtBg} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[0.05] pointer-events-none" />
      {/* oversized blurred team watermark */}
      {watermarkLogo && (
        <img
          src={watermarkLogo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-[420px] w-[420px] object-contain opacity-[0.13] blur-md select-none"
        />
      )}
      {biqWatermark && (
        <img
          src={biqWatermark}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-[420px] w-[420px] object-contain opacity-[0.13] blur-md select-none"
        />
      )}

      {/* header */}
      <div className="relative z-[1] px-8 pt-6 pb-3 shrink-0">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.3em] text-amber-400">Fantasy Court Daily</p>
        <h2 className="font-heading font-black text-2xl md:text-3xl text-white mt-1 leading-tight">{slide.title}</h2>
        {slide.subtitle && <p className="text-xs md:text-sm text-white/60 mt-1">{slide.subtitle}</p>}
      </div>

      {/* body */}
      <div className="relative z-[1] flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {slide.payload.kind === "intro" && (
          <div className="h-full flex flex-col items-center justify-start text-center gap-3 pt-8">
            <motion.div
              initial={{ scale: 0.98 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, duration: 0.5, ease: "easeOut" }}
              className="font-heading font-black text-6xl md:text-8xl text-white tracking-tight"
            >
              GW {slide.payload.data.gw}
              <span className="text-amber-400">.{slide.payload.data.day}</span>
            </motion.div>
            <div className="flex items-center gap-10 mt-1">
              <div className="text-center">
                <p className="text-3xl font-heading font-black text-white">{slide.payload.data.gamesCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/50">Games</p>
              </div>
              {slide.payload.data.deadlineUtc && (
                <div className="text-center">
                  <p className="text-3xl font-heading font-black text-white">{fmtDeadlineShort(slide.payload.data.deadlineUtc)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Deadline</p>
                </div>
              )}
            </div>
            {/* Sponsor sting — premium 3D rotating Ballers.IQ badge */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: 1.1, duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
              className="mt-auto flex flex-col items-center gap-2 pb-4"
            >
              <span className="text-[9px] md:text-[10px] font-heading font-bold uppercase tracking-[0.42em] text-white/45">
                Powered by
              </span>
              <RotatingBallersIQBadge width={460} />
            </motion.div>
          </div>
        )}

        {slide.payload.kind === "performances" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full content-center">
            {slide.payload.data.map((p, i) => (
              <motion.div
                key={p.player_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 hover:border-amber-400/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-heading font-black text-xs">{i + 1}</div>
                  <Trophy className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">{p.fp.toFixed(1)} FP</span>
                  {p.label && <span className="ml-auto"><StoryBadge label={p.label} /></span>}
                </div>
                <PlayerHero p={p} onClick={() => onPlayerClick(p.player_id)} />
                <div className="grid grid-cols-5 gap-1 mt-4 text-center">
                  {[
                    ["PTS", p.pts], ["REB", p.reb], ["AST", p.ast], ["STL", p.stl], ["BLK", p.blk],
                  ].filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k as string} className="rounded-md bg-black/30 py-1.5">
                      <div className="text-sm font-mono font-bold text-white">{v}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/40">{k}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {slide.payload.kind === "value" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full content-center">
            {slide.payload.data.map((p, i) => (
              <motion.div
                key={p.player_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 hover:border-emerald-400/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                    {p.value5 != null ? `${p.value5.toFixed(2)} FP/$M` : `${(p.fp5 ?? 0).toFixed(1)} FP5`}
                  </span>
                  {p.label && <span className="ml-auto"><StoryBadge label={p.label} /></span>}
                </div>
                <PlayerHero p={p} onClick={() => onPlayerClick(p.player_id)} accent="amber" />
                <div className="mt-4 flex items-center justify-around text-center">
                  <div>
                    <div className="text-sm font-mono font-bold text-white">${p.salary?.toFixed(1)}M</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/40">Salary</div>
                  </div>
                  {p.fp5 != null && (
                    <div>
                      <div className="text-sm font-mono font-bold text-white">{p.fp5.toFixed(1)}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/40">FP5</div>
                    </div>
                  )}
                  {p.mpg5 != null && (
                    <div>
                      <div className="text-sm font-mono font-bold text-white">{p.mpg5.toFixed(0)}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/40">MPG</div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {slide.payload.kind === "recap" && (
          <RecapCarousel games={slide.payload.data} onGameClick={onGameClick} onPlayerClick={onPlayerClick} />
        )}

        {slide.payload.kind === "matchups" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {slide.payload.data.map((g, i) => (
              <motion.button
                key={g.game_id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => onGameClick(g)}
                className="group text-left rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 hover:border-amber-400/40 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <TeamBadge tricode={g.away_team} size={56} onClick={() => onTeamClick(g.away_team)} />
                  <div className="flex flex-col items-center">
                    <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-heading font-black tracking-wider">VS</span>
                    {g.tipoff_utc && (
                      <span className="text-[10px] text-white/50 mt-1 font-mono">{format(new Date(g.tipoff_utc), "HH:mm")}</span>
                    )}
                  </div>
                  <TeamBadge tricode={g.home_team} size={56} onClick={() => onTeamClick(g.home_team)} />
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  {g.label && <StoryBadge label={g.label} />}
                </div>
                {g.story && (
                  <p className="mt-3 text-[12px] text-white/75 leading-snug text-center">
                    {g.story}
                  </p>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {slide.payload.kind === "ballersiq" && (() => {
          const d = slide.payload.data;
          const modeLabel =
            d.mode === "mixed" ? "Recap & Matchups"
            : d.mode === "recap" ? "Recap" : "Matchups";
          const cards = d.aiCards ?? [];
          return (
            <div className="relative h-full flex flex-col">
              {/* oversized BIQ emblem watermark */}
              <div className="pointer-events-none absolute -bottom-10 -right-10 opacity-[0.08]">
                <BallersIQBrand variant="emblem" size="lg" forceTheme="dark" />
              </div>

              {/* Header — premium enamel pill + gradient headline */}
              <div className="relative flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-amber-400/5 px-3 py-1 shadow-[0_0_18px_-6px_rgba(251,191,36,0.55)]">
                  <BallersIQBrand variant="wordmark" size="sm" forceTheme="dark" />
                  <span className="text-[10px] uppercase tracking-[0.32em] text-amber-300 font-heading font-black">
                    {modeLabel} · GW {d.gw}.{d.day}
                  </span>
                </span>
              </div>
              <h3 className="relative font-heading font-black text-2xl md:text-3xl mb-1 tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                {d.headline}
              </h3>
              <div className="relative h-px w-24 bg-gradient-to-r from-amber-400 to-transparent mb-5" />

              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 content-start">
                {cards.length === 0 && (
                  <>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-5 h-32 animate-pulse"
                      >
                        <div className="h-3 w-20 bg-white/10 rounded mb-3" />
                        <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                        <div className="h-3 w-2/3 bg-white/5 rounded" />
                      </div>
                    ))}
                  </>
                )}
                {cards.slice(0, 4).map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i, duration: 0.5, ease: [0.22, 0.9, 0.3, 1] }}
                  >
                    <AICardView card={c} onPlayerClick={onPlayerClick} onTeamClick={onTeamClick} />
                  </motion.div>
                ))}
              </div>
              {d.loading && cards.length === 0 && (
                <p className="relative mt-3 text-[10px] uppercase tracking-[0.32em] text-white/40">
                  Generating intelligence…
                </p>
              )}
            </div>
          );
        })()}

        {slide.payload.kind === "captain" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full content-center">
            {slide.payload.data.map((p, i) => (
              <motion.div
                key={p.player_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="rounded-2xl bg-gradient-to-br from-amber-400/10 to-transparent backdrop-blur-sm border border-amber-400/30 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">2× Captain Pick</span>
                  {p.label && <span className="ml-auto"><StoryBadge label={p.label} /></span>}
                </div>
                <PlayerHero p={p} onClick={() => onPlayerClick(p.player_id)} />
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  {p.fp5 != null && (
                    <div className="rounded-md bg-black/30 py-1.5">
                      <div className="text-sm font-mono font-bold text-white">{p.fp5.toFixed(1)}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/40">FP5</div>
                    </div>
                  )}
                  {p.mpg5 != null && (
                    <div className="rounded-md bg-black/30 py-1.5">
                      <div className="text-sm font-mono font-bold text-white">{p.mpg5.toFixed(0)}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/40">MPG</div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {slide.payload.kind === "outro" && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5">
            <div className="text-amber-400">
              <Clock className="h-10 w-10 mx-auto" />
            </div>
            <h3 className="font-heading font-black text-3xl text-white">Set Lineup Before Lock</h3>
            {slide.payload.data.nextDeadlineUtc && (
              <p className="text-base text-white/70">
                Next deadline: <span className="text-amber-400 font-mono">{fmtDeadline(slide.payload.data.nextDeadlineUtc)}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-white/60">
              {slide.payload.data.bestPlayer && (
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-amber-400 font-bold">Best: </span>{slide.payload.data.bestPlayer.name} · {slide.payload.data.bestPlayer.fp.toFixed(1)} FP
                </div>
              )}
              {slide.payload.data.bestValue && (
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-emerald-400 font-bold">Value: </span>{slide.payload.data.bestValue.name}
                </div>
              )}
            </div>
            <button
              onClick={onOutroAction}
              aria-label="Go to My Roster"
              className="mt-4 inline-flex items-center justify-center h-12 w-12 rounded-full bg-amber-400/10 border border-amber-400/40 text-amber-400 hover:bg-amber-400 hover:text-black hover:scale-110 transition-all animate-pulse"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}