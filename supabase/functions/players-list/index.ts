import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(code: string, message: string, details: string | null = null, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, data: null, error: { code, message, details } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") || "salary";
    const order = url.searchParams.get("order") || "desc";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 2000);
    const offset = Number(url.searchParams.get("offset")) || 0;
    const fcBcFilter = url.searchParams.get("fc_bc");
    const search = url.searchParams.get("search")?.toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch players bio data
    const { data: players, error } = await supabase.from("players").select("*");
    if (error) throw new Error(error.message);

    // Fetch last game data
    const { data: lastGames } = await supabase.from("player_last_game").select("*");
    const lgMap = new Map((lastGames || []).map((lg: any) => [lg.player_id, lg]));

    // Fetch ALL game logs (paginated to bypass 1000-row limit)
    const allGameLogs: any[] = [];
    let glOffset = 0;
    const GL_BATCH = 1000;
    while (true) {
      const { data: batch, error: glErr } = await supabase
        .from("player_game_logs")
        .select("player_id, mp, pts, reb, ast, stl, blk, fp, game_date")
        .gt("mp", 0)
        .order("game_date", { ascending: false })
        .range(glOffset, glOffset + GL_BATCH - 1);
      if (glErr) throw new Error(glErr.message);
      if (!batch || batch.length === 0) break;
      allGameLogs.push(...batch);
      if (batch.length < GL_BATCH) break;
      glOffset += GL_BATCH;
    }
    const gameLogs = allGameLogs;

    // Aggregate season stats and last-5 from game logs
    const statsMap = new Map<number, {
      gp: number; total_mp: number; total_pts: number; total_reb: number;
      total_ast: number; total_stl: number; total_blk: number; total_fp: number;
      last5_fp: number[]; last5_mp: number[]; last5_pts: number[];
      last5_reb: number[]; last5_ast: number[]; last5_stl: number[]; last5_blk: number[];
    }>();

    for (const log of (gameLogs || [])) {
      let s = statsMap.get(log.player_id);
      if (!s) {
        s = {
          gp: 0, total_mp: 0, total_pts: 0, total_reb: 0,
          total_ast: 0, total_stl: 0, total_blk: 0, total_fp: 0,
          last5_fp: [], last5_mp: [], last5_pts: [],
          last5_reb: [], last5_ast: [], last5_stl: [], last5_blk: [],
        };
        statsMap.set(log.player_id, s);
      }
      s.gp++;
      s.total_mp += log.mp;
      s.total_pts += log.pts;
      s.total_reb += log.reb;
      s.total_ast += log.ast;
      s.total_stl += log.stl;
      s.total_blk += log.blk;
      s.total_fp += log.fp;
      // Already sorted desc by game_date, so first 5 entries are last 5
      if (s.last5_fp.length < 5) {
        s.last5_fp.push(log.fp);
        s.last5_mp.push(log.mp);
        s.last5_pts.push(log.pts);
        s.last5_reb.push(log.reb);
        s.last5_ast.push(log.ast);
        s.last5_stl.push(log.stl);
        s.last5_blk.push(log.blk);
      }
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    let items = (players || []).map((p: any) => {
      const lg: any = lgMap.get(p.id) || {};
      const s = statsMap.get(p.id);

      // Use game logs if available, fall back to players table
      const gp = s ? s.gp : (p.gp || 0);
      const mpg = s ? s.total_mp / s.gp : Number(p.mpg);
      const pts = s ? s.total_pts / s.gp : Number(p.pts);
      const reb = s ? s.total_reb / s.gp : Number(p.reb);
      const ast = s ? s.total_ast / s.gp : Number(p.ast);
      const stl = s ? s.total_stl / s.gp : Number(p.stl);
      const blk = s ? s.total_blk / s.gp : Number(p.blk);
      const fp = s ? s.total_fp / s.gp : Number(p.fp_pg_t);

      const mpg5 = s ? avg(s.last5_mp) : Number(p.mpg5);
      const pts5 = s ? avg(s.last5_pts) : Number(p.pts5);
      const reb5 = s ? avg(s.last5_reb) : Number(p.reb5);
      const ast5 = s ? avg(s.last5_ast) : Number(p.ast5);
      const stl5 = s ? avg(s.last5_stl) : Number(p.stl5);
      const blk5 = s ? avg(s.last5_blk) : Number(p.blk5);
      const fp5 = s ? avg(s.last5_fp) : Number(p.fp_pg5);

      const salary = Number(p.salary);
      const value = salary > 0 ? fp / salary : 0;
      const value5 = salary > 0 ? fp5 / salary : 0;

      return {
        core: { id: p.id, name: p.name, team: p.team, fc_bc: p.fc_bc, photo: p.photo || null, salary, jersey: p.jersey, pos: p.pos || null, height: p.height || null, weight: p.weight, age: calcAgeFromDob(p.dob) || p.age, dob: p.dob || null, exp: p.exp, college: p.college || null },
        season: { gp, mpg, pts, reb, ast, stl, blk, fp,
          total_mp: s ? s.total_mp : 0, total_pts: s ? s.total_pts : 0,
          total_reb: s ? s.total_reb : 0, total_ast: s ? s.total_ast : 0,
          total_stl: s ? s.total_stl : 0, total_blk: s ? s.total_blk : 0,
          total_fp: s ? s.total_fp : 0,
        },
        last5: { mpg5, pts5, reb5, ast5, stl5, blk5, fp5 },
        lastGame: { date: lg.game_date || null, opp: lg.opp || null, home_away: lg.home_away || null, result: lg.result || null, a_pts: lg.a_pts || 0, h_pts: lg.h_pts || 0, mp: lg.mp || 0, pts: lg.pts || 0, reb: lg.reb || 0, ast: lg.ast || 0, stl: lg.stl || 0, blk: lg.blk || 0, fp: Number(lg.fp || 0), nba_game_url: lg.nba_game_url || null },
        computed: { value, value5, stocks: stl + blk, stocks5: stl5 + blk5, delta_mpg: mpg5 - mpg, delta_fp: fp5 - fp },
        flags: { injury: p.injury || null, note: p.note || null },
      };
    });

    // Filter
    if (fcBcFilter) items = items.filter((p: any) => p.core.fc_bc === fcBcFilter.toUpperCase());
    if (search) items = items.filter((p: any) => p.core.name.toLowerCase().includes(search) || p.core.team.toLowerCase().includes(search));

    const count = items.length;
    const sortKeyMap: Record<string, (p: any) => number> = {
      salary: (p) => p.core.salary, fp: (p) => p.season.fp, fp5: (p) => p.last5.fp5,
      value: (p) => p.computed.value, value5: (p) => p.computed.value5,
      stocks5: (p) => p.computed.stocks5, delta_fp: (p) => p.computed.delta_fp,
      delta_mpg: (p) => p.computed.delta_mpg,
    };
    const sortFn = sortKeyMap[sort] || sortKeyMap.salary;
    items.sort((a: any, b: any) => order === "asc" ? sortFn(a) - sortFn(b) : sortFn(b) - sortFn(a));
    const paged = items.slice(offset, offset + limit);

    return ok({ meta: { count, limit, offset, sort, order }, items: paged });
  } catch (e) {
    console.error("Players error:", e);
    return err("PLAYERS_FETCH_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
