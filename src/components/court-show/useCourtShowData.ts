import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useLeagueDeadlines } from "@/hooks/useLeagueDeadlines";
import { useLeague } from "@/contexts/LeagueContext";
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
  NextGameRow,
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
  const { league } = useLeague();
  const queryClient = useQueryClient();

  const games = scheduleData?.games ?? [];
  const finalGameIds = useMemo(
    () => games.filter((g: any) => (g.status ?? "").toUpperCase().includes("FINAL")).map((g: any) => g.game_id),
    [games],
  );

  // Salary shake-up: latest day's biggest absolute deltas (played) OR season-to-date
  // cumulative deltas (scheduled). Both run as cheap public-read queries.
  const slateDate = useMemo(() => buildWeekDayDate(deadlines, gw, day), [deadlines, gw, day]);
  const { data: salaryShakeupRaw } = useQuery({
    queryKey: ["court-show-salary-shakeup", leagueId, slateDate, finalGameIds.length > 0],
    enabled: !!leagueId && !!slateDate,
    staleTime: 60_000,
    queryFn: async () => {
      const isPlayed = finalGameIds.length > 0;
      if (isPlayed) {
        const { data } = await supabase
          .from("player_salary_changes")
          .select("player_id, old_salary, new_salary, delta")
          .eq("league_id", leagueId!)
          .eq("change_date", slateDate)
          .order("delta", { ascending: false });
        return { mode: "played" as const, rows: data ?? [] };
      }
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("player_salary_changes")
        .select("player_id, delta")
        .eq("league_id", leagueId!)
        .gte("change_date", since);
      return { mode: "scheduled" as const, rows: data ?? [] };
    },
  });

  // ── Next gameday lookup (for the "Next Up" slide on played days) ────
  const nextDeadline = useMemo(() => {
    const nowMs = Date.now();
    return (
      deadlines.find(
        (d) =>
          new Date(d.deadline_utc).getTime() > nowMs &&
          !(d.gw === gw && d.day === day),
      ) ?? null
    );
  }, [deadlines, gw, day]);

  const { data: nextGamesRaw } = useQuery({
    queryKey: ["court-show-next-games", leagueId, league, nextDeadline?.gw ?? null, nextDeadline?.day ?? null],
    enabled: !!leagueId && !!nextDeadline && finalGameIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, gw, day, home_team, away_team, tipoff_utc, status")
        .eq("league_id", leagueId!)
        .eq("gw", nextDeadline!.gw)
        .eq("day", nextDeadline!.day)
        .order("tipoff_utc", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["court-show-logs", league, gw, day, finalGameIds.join(",")],
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

  // ── Ballers.IQ AI cards ──────────────────────────────────────────────
  // Always go through the edge function, which is the single source of truth
  // for cache validity. It returns the cached row when fresh and clean, or
  // regenerates (and deletes any polluted row) before responding. Reading
  // `court_show_intelligence` directly from the client would bypass the
  // league/slate/foreign-term validators and leak NBA content into WNBA.
  const { data: aiRow, isLoading: aiLoading } = useQuery({
    queryKey: ["court-show-ai", leagueId, league, gw, day],
    enabled: !!leagueId && !schedLoading,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("court-show-intelligence", {
        body: { league_id: leagueId, gw, day },
      });
      if (error) {
        console.warn("[court-show-intelligence] invoke error", error);
        return null;
      }
      const cards = (data?.cards ?? []) as unknown as AIBallersIQCard[];
      if (!cards.length) return null;
      return {
        cards,
        headline: (data?.headline ?? null) as string | null,
        mode: (data?.mode ?? "mixed") as string,
      };
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

    // Slate state
    const playedTeams = new Set<string>();
    for (const g of games) {
      if ((g.status ?? "").toUpperCase().includes("FINAL")) {
        playedTeams.add(g.home_team); playedTeams.add(g.away_team);
      }
    }
    const healthWatchMode: "played" | "scheduled" =
      finalGameIds.length > 0 ? "played" : "scheduled";

    // ── Health Watch (built early so it can be inserted before value / captain) ─
    const STATUS_RANK: Record<string, number> = { OUT: 0, Q: 1, GTD: 1, DTD: 2, PROB: 3 };
    // Played-day: which players actually MISSED games on this slate (no log row, or mp == 0).
    const playedById = new Map<number, number>();
    for (const l of (logs ?? [])) {
      const cur = playedById.get(l.player_id) ?? 0;
      playedById.set(l.player_id, Math.max(cur, l.mp ?? 0));
    }
    const allWithHealth: { p: any; h: PlayerHealth }[] = [];
    for (const p of (playersData?.items ?? []) as any[]) {
      const h = normalizePlayerHealth(p);
      if (!h.status) continue;
      allWithHealth.push({ p, h });
    }
    const toHealthWatchPlayer = (p: any, h: PlayerHealth, onRoster: boolean): HealthWatchPlayer => ({
      player_id: p.core.id,
      name: p.core.name,
      team: p.core.team,
      photo: p.core.photo ?? null,
      fc_bc: p.core.fc_bc,
      salary: p.core.salary,
      fp5: p.last5?.fp5,
      season_fp: p.season?.fp,
      health: h,
      reason:
        h.injury_type ||
        h.notes ||
        h.raw_status ||
        (h.reason ? h.reason.charAt(0).toUpperCase() + h.reason.slice(1) : null),
      onRoster,
    });
    const sortByHealthThenRelevance = (a: { h: PlayerHealth; score: number }, b: { h: PlayerHealth; score: number }) => {
      const ra = STATUS_RANK[a.h.status ?? "PROB"] ?? 9;
      const rb = STATUS_RANK[b.h.status ?? "PROB"] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.score - a.score;
    };

    // My-roster affected players (any status, prioritized OUT → risky → PROB)
    const myRosterAffectedRanked = allWithHealth
      .filter(({ p }) => rosterIds.has(p.core.id))
      .map(({ p, h }) => ({
        p, h,
        score: (p.last5?.fp5 ?? 0) * 1.2 + (p.season?.fp ?? 0) + (p.core.salary ?? 0) * 0.5,
      }))
      .sort(sortByHealthThenRelevance)
      .slice(0, 3)
      .map(({ p, h }) => toHealthWatchPlayer(p, h, true));

    // League Watch — outstanding affected players, prefer teams on slate.
    const leagueWatchPool = allWithHealth
      .filter(({ p }) => !rosterIds.has(p.core.id))
      .filter(({ h }) => isHealthUnavailable(h) || isHealthRisky(h) || h.status === "PROB")
      .map(({ p, h }) => {
        const fp5 = p.last5?.fp5 ?? 0;
        const seasonFp = p.season?.fp ?? 0;
        const salary = p.core.salary ?? 0;
        const onSlate = teamsOnSlate.has(p.core.team) ? 1 : 0;
        // Star relevance: weight FP5 heaviest, season FP, then salary.
        const score = fp5 * 1.4 + seasonFp * 0.8 + salary * 0.6 + onSlate * 6;
        return { p, h, score };
      })
      .filter(({ score }) => score > 0);

    // Take strongest statuses first, then fall back to PROB only if needed.
    const strongLeagueWatch = leagueWatchPool
      .filter(({ h }) => h.status !== "PROB")
      .sort(sortByHealthThenRelevance)
      .slice(0, 3);
    let leagueWatchRanked = strongLeagueWatch;
    if (leagueWatchRanked.length < 3) {
      const filler = leagueWatchPool
        .filter(({ h }) => h.status === "PROB")
        .sort((a, b) => b.score - a.score)
        .slice(0, 3 - leagueWatchRanked.length);
      leagueWatchRanked = [...leagueWatchRanked, ...filler];
    }
    const leagueWatch = leagueWatchRanked.map(({ p, h }) => toHealthWatchPlayer(p, h, false));

    // Played-day override: replace the lists with players who actually missed
    // a game on this slate (their team played, but they have no minutes).
    let myRosterPlayedMissed: HealthWatchPlayer[] = myRosterAffectedRanked;
    let leagueWatchPlayedMissed: HealthWatchPlayer[] = leagueWatch;
    if (healthWatchMode === "played") {
      const missed = ((playersData?.items ?? []) as any[]).filter((p) => {
        if (!playedTeams.has(p.core.team)) return false;
        const mp = playedById.get(p.core.id) ?? 0;
        return mp <= 0;
      });
      const toRow = (p: any, onRoster: boolean): HealthWatchPlayer => {
        const h = normalizePlayerHealth(p);
        // Played-day rule: doubt is resolved. Never display "Questionable".
        // Coerce any soft-status (Q/GTD/DTD/PROB) into an unambiguous DNP
        // so the badge & reason both read as "Did not play".
        const dnpHealth: PlayerHealth =
          h.status === "OUT"
            ? h
            : { ...h, status: "OUT", raw_status: "DNP", reason: h.reason ?? "did not play" };
        return {
          player_id: p.core.id,
          name: p.core.name,
          team: p.core.team,
          photo: p.core.photo ?? null,
          fc_bc: p.core.fc_bc,
          salary: p.core.salary,
          fp5: p.last5?.fp5,
          season_fp: p.season?.fp,
          health: dnpHealth,
          reason: h.injury_type || h.notes || "Did not play",
          onRoster,
        };
      };
      const score = (p: any) =>
        (p.last5?.fp5 ?? 0) * 1.4 + (p.season?.fp ?? 0) * 0.8 + (p.core.salary ?? 0) * 0.6;
      myRosterPlayedMissed = missed
        .filter((p) => rosterIds.has(p.core.id))
        .sort((a, b) => score(b) - score(a))
        .slice(0, 3)
        .map((p) => toRow(p, true));
      leagueWatchPlayedMissed = missed
        .filter((p) => !rosterIds.has(p.core.id))
        .filter((p) => (p.season?.fp ?? 0) > 0 || (p.last5?.fp5 ?? 0) > 0)
        .sort((a, b) => score(b) - score(a))
        .slice(0, 3)
        .map((p) => toRow(p, false));
    }

    const hwMyRoster = healthWatchMode === "played" ? myRosterPlayedMissed : myRosterAffectedRanked;
    const hwLeague = healthWatchMode === "played" ? leagueWatchPlayedMissed : leagueWatch;
    const healthWatchSlide: CourtShowSlideItem | null =
      hwMyRoster.length > 0 || hwLeague.length > 0
        ? {
            kind: "health_watch",
            title: "Health Watch",
            subtitle:
              healthWatchMode === "played"
                ? "Who missed games on this slate"
                : "Roster risks and star absences before lock",
            payload: {
              kind: "health_watch",
              data: {
                myRoster: hwMyRoster,
                leagueWatch: hwLeague,
                mode: healthWatchMode,
                gw, day,
              },
            },
          }
        : null;

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
    let valueRanked: ValuePlay[];
    if (healthWatchMode === "played") {
      // Played day: rank by Value FROM THIS DAY's logs (dayFp / salary)
      const dayAgg = new Map<number, { fp: number; mp: number }>();
      for (const l of (logs ?? [])) {
        const cur = dayAgg.get(l.player_id) ?? { fp: 0, mp: 0 };
        cur.fp += fpFromLog(l);
        cur.mp += l.mp ?? 0;
        dayAgg.set(l.player_id, cur);
      }
      const rows: (ValuePlay & { _v: number })[] = [];
      for (const [pid, agg] of dayAgg) {
        const p = playersById.get(pid);
        if (!p) continue;
        const salary = p.core.salary ?? 0;
        if (salary <= 0 || agg.mp < 12 || agg.fp < 10) continue;
        const v = agg.fp / salary;
        rows.push({
          player_id: pid,
          name: p.core.name,
          team: p.core.team,
          photo: p.core.photo ?? null,
          salary,
          fp5: agg.fp, // reuse field to surface the day's FP in the UI label
          value5: v,
          mpg5: agg.mp,
          _v: v,
        });
      }
      valueRanked = rows
        .sort((a, b) => b._v - a._v)
        .slice(0, 3)
        .map(({ _v, ...rest }) => ({ ...rest, dayBased: true, label: valueLabel(rest) }));
    } else {
      // Scheduled day: original last-5 value logic
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
      valueRanked = [...valuePool]
        .sort((a, b) => {
          const va = a.value5 ?? (a.fp5 ?? 0) / Math.max(a.salary, 1);
          const vb = b.value5 ?? (b.fp5 ?? 0) / Math.max(b.salary, 1);
          return vb - va;
        })
        .slice(0, 3)
        .map((v) => ({ ...v, label: valueLabel(v) }));
    }

    // Health Watch — placed BEFORE Best Value Plays on played days.
    if (healthWatchSlide && healthWatchMode === "played") {
      slides.push(healthWatchSlide);
    }

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
    // Per spec: surface the players with the highest accumulated FP over their
    // last 5 played games (FP5 = per-player rolling, DNPs excluded). No slate
    // filter — these are the form leaders regardless of tonight's schedule.
    const captains: CaptainPick[] = (playersData?.items ?? [])
      .filter((p: any) => !isHealthUnavailable(normalizePlayerHealth(p)))
      .filter((p: any) => (p.last5?.fp5 ?? 0) > 0 && (p.last5?.mpg5 ?? 0) >= 28)
      .map((p: any) => ({
        player_id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo ?? null,
        fp5: p.last5?.fp5 ?? 0,
        mpg5: p.last5?.mpg5 ?? 0,
        fpProj: p.last5?.fp5 ?? 0,
      } as CaptainPick))
      .sort((a, b) => (b.fp5 ?? 0) - (a.fp5 ?? 0))
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
        // Each page lasts a full standard slide; modal computes
        // SLIDE_MS = pageCount * BASE_SLIDE_MS based on the user's speed.
        pageCount: pages,
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
          .sort((a, b) => b.fp - a.fp);
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

    // Health Watch — placed BEFORE Captain Radar on scheduled days.
    if (healthWatchSlide && healthWatchMode === "scheduled") {
      slides.push(healthWatchSlide);
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

    // ── Salary Shake-Up (after Captain Radar) ─────────────────────────
    if (salaryShakeupRaw) {
      type Row = { player_id: number; old_salary?: number; new_salary?: number; delta: number };
      let rows: Array<{ player_id: number; old_salary: number; new_salary: number; delta: number; cumulative: boolean }> = [];
      if (salaryShakeupRaw.mode === "played") {
        rows = (salaryShakeupRaw.rows as Row[])
          .map((r) => ({
            player_id: r.player_id,
            old_salary: Number(r.old_salary ?? 0),
            new_salary: Number(r.new_salary ?? 0),
            delta: Number(r.delta),
            cumulative: false,
          }))
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 3);
      } else {
        const sums = new Map<number, number>();
        for (const r of (salaryShakeupRaw.rows as Row[])) {
          sums.set(r.player_id, (sums.get(r.player_id) ?? 0) + Number(r.delta));
        }
        rows = [...sums.entries()]
          .map(([pid, d]) => {
            const p = playersById.get(pid);
            const current = Number(p?.core?.salary ?? 0);
            return {
              player_id: pid,
              old_salary: Math.round((current - d) * 10) / 10,
              new_salary: current,
              delta: Math.round(d * 10) / 10,
              cumulative: true,
            };
          })
          .filter((r) => r.delta !== 0)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 3);
      }
      if (rows.length) {
        const enriched = rows.map((r) => {
          const p = playersById.get(r.player_id);
          return {
            ...r,
            name: p?.core?.name ?? `#${r.player_id}`,
            team: p?.core?.team ?? "",
            photo: p?.core?.photo ?? null,
          };
        });
        slides.push({
          kind: "salary_shakeup",
          title: "Salary Shake-Up",
          subtitle: salaryShakeupRaw.mode === "played"
            ? "Biggest movers from last night"
            : "Biggest movers of the season",
          payload: { kind: "salary_shakeup", data: { mode: salaryShakeupRaw.mode, top: enriched } },
        });
      }
    }

    // ── Outro ─────────────────────────────────────────────────────────
    // ── Next Up (only when current slate has played games) ────────────
    if (healthWatchMode === "played" && nextDeadline && (nextGamesRaw?.length ?? 0) > 0) {
      const ngRows: NextGameRow[] = (nextGamesRaw ?? []).map((g: any) => {
        const teams = new Set<string>([g.home_team, g.away_team]);
        const myPlayers: { player_id: number; name: string; photo: string | null }[] = [];
        for (const id of rosterIds) {
          const p = playersById.get(id);
          if (p && teams.has(p.core.team)) {
            myPlayers.push({ player_id: p.core.id, name: p.core.name, photo: p.core.photo ?? null });
          }
        }
        return {
          game_id: g.game_id,
          home_team: g.home_team,
          away_team: g.away_team,
          tipoff_utc: g.tipoff_utc ?? null,
          myRosterCount: myPlayers.length,
          myRosterPlayers: myPlayers.slice(0, 3),
        } as NextGameRow;
      });
      const nextDateLabel = (() => {
        try {
          return format(new Date(nextDeadline.deadline_utc), "EEE, MMM d");
        } catch { return ""; }
      })();
      slides.push({
        kind: "next_games",
        title: "Next Up",
        subtitle: `Coming on ${nextDateLabel} · GW ${nextDeadline.gw} · Day ${nextDeadline.day}`,
        payload: {
          kind: "next_games",
          data: {
            gw: nextDeadline.gw,
            day: nextDeadline.day,
            dateLabel: nextDateLabel,
            deadlineUtc: nextDeadline.deadline_utc,
            games: ngRows,
          },
        },
      });
    }

    // The "Set Lineup Before Lock" deadline must reflect the day THIS Court
    // Show represents. Use this day's own deadline when it's still in the
    // future; otherwise (already locked) fall back to the next future one.
    const own = deadlines.find((d) => d.gw === gw && d.day === day) ?? null;
    const nowMs = Date.now();
    const ownInFuture = own && new Date(own.deadline_utc).getTime() > nowMs;
    const nextFuture = deadlines.find((d) => new Date(d.deadline_utc).getTime() > nowMs) ?? null;
    const next = ownInFuture ? own : nextFuture;
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
  }, [gw, day, games, logs, playersData?.items, playersById, rosterIds, schedLoading, playersLoading, aiRow, deadlines, nextDeadline, nextGamesRaw, salaryShakeupRaw]);

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
