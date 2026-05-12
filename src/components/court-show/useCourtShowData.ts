import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useLeagueDeadlines } from "@/hooks/useLeagueDeadlines";
import type { Deadline } from "@/lib/deadlines";
import {
  normalizePlayerHealth,
  isHealthUnavailable,
  isHealthRisky,
  type PlayerHealth,
} from "@/lib/health";
import type {
  CourtShowData,
  CourtShowSlideItem,
  TopPerformer,
  ValuePlay,
  RecapGame,
  MatchupGame,
  CaptainPick,
  StoryLabel,
  AIBallersIQCard,
  OutstandingGameRow,
  HealthWatchPlayer,
} from "./types";

function buildWeekDayDate(deadlines: Deadline[], gw: number, day: number): string {
  const d = deadlines.find((x) => x.gw === gw && x.day === day);
  if (!d) return "";
  return new Date(d.deadline_utc).toISOString().slice(0, 10);
}

function fpFromLog(l: any): number {
  if (l.fp != null) return Number(l.fp);
  return (l.pts ?? 0) + (l.reb ?? 0) + 2 * (l.ast ?? 0) + 3 * (l.stl ?? 0) + 3 * (l.blk ?? 0);
}

function performerLabel(l: any): StoryLabel | undefined {
  const pts = l.pts ?? 0, reb = l.reb ?? 0, ast = l.ast ?? 0, stl = l.stl ?? 0, blk = l.blk ?? 0;
  const stocks = stl + blk;
  if (stocks >= 4) return "STOCK ALERT";
  if (reb >= 12) return "GLASS CLEANER";
  if (pts + ast * 2 >= 40 && ast >= 6) return "USAGE MONSTER";
  if (pts >= 18 && stocks >= 2 && ast >= 4) return "TWO-WAY JUICE";
  return undefined;
}

function valueLabel(v: { fp5?: number; salary: number; value5?: number }): StoryLabel | undefined {
  if ((v.value5 ?? 0) >= 4 || ((v.fp5 ?? 0) >= 30 && v.salary <= 8)) return "VALUE POP";
  return undefined;
}

function captainLabel(c: { fp5?: number; mpg5?: number }): StoryLabel | undefined {
  if ((c.fp5 ?? 0) >= 40 && (c.mpg5 ?? 0) >= 32) return "CAPTAIN MATERIAL";
  return undefined;
}

