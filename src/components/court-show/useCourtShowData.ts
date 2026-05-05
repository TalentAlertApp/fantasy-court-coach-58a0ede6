import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { DEADLINES } from "@/lib/deadlines";
import type {
  CourtShowData,
  CourtShowSlideItem,
  TopPerformer,
  ValuePlay,
  RecapGame,
  MatchupGame,
  CaptainPick,
} from "./types";

function buildWeekDayDate(gw: number, day: number): string {
  const d = DEADLINES.find((x) => x.gw === gw && x.day === day);
  if (!d) return "";
  return new Date(d.deadline_utc).toISOString().slice(0, 10);
}

function fpFromLog(l: any): number {
  if (l.fp != null) return Number(l.fp);
  return (l.pts ?? 0) + (l.reb ?? 0) + 2 * (l.ast ?? 0) + 3 * (l.stl ?? 0) + 3 * (l.blk ?? 0);
}

export function useCourtShowData(gw: number, day: number) {
  const { data: scheduleData, isLoading: schedLoading } = useScheduleQuery({ gw, day });
  const { data: playersData, isLoading: playersLoading } = usePlayersQuery({ limit: 1000 });

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

  const playersById = useMemo(() => {
    const m = new Map<number, any>();
    for (const p of playersData?.items ?? []) m.set(p.core.id, p);
    return m;
  }, [playersData?.items]);

  const data = useMemo<CourtShowData | null>(() => {
    if (schedLoading || playersLoading) return null;

    const dateStr = buildWeekDayDate(gw, day);
    const dateLabel = dateStr
      ? format(parse(dateStr, "yyyy-MM-dd", new Date()), "EEE, MMM d")
      : "";
    const deadline = DEADLINES.find((d) => d.gw === gw && d.day === day);
    const teamsOnSlate = new Set<string>();
    for (const g of games) {
      teamsOnSlate.add(g.home_team);
      teamsOnSlate.add(g.away_team);
    }

    const slides: CourtShowSlideItem[] = [];

    // Intro
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

    // Performances + Recap
    const allLogs = logs ?? [];
    const performers: TopPerformer[] = [...allLogs]
      .map((l: any) => {
        const p = playersById.get(l.player_id);
        return {
          player_id: l.player_id,
          name: p?.core?.name ?? `#${l.player_id}`,
          team: p?.core?.team ?? "",
          photo: p?.core?.photo ?? null,
          fc_bc: p?.core?.fc_bc,
          fp: fpFromLog(l),
          pts: l.pts, reb: l.reb, ast: l.ast, stl: l.stl, blk: l.blk,
        } as TopPerformer;
      })
      .sort((a, b) => b.fp - a.fp)
      .slice(0, 3);

    if (performers.length) {
      slides.push({
        kind: "performances",
        title: "Outstanding Performances",
        subtitle: "Top fantasy producers from played games",
        payload: { kind: "performances", data: performers },
      });
    }

    // Value plays — slate teams, season fp / salary
    const valuePlays: ValuePlay[] = (playersData?.items ?? [])
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
      .filter((v) => (v.value5 ?? 0) > 0 || (v.fp5 ?? 0) > 0)
      .sort((a, b) => (b.value5 ?? 0) - (a.value5 ?? 0))
      .slice(0, 3);

    if (valuePlays.length) {
      slides.push({
        kind: "value",
        title: "Best Value Plays",
        subtitle: "Salary-efficient fantasy production",
        payload: { kind: "value", data: valuePlays },
      });
    }

    // Recap
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
        const home = g.home_pts ?? 0;
        const away = g.away_pts ?? 0;
        return {
          game_id: g.game_id,
          home_team: g.home_team,
          away_team: g.away_team,
          home_pts: home,
          away_pts: away,
          margin: Math.abs(home - away),
          winner: home >= away ? g.home_team : g.away_team,
          topPerformer: topByGame[g.game_id] ?? null,
          nba_game_url: g.nba_game_url,
          game_recap_url: g.game_recap_url,
        } as RecapGame;
      });
    if (recap.length) {
      slides.push({
        kind: "recap",
        title: "Played Games Recap",
        subtitle: "Final scores and top fantasy producer",
        payload: { kind: "recap", data: recap },
      });
    }

    // Matchups — upcoming, ranked by combined wins (proxy for competitiveness)
    const winsByTeam: Record<string, number> = {};
    for (const g of games) {
      if (!(g.status ?? "").toUpperCase().includes("FINAL")) continue;
      const homeWon = (g.home_pts ?? 0) > (g.away_pts ?? 0);
      winsByTeam[g.home_team] = (winsByTeam[g.home_team] ?? 0) + (homeWon ? 1 : 0);
      winsByTeam[g.away_team] = (winsByTeam[g.away_team] ?? 0) + (homeWon ? 0 : 1);
    }
    const matchups: MatchupGame[] = games
      .filter((g: any) => !(g.status ?? "").toUpperCase().includes("FINAL"))
      .map((g: any) => ({
        game_id: g.game_id,
        home_team: g.home_team,
        away_team: g.away_team,
        tipoff_utc: g.tipoff_utc,
        competitiveScore: (winsByTeam[g.home_team] ?? 0) + (winsByTeam[g.away_team] ?? 0),
      }))
      .sort((a, b) => b.competitiveScore - a.competitiveScore)
      .slice(0, 4);

    if (matchups.length) {
      slides.push({
        kind: "matchups",
        title: "High-Competitive Matchups",
        subtitle: "Most fantasy-relevant tip-offs ahead",
        payload: { kind: "matchups", data: matchups },
      });
    }

    // Captain Radar
    const captains: CaptainPick[] = (playersData?.items ?? [])
      .filter((p: any) => teamsOnSlate.has(p.core.team) && !p.core?.injury)
      .map((p: any) => ({
        player_id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo ?? null,
        fp5: p.last5?.fp5,
        mpg5: p.last5?.mpg5,
        fpProj: (p.last5?.fp5 ?? 0) * (p.last5?.mpg5 && p.last5.mpg5 >= 28 ? 1.05 : 0.9),
      }))
      .filter((c) => (c.fp5 ?? 0) > 0)
      .sort((a, b) => (b.fpProj ?? 0) - (a.fpProj ?? 0))
      .slice(0, 3);

    if (captains.length) {
      slides.push({
        kind: "captain",
        title: "Captain Radar",
        subtitle: "Top picks for the 2× multiplier",
        payload: { kind: "captain", data: captains },
      });
    }

    // Outro — next deadline after this one
    const idx = DEADLINES.findIndex((d) => d.gw === gw && d.day === day);
    const next = idx >= 0 && idx < DEADLINES.length - 1 ? DEADLINES[idx + 1] : null;
    slides.push({
      kind: "outro",
      title: "Set Lineup Before Lock",
      payload: {
        kind: "outro",
        data: {
          nextDeadlineUtc: next?.deadline_utc ?? null,
          bestPlayer: performers[0] ?? null,
          bestValue: valuePlays[0] ?? null,
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
  }, [gw, day, games, logs, playersData?.items, playersById, schedLoading, playersLoading]);

  return {
    data,
    isLoading: schedLoading || playersLoading || logsLoading,
    games,
  };
}