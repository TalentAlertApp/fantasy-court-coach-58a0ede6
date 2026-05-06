import { useMemo } from "react";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { NBA_TEAM_META } from "@/data/nbaTeamsFallback";
import type { LeagueTeam } from "@/hooks/useLeagueTeams";
import type { StandingRow } from "@/types/standings";

interface ScheduleGame {
  home_team: string;
  away_team: string;
  home_pts: number;
  away_pts: number;
  status: string;
}

interface TeamAcc {
  w: number; l: number;
  homeW: number; homeL: number;
  awayW: number; awayL: number;
  confW: number; confL: number;
  divW: number; divL: number;
  pf: number; pa: number;
  last10: boolean[]; // true=win
  streak: number; // positive=W, negative=L
}

function emptyAcc(): TeamAcc {
  return { w: 0, l: 0, homeW: 0, homeL: 0, awayW: 0, awayL: 0, confW: 0, confL: 0, divW: 0, divL: 0, pf: 0, pa: 0, last10: [], streak: 0 };
}

export function useNBAStandings(
  scheduleData: ScheduleGame[] | undefined,
  leagueTeams?: LeagueTeam[],
) {
  return useMemo<StandingRow[]>(() => {
    if (!scheduleData) return [];

    const teamList = leagueTeams && leagueTeams.length > 0
      ? leagueTeams
      : NBA_TEAMS.map((t) => ({
          id: t.id, name: t.name, tricode: t.tricode, logo: t.logo,
          primaryColor: t.primaryColor,
          conference: NBA_TEAM_META[t.tricode]?.conference ?? null,
          division: NBA_TEAM_META[t.tricode]?.division ?? null,
        } as LeagueTeam));

    const metaFor = (tri: string) => {
      const t = teamList.find((x) => x.tricode === tri);
      return {
        conference: (t?.conference as string | null) ?? null,
        division: (t?.division as string | null) ?? null,
      };
    };

    const acc: Record<string, TeamAcc> = {};
    const ensure = (t: string) => { if (!acc[t]) acc[t] = emptyAcc(); };

    // Sort by some stable order (we don't have dates, so process as-is)
    for (const g of scheduleData) {
      const isFinal = g.status?.toUpperCase().includes("FINAL");
      if (!isFinal) continue;

      const ht = g.home_team;
      const at = g.away_team;
      ensure(ht); ensure(at);

      const homeWon = g.home_pts > g.away_pts;
      const hMeta = metaFor(ht);
      const aMeta = metaFor(at);
      const sameConf = hMeta && aMeta && hMeta.conference === aMeta.conference;
      const sameDiv = sameConf && !!hMeta.division && hMeta.division === aMeta.division;

      // Home team
      if (homeWon) {
        acc[ht].w++; acc[ht].homeW++;
        acc[at].l++; acc[at].awayL++;
        if (sameConf) { acc[ht].confW++; acc[at].confL++; }
        if (sameDiv) { acc[ht].divW++; acc[at].divL++; }
      } else {
        acc[ht].l++; acc[ht].homeL++;
        acc[at].w++; acc[at].awayW++;
        if (sameConf) { acc[ht].confL++; acc[at].confW++; }
        if (sameDiv) { acc[ht].divL++; acc[at].divW++; }
      }

      acc[ht].pf += g.home_pts; acc[ht].pa += g.away_pts;
      acc[at].pf += g.away_pts; acc[at].pa += g.home_pts;

      // L10 tracking (approximate — last 10 processed games)
      acc[ht].last10.push(homeWon);
      acc[at].last10.push(!homeWon);
      if (acc[ht].last10.length > 10) acc[ht].last10.shift();
      if (acc[at].last10.length > 10) acc[at].last10.shift();

      // Streak
      if (homeWon) {
        acc[ht].streak = acc[ht].streak > 0 ? acc[ht].streak + 1 : 1;
        acc[at].streak = acc[at].streak < 0 ? acc[at].streak - 1 : -1;
      } else {
        acc[at].streak = acc[at].streak > 0 ? acc[at].streak + 1 : 1;
        acc[ht].streak = acc[ht].streak < 0 ? acc[ht].streak - 1 : -1;
      }
    }

    return teamList.map((t) => {
      const a = acc[t.tricode] || emptyAcc();
      const gp = a.w + a.l;
      const pct = gp > 0 ? a.w / gp : 0;
      const ppg = gp > 0 ? a.pf / gp : 0;
      const oppPpg = gp > 0 ? a.pa / gp : 0;
      const l10W = a.last10.filter(Boolean).length;
      const l10L = a.last10.length - l10W;
      const strk = a.streak > 0 ? `W${a.streak}` : a.streak < 0 ? `L${Math.abs(a.streak)}` : "-";
      // Normalise conference to short codes used downstream (East/West).
      const rawConf = (t.conference || NBA_TEAM_META[t.tricode]?.conference || "East") as string;
      const confShort: "East" | "West" =
        /^w/i.test(rawConf) ? "West" : "East";
      const division = (t.division || NBA_TEAM_META[t.tricode]?.division || "") as string;

      return {
        tricode: t.tricode,
        name: t.name,
        logo: t.logo,
        primaryColor: t.primaryColor,
        gp,
        w: a.w,
        l: a.l,
        pct,
        gb: 0, // computed after sorting
        homeW: a.homeW, homeL: a.homeL,
        awayW: a.awayW, awayL: a.awayL,
        confW: a.confW, confL: a.confL,
        divW: a.divW, divL: a.divL,
        ppg, oppPpg,
        diff: ppg - oppPpg,
        l10W, l10L,
        strk,
        conference: confShort,
        division,
      };
    }).sort((a, b) => b.pct - a.pct || b.w - a.w).map((row, i, arr) => {
      const leader = arr[0];
      row.gb = leader ? ((leader.w - leader.l) - (row.w - row.l)) / 2 : 0;
      return row;
    });
  }, [scheduleData, leagueTeams]);
}
