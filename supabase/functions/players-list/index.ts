import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") || "salary";
    const order = url.searchParams.get("order") || "desc";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);
    const offset = Number(url.searchParams.get("offset")) || 0;
    const fcBcFilter = url.searchParams.get("fc_bc");
    const search = url.searchParams.get("search")?.toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: players, error } = await supabase.from("players").select("*");
    if (error) throw new Error(error.message);

    const { data: lastGames } = await supabase.from("player_last_game").select("*");
    const lgMap = new Map((lastGames || []).map((lg: any) => [lg.player_id, lg]));

    let items = (players || []).map((p: any) => {
      const lg: any = lgMap.get(p.id) || {};
      return {
        core: { id: p.id, name: p.name, team: p.team, fc_bc: p.fc_bc, photo: p.photo || null, salary: Number(p.salary), jersey: p.jersey, pos: p.pos || null, height: p.height || null, weight: p.weight, age: p.age, dob: p.dob || null, exp: p.exp, college: p.college || null },
        season: { gp: p.gp, mpg: Number(p.mpg), pts: Number(p.pts), reb: Number(p.reb), ast: Number(p.ast), stl: Number(p.stl), blk: Number(p.blk), fp: Number(p.fp_pg_t) },
        last5: { mpg5: Number(p.mpg5), pts5: Number(p.pts5), reb5: Number(p.reb5), ast5: Number(p.ast5), stl5: Number(p.stl5), blk5: Number(p.blk5), fp5: Number(p.fp_pg5) },
        lastGame: { date: lg.game_date || null, opp: lg.opp || null, home_away: lg.home_away || null, result: lg.result || null, a_pts: lg.a_pts || 0, h_pts: lg.h_pts || 0, mp: lg.mp || 0, pts: lg.pts || 0, reb: lg.reb || 0, ast: lg.ast || 0, stl: lg.stl || 0, blk: lg.blk || 0, fp: Number(lg.fp || 0), nba_game_url: lg.nba_game_url || null },
        computed: { value: Number(p.value_t), value5: Number(p.value5), stocks: Number(p.stl) + Number(p.blk), stocks5: Number(p.stl5) + Number(p.blk5), delta_mpg: Number(p.mpg5) - Number(p.mpg), delta_fp: Number(p.fp_pg5) - Number(p.fp_pg_t) },
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
