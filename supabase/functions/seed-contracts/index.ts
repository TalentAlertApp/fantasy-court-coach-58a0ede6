// One-shot seeder for real NBA contract metadata on public.players.
// Idempotent — safe to invoke multiple times.
// GET /seed-contracts → updates players.guaranteed_yearly_salary,
//                       total_contract_value, contract_end_year.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import contracts from "./contracts.json" with { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let updated = 0;
  let failed = 0;
  for (const c of contracts as Array<{ id: number; g: number; t: number; y: number }>) {
    const { error } = await sb
      .from("players")
      .update({
        guaranteed_yearly_salary: c.g,
        total_contract_value: c.t,
        contract_end_year: c.y,
      })
      .eq("id", c.id);
    if (error) failed++;
    else updated++;
  }

  return new Response(
    JSON.stringify({ ok: true, data: { updated, failed, total: (contracts as any).length } }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});