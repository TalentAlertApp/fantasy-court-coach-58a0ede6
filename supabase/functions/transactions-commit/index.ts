import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({
    ok: true,
    data: {
      roster: { gw: 1, day: 1, deadline_utc: null, starters: [0,0,0,0,0], bench: [0,0,0,0,0], captain_id: 0, bank_remaining: 100, free_transfers_remaining: 2, constraints: { salary_cap: 100, starters_count: 5, bench_count: 5, starter_fc_min: 2, starter_bc_min: 2 }, updated_at: null },
      transaction: { id: "00000000-0000-0000-0000-000000000000", created_at: new Date().toISOString(), type: "SWAP", player_in_id: 0, player_out_id: 0, cost_points: 0, notes: null },
    },
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
