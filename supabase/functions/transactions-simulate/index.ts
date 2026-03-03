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
    data: { is_valid: true, errors: [], warnings: [], before: { salary_used: 0, bank_remaining: 100, proj_fp5: 0, proj_stocks5: 0 }, after: { salary_used: 0, bank_remaining: 100, proj_fp5: 0, proj_stocks5: 0 }, delta: { proj_fp5: 0, proj_stocks5: 0, proj_ast5: 0 } },
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
