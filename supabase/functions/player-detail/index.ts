import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";

function calcAgeFromDob(dobStr: string | null): number {
  if (!dobStr) return 0;
  try {
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  } catch { return 0; }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const playerId = Number(url.searchParams.get("id"));
    if (!playerId) {
      return errorResponse("MISSING_PARAM", "id query param required");
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get player core data
    const { data: playerRow, error: playerErr } = await sb
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    if (playerErr || !playerRow) {
      return errorResponse("NOT_FOUND", `Player ${playerId} not found`, null, 404);
    }

    // Get player's last game
    const { data: lastGameRow } = await sb
      .from("player_last_game")
      .select("*")
      .eq("player_id", playerId)
      .single();

    // Get ALL player game logs (for computing averages + history)
    const { data: allLogs } = await sb
      .from("player_game_logs")
      .select("*")
      .eq("player_id", playerId)
      .order("game_date", { ascending: false });

    const logs = allLogs || [];

    // Compute season averages from logs
    const gp = logs.length;
    const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);
    const avg = (arr: any[], key: string) => arr.length > 0 ? sum(arr, key) / arr.length : 0;

    const seasonFp = avg(logs, "fp");
    const seasonPts = avg(logs, "pts");
    const seasonReb = avg(logs, "reb");
    const seasonAst = avg(logs, "ast");
    const seasonStl = avg(logs, "stl");
    const seasonBlk = avg(logs, "blk");
    const seasonMp = avg(logs, "mp");

    const last5 = logs.slice(0, 5);
    const l5Count = Math.max(last5.length, 1);
    const fp5 = sum(last5, "fp") / l5Count;
    const pts5 = sum(last5, "pts") / l5Count;
    const reb5 = sum(last5, "reb") / l5Count;
    const ast5 = sum(last5, "ast") / l5Count;
    const stl5 = sum(last5, "stl") / l5Count;
    const blk5 = sum(last5, "blk") / l5Count;
    const mpg5 = sum(last5, "mp") / l5Count;

    const salary = Number(playerRow.salary) || 1;
    const valueT = seasonFp / salary;
    const value5 = fp5 / salary;
    const stocks5 = stl5 + blk5;
    const stocks = seasonStl + seasonBlk;
    const deltaFp = fp5 - seasonFp;
    const deltaMpg = mpg5 - seasonMp;

    // Get schedule_games for enrichment (player's team)
    const { data: schedRows } = await sb
      .from("schedule_games")
      .select("*")
      .or(`home_team.eq.${playerRow.team},away_team.eq.${playerRow.team}`)
      .order("tipoff_utc", { ascending: true });

    const schedMap = new Map((schedRows || []).map((s: any) => [s.game_id, s]));

    // Get upcoming games (SCHEDULED only)
    const upcoming = (schedRows || [])
      .filter((s: any) => s.status === "SCHEDULED")
      .map((u: any) => ({
        game_id: u.game_id,
        tipoff_utc: u.tipoff_utc,
        away_team: u.away_team,
        home_team: u.home_team,
        status: u.status,
        gw: u.gw,
        day: u.day,
      }));

    // Build player object
    const player = {
      core: {
        id: playerRow.id,
        name: playerRow.name,
        team: playerRow.team,
        fc_bc: playerRow.fc_bc,
        photo: playerRow.photo,
        salary: playerRow.salary,
        jersey: playerRow.jersey,
        pos: playerRow.pos,
        height: playerRow.height,
        weight: playerRow.weight,
        age: calcAgeFromDob(playerRow.dob) || playerRow.age,
        dob: playerRow.dob,
        exp: playerRow.exp,
        college: playerRow.college,
      },
      season: {
        gp,
        mpg: Number(seasonMp.toFixed(1)),
        pts: Number(seasonPts.toFixed(1)),
        reb: Number(seasonReb.toFixed(1)),
        ast: Number(seasonAst.toFixed(1)),
        stl: Number(seasonStl.toFixed(1)),
        blk: Number(seasonBlk.toFixed(1)),
        fp: Number(seasonFp.toFixed(1)),
      },
      last5: {
        mpg5: Number(mpg5.toFixed(1)),
        pts5: Number(pts5.toFixed(1)),
        reb5: Number(reb5.toFixed(1)),
        ast5: Number(ast5.toFixed(1)),
        stl5: Number(stl5.toFixed(1)),
        blk5: Number(blk5.toFixed(1)),
        fp5: Number(fp5.toFixed(1)),
      },
      lastGame: lastGameRow ? {
        date: lastGameRow.game_date,
        opp: lastGameRow.opp,
        home_away: lastGameRow.home_away,
        result: lastGameRow.result,
        a_pts: lastGameRow.a_pts,
        h_pts: lastGameRow.h_pts,
        mp: lastGameRow.mp,
        pts: lastGameRow.pts,
        reb: lastGameRow.reb,
        ast: lastGameRow.ast,
        stl: lastGameRow.stl,
        blk: lastGameRow.blk,
        fp: lastGameRow.fp,
        nba_game_url: lastGameRow.nba_game_url,
      } : {
        date: null, opp: null, home_away: null, result: null,
        a_pts: 0, h_pts: 0, mp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fp: 0,
        nba_game_url: null,
      },
      computed: {
        value: Number(valueT.toFixed(2)),
        value5: Number(value5.toFixed(2)),
        stocks: Number(stocks.toFixed(1)),
        stocks5: Number(stocks5.toFixed(1)),
        delta_mpg: Number(deltaMpg.toFixed(1)),
        delta_fp: Number(deltaFp.toFixed(1)),
      },
      flags: {
        injury: playerRow.injury,
        note: playerRow.note,
      },
      advanced: {
        fgm: playerRow.fgm ?? null,
        fga: playerRow.fga ?? null,
        fg_pct: playerRow.fg_pct ?? null,
        tpm: playerRow.tpm ?? null,
        tpa: playerRow.tpa ?? null,
        tp_pct: playerRow.tp_pct ?? null,
        ftm: playerRow.ftm ?? null,
        fta: playerRow.fta ?? null,
        ft_pct: playerRow.ft_pct ?? null,
        oreb: playerRow.oreb ?? null,
        dreb: playerRow.dreb ?? null,
        tov: playerRow.tov ?? null,
        pf: playerRow.pf ?? null,
        plus_minus: playerRow.plus_minus ?? null,
      },
    };

    // Map history rows with schedule enrichment
    const history = logs.slice(0, 100).map((h: any) => {
      const sched = schedMap.get(h.game_id);
      return {
        date: h.game_date,
        opp: h.opp || "",
        home_away: h.home_away || "H",
        mp: h.mp,
        pts: h.pts,
        reb: h.reb,
        ast: h.ast,
        stl: h.stl,
        blk: h.blk,
        fp: Number(h.fp),
        nba_game_url: h.nba_game_url,
        game_id: h.game_id,
        gw: sched?.gw ?? 0,
        day: sched?.day ?? 0,
        home_pts: sched?.home_pts ?? 0,
        away_pts: sched?.away_pts ?? 0,
        home_team: sched?.home_team ?? "",
        away_team: sched?.away_team ?? "",
      };
    });

    return okResponse({ player, history, upcoming });
  } catch (e) {
    console.error("Player detail error:", e);
    return errorResponse("PLAYER_DETAIL_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
