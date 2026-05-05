import { motion } from "framer-motion";
import { Trophy, Zap, Star, Clock, ExternalLink, Flame, ArrowRight } from "lucide-react";
import { getTeamLogo, getTeamByTricode } from "@/lib/nba-teams";
import courtBg from "@/assets/court-bg.png";
import { format } from "date-fns";
import type { CourtShowSlideItem, MatchupGame, RecapGame } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  slide: CourtShowSlideItem;
  onPlayerClick: (id: number) => void;
  onTeamClick: (tri: string) => void;
  onGameClick: (game: RecapGame | MatchupGame) => void;
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

export default function CourtShowSlide({ slide, onPlayerClick, onTeamClick, onGameClick }: Props) {
  const watermarkTri =
    (slide.payload.kind === "performances" && slide.payload.data[0]?.team) ||
    (slide.payload.kind === "value" && slide.payload.data[0]?.team) ||
    (slide.payload.kind === "captain" && slide.payload.data[0]?.team) ||
    (slide.payload.kind === "recap" && slide.payload.data[0]?.winner) ||
    (slide.payload.kind === "matchups" && slide.payload.data[0]?.home_team) ||
    null;
  const watermarkLogo = watermarkTri ? getTeamLogo(watermarkTri) : null;

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

      {/* header */}
      <div className="relative z-[1] px-8 pt-6 pb-3 shrink-0">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.3em] text-amber-400">Fantasy Court Daily</p>
        <h2 className="font-heading font-black text-2xl md:text-3xl text-white mt-1 leading-tight">{slide.title}</h2>
        {slide.subtitle && <p className="text-xs md:text-sm text-white/60 mt-1">{slide.subtitle}</p>}
      </div>

      {/* body */}
      <div className="relative z-[1] flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {slide.payload.kind === "intro" && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <div className="font-heading font-black text-6xl md:text-8xl text-white tracking-tight">
              GW {slide.payload.data.gw}
              <span className="text-amber-400">.{slide.payload.data.day}</span>
            </div>
            <p className="text-base md:text-lg text-white/80 font-heading uppercase tracking-widest">{slide.payload.data.dateLabel}</p>
            <div className="flex items-center gap-6 mt-3">
              <div className="text-center">
                <p className="text-3xl font-heading font-black text-white">{slide.payload.data.gamesCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/50">Games</p>
              </div>
              {slide.payload.data.deadlineUtc && (
                <div className="text-center">
                  <p className="text-sm font-mono font-bold text-amber-400 flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDeadline(slide.payload.data.deadlineUtc)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Deadline</p>
                </div>
              )}
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {slide.payload.data.map((g, i) => (
              <motion.button
                key={g.game_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => onGameClick(g)}
                className="group text-left rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 hover:border-amber-400/40 transition-all hover:bg-white/[0.07]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <TeamBadge tricode={g.away_team} size={40} onClick={() => { /* swallow */ }} />
                    <span className={cn("font-mono font-black text-2xl", g.winner === g.away_team ? "text-white" : "text-white/50")}>
                      {g.away_pts}
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-400/70 font-bold">FINAL</div>
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className={cn("font-mono font-black text-2xl", g.winner === g.home_team ? "text-white" : "text-white/50")}>
                      {g.home_pts}
                    </span>
                    <TeamBadge tricode={g.home_team} size={40} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-white/50">
                  <span>Margin: {g.margin}</span>
                  {g.topPerformer && (
                    <span className="flex items-center gap-1 text-amber-400/80"><Flame className="h-3 w-3" />{g.topPerformer.name} · {g.topPerformer.fp.toFixed(1)} FP</span>
                  )}
                </div>
                {(g.nba_game_url || g.game_recap_url) && (
                  <div className="mt-2 flex gap-2">
                    {g.game_recap_url && (
                      <a href={g.game_recap_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-white/60 hover:text-amber-400 inline-flex items-center gap-1">Recap <ExternalLink className="h-2.5 w-2.5" /></a>
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
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
              </motion.button>
            ))}
          </div>
        )}

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
            <ArrowRight className="h-6 w-6 text-amber-400 mt-4 animate-pulse" />
          </div>
        )}
      </div>
    </motion.div>
  );
}