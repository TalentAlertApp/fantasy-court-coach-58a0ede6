import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const teamIdParam = url.searchParams.get("team_id");

  try {
    if (req.method === "GET") {
      const { data: teams, error } = await sb
        .from("teams")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const defaultTeamId = teams.length > 0 ? teams[0].id : null;
      return okResponse({ items: teams, default_team_id: defaultTeamId });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { name, description } = body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("VALIDATION", "name is required");
      }
      const { data: team, error } = await sb
        .from("teams")
        .insert({ name: name.trim(), description: description ?? null })
        .select()
        .single();
      if (error) throw error;
      return okResponse({ team });
    }

    if (req.method === "PATCH") {
      if (!teamIdParam) return errorResponse("VALIDATION", "team_id query param required");
      const body = await req.json();
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      const { data: team, error } = await sb
        .from("teams")
        .update(updates)
        .eq("id", teamIdParam)
        .select()
        .single();
      if (error) throw error;
      return okResponse({ team });
    }

    if (req.method === "DELETE") {
      if (!teamIdParam) return errorResponse("VALIDATION", "team_id query param required");
      const { error } = await sb.from("teams").delete().eq("id", teamIdParam);
      if (error) throw error;
      return okResponse({ deleted: true });
    }

    return errorResponse("METHOD_NOT_ALLOWED", `Method ${req.method} not supported`);
  } catch (e) {
    console.error("[teams] Error:", e);
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
  }
});