export function useCourtShowData(gw: number, day: number) {
  const { data: scheduleData, isLoading: schedLoading } = useScheduleQuery({ gw, day });
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 1000 });
  const { data: rosterData } = useRosterQuery();
  const { data: leagueId } = useLeagueId();
  const { deadlines } = useLeagueDeadlines();
  const queryClient = useQueryClient();

  const games = scheduleData?.games ?? [];
  const finalGameIds = useMemo(
    () => games.filter((g: any) => (g.status ?? "").toUpperCase().includes("FINAL")).map((g: any) => g.game_id),
    [games],
  );

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["court-show-logs", gw, day, finalGameIds.join(",")],
    enabled: finalGameIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_game_logs")
        .select("game_id, player_id, mp, pts, reb, ast, stl, blk, fp, home_away")
        .in("game_id", finalGameIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Ballers.IQ AI cards (cached per league/gw/day) ───────────────────
  const { data: aiRow, isLoading: aiLoading } = useQuery({
    queryKey: ["court-show-ai", leagueId, gw, day],
    enabled: !!leagueId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("court_show_intelligence")
        .select("cards, headline, mode, generated_at")
        .eq("league_id", leagueId!)
        .eq("gw", gw)
        .eq("day", day)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        cards: (data.cards ?? []) as unknown as AIBallersIQCard[],
        headline: (data.headline ?? null) as string | null,
        mode: (data.mode ?? "mixed") as string,
      };
    },
  });

  // Best-effort on-demand generation: if no cached row exists yet, kick off
  // the edge function once. The query above will refresh when invalidated.
  const shouldKickOff = !!leagueId && !aiLoading && aiRow === null && !schedLoading && games.length > 0;
  useQuery({
    queryKey: ["court-show-ai-trigger", leagueId, gw, day, shouldKickOff],
    enabled: shouldKickOff,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const { error } = await supabase.functions.invoke("court-show-intelligence", {
          body: { league_id: leagueId, gw, day },
        });
        if (error) console.warn("[court-show-intelligence] invoke error", error);
        // Refresh the cached AI row now that the function has upserted it.
        await queryClient.invalidateQueries({ queryKey: ["court-show-ai", leagueId, gw, day] });
      } catch (e) {
        console.warn("[court-show-intelligence] invoke threw", e);
      }
      return true;
    },
  });

  const playersById = useMemo(() => {
    const m = new Map<number, any>();
    for (const p of playersData?.items ?? []) m.set(p.core.id, p);
    return m;
  }, [playersData?.items]);

  const rosterIds = useMemo(() => {
    const ids = new Set<number>();
    for (const id of (rosterData?.roster?.starters ?? [])) if (id > 0) ids.add(id);
    for (const id of (rosterData?.roster?.bench ?? [])) if (id > 0) ids.add(id);
    return ids;
  }, [rosterData?.roster]);

  const data = useMemo<CourtShowData | null>(() => {
    if (schedLoading || playersLoading) return null;

    const dateStr = buildWeekDayDate(deadlines, gw, day);
    const dateLabel = dateStr
      ? format(parse(dateStr, "yyyy-MM-dd", new Date()), "EEE, MMM d")
      : "";
    const deadline = deadlines.find((d) => d.gw === gw && d.day === day);
    const teamsOnSlate = new Set<string>();
    for (const g of games) { teamsOnSlate.add(g.home_team); teamsOnSlate.add(g.away_team); }

    const slides: CourtShowSlideItem[] = [];

    // ── Intro ──────────────────────────────────────────────────────────
    slides.push({
      kind: "intro",
      title: "Fantasy Court Daily",
      payload: {
        kind: "intro",
        data: {
          gw, day, dateLabel,
          gamesCount: games.length,
          deadlineUtc: deadline?.deadline_utc ?? null,
        },
      },
    });

    const allLogs = logs ?? [];

    // ── Performances ──────────────────────────────────────────────────
    // Rank by FP, tiebreak with box-score completeness (count of meaningful stats)
    const perfRanked = [...allLogs]
      .filter((l: any) => (l.mp ?? 0) > 0)
      .map((l: any) => {
        const completeness =
          (l.pts ? 1 : 0) + (l.reb ? 1 : 0) + (l.ast ? 1 : 0) + (l.stl ? 1 : 0) + (l.blk ? 1 : 0);
        return { l, fp: fpFromLog(l), completeness };
      })
      .sort((a, b) => b.fp - a.fp || b.completeness - a.completeness || (b.l.mp ?? 0) - (a.l.mp ?? 0));

    const performers: TopPerformer[] = perfRanked.slice(0, 3).map(({ l, fp }) => {
      const p = playersById.get(l.player_id);
      return {
        player_id: l.player_id,
        name: p?.core?.name ?? `#${l.player_id}`,
        team: p?.core?.team ?? "",
        photo: p?.core?.photo ?? null,
        fc_bc: p?.core?.fc_bc,
        fp,
        pts: l.pts, reb: l.reb, ast: l.ast, stl: l.stl, blk: l.blk, mp: l.mp,
        label: performerLabel(l),
        onRosterCount: rosterIds.has(l.player_id) ? 1 : 0,
      } as TopPerformer;
    });

    if (performers.length) {
      slides.push({
        kind: "performances",
        title: "Outstanding Performances",
        subtitle: "Top fantasy producers from played games",
        payload: { kind: "performances", data: performers },
      });
    }

    // ── Value Plays ───────────────────────────────────────────────────
    // Salary efficiency: prefer value5; require minutes security and meaningful FP
    const valuePool = (playersData?.items ?? [])
      .filter((p: any) => teamsOnSlate.has(p.core.team) && (p.core.salary ?? 0) > 0)
      .map((p: any) => ({
        player_id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo ?? null,
        salary: p.core.salary,
        fp5: p.last5?.fp5,
        value5: p.last5?.value5,
        mpg5: p.last5?.mpg5,
      }))
      .filter((v: any) => (v.fp5 ?? 0) >= 18 && (v.mpg5 ?? 0) >= 22 && v.salary <= 9);

    const valueRanked: ValuePlay[] = [...valuePool]
      .sort((a, b) => {
        const va = a.value5 ?? (a.fp5 ?? 0) / Math.max(a.salary, 1);
        const vb = b.value5 ?? (b.fp5 ?? 0) / Math.max(b.salary, 1);
        return vb - va;
      })
      .slice(0, 3)
      .map((v) => ({ ...v, label: valueLabel(v) }));

    if (valueRanked.length) {
      slides.push({
        kind: "value",
        title: "Best Value Plays",
        subtitle: "Salary-efficient producers with secure minutes",
        payload: { kind: "value", data: valueRanked },
      });
    }

    // ── Recap ─────────────────────────────────────────────────────────
    const topByGame: Record<string, TopPerformer> = {};
    for (const l of allLogs) {
      const p = playersById.get(l.player_id);
      const tp: TopPerformer = {
        player_id: l.player_id,
        name: p?.core?.name ?? `#${l.player_id}`,
        team: p?.core?.team ?? "",
        photo: p?.core?.photo ?? null,
        fp: fpFromLog(l),
        pts: l.pts, reb: l.reb, ast: l.ast, stl: l.stl, blk: l.blk,
      };
      const cur = topByGame[l.game_id];
      if (!cur || tp.fp > cur.fp) topByGame[l.game_id] = tp;
    }
    const recap: RecapGame[] = games
      .filter((g: any) => (g.status ?? "").toUpperCase().includes("FINAL"))
      .map((g: any) => {
        const home = g.home_pts ?? 0, away = g.away_pts ?? 0;
        return {
          game_id: g.game_id,
          home_team: g.home_team, away_team: g.away_team,
          home_pts: home, away_pts: away,
          margin: Math.abs(home - away),
          winner: home >= away ? g.home_team : g.away_team,
          topPerformer: topByGame[g.game_id] ?? null,
          nba_game_url: g.nba_game_url, game_recap_url: g.game_recap_url,
        } as RecapGame;
      })
      .sort((a, b) => a.margin - b.margin);

    // ── High-Competitive Matchups ─────────────────────────────────────
    // Wins-from-prior FINAL games on this slate (proxy)
    const winsByTeam: Record<string, number> = {};
    for (const g of games) {
      if (!(g.status ?? "").toUpperCase().includes("FINAL")) continue;
      const homeWon = (g.home_pts ?? 0) > (g.away_pts ?? 0);
      winsByTeam[g.home_team] = (winsByTeam[g.home_team] ?? 0) + (homeWon ? 1 : 0);
      winsByTeam[g.away_team] = (winsByTeam[g.away_team] ?? 0) + (homeWon ? 0 : 1);
    }

    // Per-team aggregates: star power (max fp5), fantasy-relevant count, roster impact
    const teamAgg: Record<string, { star: number; fantRel: number; rosterImpact: number; teamFp5: number }> = {};
    for (const p of playersData?.items ?? []) {
      const t = p.core.team;
      if (!t || !teamsOnSlate.has(t)) continue;
      const fp5 = p.last5?.fp5 ?? 0;
      const mpg5 = p.last5?.mpg5 ?? 0;
      if (!teamAgg[t]) teamAgg[t] = { star: 0, fantRel: 0, rosterImpact: 0, teamFp5: 0 };
      teamAgg[t].star = Math.max(teamAgg[t].star, fp5);
      if (fp5 >= 25 && mpg5 >= 24) teamAgg[t].fantRel += 1;
      teamAgg[t].teamFp5 += fp5;
      if (rosterIds.has(p.core.id)) teamAgg[t].rosterImpact += 1;
    }

    const upcoming = games.filter((g: any) => !(g.status ?? "").toUpperCase().includes("FINAL"));
    const matchups: MatchupGame[] = upcoming
      .map((g: any) => {
        const ah = teamAgg[g.home_team] ?? { star: 0, fantRel: 0, rosterImpact: 0, teamFp5: 0 };
        const aa = teamAgg[g.away_team] ?? { star: 0, fantRel: 0, rosterImpact: 0, teamFp5: 0 };
        const star = ah.star + aa.star;
        const fantRel = ah.fantRel + aa.fantRel;
        const rosterImpact = ah.rosterImpact + aa.rosterImpact;
        const balance = 1 - Math.min(1, Math.abs(ah.teamFp5 - aa.teamFp5) / Math.max(ah.teamFp5 + aa.teamFp5, 1));
        const wins = (winsByTeam[g.home_team] ?? 0) + (winsByTeam[g.away_team] ?? 0);
        const score = star * 1.0 + fantRel * 6 + rosterImpact * 8 + balance * 25 + wins * 1.5;
        return {
          game_id: g.game_id,
          home_team: g.home_team, away_team: g.away_team,
          tipoff_utc: g.tipoff_utc,
          competitiveScore: Math.round(score),
          rosterRelevant: fantRel,
          starPower: Math.round(star),
        } as MatchupGame;
      })
      .sort((a, b) => b.competitiveScore - a.competitiveScore)
      .slice(0, 3);

    if (matchups.length) {
      // Label the highest-impact matchup as SLATE HAMMER (prefer late tipoff)
      const hammer = [...matchups].sort((a, b) => {
        const ta = a.tipoff_utc ? new Date(a.tipoff_utc).getTime() : 0;
        const tb = b.tipoff_utc ? new Date(b.tipoff_utc).getTime() : 0;
        return tb - ta;
      })[0];
      if (hammer) hammer.label = "SLATE HAMMER";
      // TRAP GAME: a matchup with a heavy fav (big star/fantRel gap) — only if data clearly supports
      for (const m of matchups) {
        if (m.label) continue;
        const ah = teamAgg[m.home_team] ?? { star: 0, fantRel: 0, rosterImpact: 0, teamFp5: 0 };
        const aa = teamAgg[m.away_team] ?? { star: 0, fantRel: 0, rosterImpact: 0, teamFp5: 0 };
        const gap = Math.abs(ah.fantRel - aa.fantRel);
        if (gap >= 3 && (ah.rosterImpact + aa.rosterImpact) >= 2) { m.label = "TRAP GAME"; break; }
      }

      // Build a single short narrative storyline for each matchup
      // (NLP replacement for the old metric chips).
      for (const m of matchups) {
        m.story = buildMatchupStoryline(m);
      }
    }

    // ── Captain Radar ─────────────────────────────────────────────────
    const captains: CaptainPick[] = (playersData?.items ?? [])
      .filter((p: any) => teamsOnSlate.has(p.core.team) && !isHealthUnavailable(normalizePlayerHealth(p)))
      .filter((p: any) => (p.last5?.fp5 ?? 0) >= 30 && (p.last5?.mpg5 ?? 0) >= 28)
      .map((p: any) => {
        const fp5 = p.last5?.fp5 ?? 0;
        const mpg5 = p.last5?.mpg5 ?? 0;
        const allAround =
          ((p.last5?.ast5 ?? 0) >= 4 ? 1 : 0) +
          ((p.last5?.stl5 ?? 0) + (p.last5?.blk5 ?? 0) >= 2 ? 1 : 0);
        const minutesSec = mpg5 >= 32 ? 1.1 : mpg5 >= 28 ? 1.0 : 0.9;
        const recencyForm = (p.last5?.delta_fp ?? 0) >= 0 ? 1.05 : 0.95;
        return {
          player_id: p.core.id,
          name: p.core.name,
          team: p.core.team,
          photo: p.core.photo ?? null,
          fp5, mpg5,
          fpProj: fp5 * minutesSec * recencyForm + allAround * 1.5,
        } as CaptainPick;
      })
      .sort((a, b) => (b.fpProj ?? 0) - (a.fpProj ?? 0))
      .slice(0, 3)
      .map((c) => ({ ...c, label: captainLabel(c) }));

    // ── Ballers.IQ Gamenight Intelligence (AI cards from cache) ───────
    const aiCards: AIBallersIQCard[] = (aiRow?.cards ?? []) as AIBallersIQCard[];
    const biqMode: "recap" | "matchup" | "mixed" =
      recap.length && upcoming.length ? "mixed" : recap.length ? "recap" : "matchup";
    // Always pushed — slide handles loading/empty states with skeletons so the
    // sequence is identical for played and scheduled days.
    slides.push({
      kind: "ballersiq",
      title: "Ballers.IQ",
      subtitle:
        biqMode === "recap" ? "Gamenight intelligence · Recap"
        : biqMode === "matchup" ? "Gamenight intelligence · Matchups"
        : "Gamenight intelligence · Recap & Matchups",
      payload: {
        kind: "ballersiq",
        data: {
          mode: biqMode,
          gw, day,
          headline: aiRow?.headline ?? "GAMENIGHT INTELLIGENCE",
          aiCards,
          loading: !aiRow,
        },
      },
    });

    // ── Played Games Recap (paginated in the slide) ───────────────────
    if (recap.length) {
      const pages = Math.max(1, Math.ceil(recap.length / 6));
      slides.push({
        kind: "recap",
        title: "Played Games Recap",
        subtitle: "Final scores and the night's top fantasy producer",
        payload: { kind: "recap", data: recap },
        // 3s per page so all played games are shown before advancing.
        durationMs: pages * 3000,
      });
    }

    // ── Outstanding Game (composite: top FP + closeness + total points) ─
    if (recap.length) {
      const totals = recap.map((g) => g.home_pts + g.away_pts);
      const tps = recap.map((g) => g.topPerformer?.fp ?? 0);
      const maxTotal = Math.max(...totals, 1);
      const maxTp = Math.max(...tps, 1);
      let best: RecapGame | null = null;
      let bestScore = -Infinity;
      for (const g of recap) {
        const tpFp = g.topPerformer?.fp ?? 0;
        const closeness = 1 / (g.margin + 1);
        const total = g.home_pts + g.away_pts;
        const score = (tpFp / maxTp) * 0.45 + closeness * 0.30 + (total / maxTotal) * 0.25;
        if (score > bestScore) { bestScore = score; best = g; }
      }
      if (best) {
        const bestId = best.game_id;
        const topRows: OutstandingGameRow[] = allLogs
          .filter((l: any) => l.game_id === bestId)
          .map((l: any) => {
            const p = playersById.get(l.player_id);
            return {
              player_id: l.player_id,
              name: p?.core?.name ?? `#${l.player_id}`,
              team: p?.core?.team ?? "",
              photo: p?.core?.photo ?? null,
              fp: fpFromLog(l),
              mp: l.mp, pts: l.pts, reb: l.reb, ast: l.ast, stl: l.stl, blk: l.blk,
            } as OutstandingGameRow;
          })
          .sort((a, b) => b.fp - a.fp)
          .slice(0, 10);
        const fullGame = games.find((g: any) => g.game_id === bestId);
        const youtube_recap_id = (fullGame as any)?.youtube_recap_id ?? null;
        const storyline = buildOutstandingStoryline(best);
        slides.push({
          kind: "outstanding",
          title: "Outstanding Game",
          subtitle: storyline,
          payload: {
            kind: "outstanding",
            data: {
              game: best,
              topRows,
              youtube_recap_id,
              game_recap_url: best.game_recap_url ?? null,
              storyline,
            },
          },
        });
      }
    }

    // ── High-Competitive Matchups ─────────────────────────────────────
    if (matchups.length) {
      slides.push({
        kind: "matchups",
        title: "High-Competitive Matchups",
        subtitle: "Tonight's must-watch tilts",
        payload: { kind: "matchups", data: matchups },
      });
    }

    // Captain Radar comes after the gameday content.
    if (captains.length) {
      slides.push({
        kind: "captain",
        title: "Captain Radar",
        subtitle: "Elite, safe and matchup-ready 2× plays",
        payload: { kind: "captain", data: captains },
      });
    }

    // ── Outro ─────────────────────────────────────────────────────────
    const idx = deadlines.findIndex((d) => d.gw === gw && d.day === day);
    const next = idx >= 0 && idx < deadlines.length - 1 ? deadlines[idx + 1] : null;
    slides.push({
      kind: "outro",
      title: "Set Lineup Before Lock",
      payload: {
        kind: "outro",
        data: {
          nextDeadlineUtc: next?.deadline_utc ?? null,
          bestPlayer: performers[0] ?? null,
          bestValue: valueRanked[0] ?? null,
          keyGame: matchups[0] ?? recap[0] ?? null,
        },
      },
    });

    return {
      gw, day, dateLabel,
      deadlineUtc: deadline?.deadline_utc ?? null,
      gamesCount: games.length,
      slides,
    };
  }, [gw, day, games, logs, playersData?.items, playersById, rosterIds, schedLoading, playersLoading, aiRow, deadlines]);

  return {
    data,
    isLoading: schedLoading || playersLoading || logsLoading,
    games,
  };
}

