import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAGE_SIZE = 20;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Use GET", null, 405);
  }

  try {
    const url = new URL(req.url);
    const sport = url.searchParams.get("sport");
    const search = (url.searchParams.get("search") ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const sort = url.searchParams.get("sort") ?? "active";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let q = sb
      .from("leagues")
      .select(
        "id, name, description, sport, status, join_code, scoring_system_id, deadline_rule_set_id, chip_rule_set_id, created_at",
      )
      .eq("kind", "fantasy")
      .eq("visibility", "public")
      .in("status", ["draft", "active"]);

    if (sport === "nba" || sport === "wnba" || sport === "euroleague") q = q.eq("sport", sport);
    if (search) q = q.ilike("name", `%${search}%`);

    if (sort === "newest") q = q.order("created_at", { ascending: false });
    else if (sort === "active") q = q.order("status", { ascending: true }).order("created_at", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    q = q.range(from, to);

    const { data: rawLeagues, error: lErr } = await q;
    if (lErr) return errorResponse("QUERY_FAILED", "Lookup failed", lErr.message, 500);

    let leagues = rawLeagues ?? [];
    const ids = leagues.map((l) => l.id);
    const systemIds = Array.from(new Set(leagues.map((l) => l.scoring_system_id).filter(Boolean)));
    const drsIds = Array.from(new Set(leagues.map((l) => l.deadline_rule_set_id).filter(Boolean)));
    const crsIds = Array.from(new Set(leagues.map((l) => l.chip_rule_set_id).filter(Boolean)));

    const [teamsRes, membersRes, rulesRes, drsRes, crsRes] = await Promise.all([
      ids.length
        ? sb.from("teams").select("league_id").in("league_id", ids)
        : Promise.resolve({ data: [] as any[], error: null }),
      ids.length
        ? sb.from("league_members").select("league_id").in("league_id", ids)
        : Promise.resolve({ data: [] as any[], error: null }),
      systemIds.length
        ? sb.from("scoring_rules")
            .select("scoring_system_id, stat_key, weight, rule_type, applies_to, is_active, sort_order")
            .in("scoring_system_id", systemIds)
            .eq("is_active", true)
        : Promise.resolve({ data: [] as any[], error: null }),
      drsIds.length
        ? sb.from("deadline_rule_sets").select("id, deadline_type").in("id", drsIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      crsIds.length
        ? sb.from("chip_rule_sets").select("id, captain_enabled, wildcard_enabled, all_star_enabled").in("id", crsIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const teamCounts = new Map<string, number>();
    for (const t of teamsRes.data ?? []) teamCounts.set((t as any).league_id, (teamCounts.get((t as any).league_id) ?? 0) + 1);
    const memberCounts = new Map<string, number>();
    for (const m of membersRes.data ?? []) memberCounts.set((m as any).league_id, (memberCounts.get((m as any).league_id) ?? 0) + 1);

    const rulesBySystem = new Map<string, any[]>();
    for (const r of rulesRes.data ?? []) {
      const arr = rulesBySystem.get((r as any).scoring_system_id) ?? [];
      arr.push(r);
      rulesBySystem.set((r as any).scoring_system_id, arr);
    }
    const drsById = new Map<string, any>();
    for (const d of drsRes.data ?? []) drsById.set((d as any).id, d);
    const crsById = new Map<string, any>();
    for (const c of crsRes.data ?? []) crsById.set((c as any).id, c);

    const items = leagues.map((l: any) => {
      const rules = (rulesBySystem.get(l.scoring_system_id) ?? [])
        .filter((r) => r.applies_to === "player" && r.rule_type === "multiplier")
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
      const formula = rules.length
        ? rules.map((r) => `${String(r.stat_key).toUpperCase()}×${Number(r.weight)}`).join(" ")
        : "—";
      const drs = drsById.get(l.deadline_rule_set_id);
      const crs = crsById.get(l.chip_rule_set_id);
      const chips: string[] = [];
      if (crs?.captain_enabled) chips.push("captain");
      if (crs?.wildcard_enabled) chips.push("wildcard");
      if (crs?.all_star_enabled) chips.push("all_star");
      return {
        id: l.id,
        name: l.name,
        description: l.description ?? null,
        sport: l.sport,
        status: l.status,
        join_code: l.join_code ?? null,
        team_count: teamCounts.get(l.id) ?? 0,
        member_count: memberCounts.get(l.id) ?? 0,
        scoring_formula_short: formula,
        deadline_type: drs?.deadline_type ?? null,
        chips_enabled: chips,
        created_at: l.created_at,
      };
    });

    if (sort === "most_teams") items.sort((a, b) => b.team_count - a.team_count);

    return okResponse({
      items,
      page,
      page_size: PAGE_SIZE,
      has_more: items.length === PAGE_SIZE,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: { code: "INTERNAL", message: msg } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});