/** Single short NLP storyline for the High-Competitive Matchups slide. */
function buildMatchupStoryline(m: MatchupGame): string {
  const stars = m.starPower;
  const rel = m.rosterRelevant;
  const comp = m.competitiveScore;
  if (m.label === "SLATE HAMMER")
    return `Slate hammer — late-tip ceiling with ${rel || "multiple"} fantasy-relevant starters in play.`;
  if (m.label === "TRAP GAME")
    return `Trap spot — talent gap on paper, manage exposure on both sides.`;
  if (comp >= 70 && stars >= 50)
    return `Marquee tilt: elite star power on both ends in a near-even matchup.`;
  if (comp >= 70)
    return `Pace and parity — one of the night's most balanced matchups.`;
  if (stars >= 60)
    return `Star-driven game with ${rel} fantasy-relevant producers in play.`;
  if (rel >= 3)
    return `Roster-dense game — ${rel} fantasy starters affect lineups tonight.`;
  return `Solid slate game — watch tipoff minutes for fantasy edges.`;
}

/** Single-line storyline for the Outstanding Game slide. */
function buildOutstandingStoryline(g: RecapGame): string {
  const tp = g.topPerformer;
  const tight = g.margin <= 5;
  const total = g.home_pts + g.away_pts;
  const high = total >= 230;
  if (tp && tight && high)
    return `${tp.name} (${tp.fp.toFixed(1)} FP) headlines a ${g.home_pts}-${g.away_pts} thriller — drama, ceiling and points.`;
  if (tight)
    return `Coin flip decided by ${g.margin} — ${g.winner} edges it ${Math.max(g.home_pts, g.away_pts)}-${Math.min(g.home_pts, g.away_pts)}.`;
  if (tp && high)
    return `${tp.name} drops ${tp.fp.toFixed(1)} FP in a ${total}-point shootout.`;
  if (tp)
    return `${tp.name} powers ${g.winner} with ${tp.fp.toFixed(1)} FP — the night's marquee tilt.`;
  return `${g.winner} closes it out — the night's marquee tilt.`;
}
