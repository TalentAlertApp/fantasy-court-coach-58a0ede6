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

  // Resolve the calling user from the Authorization header (if any).
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let userId: string | null = null;
  if (jwt) {
    try {
      const { data, error } = await sb.auth.getUser(jwt);
      if (!error && data.user) userId = data.user.id;
    } catch (_) {
      // ignore — treated as anonymous
    }
  }

  try {
    if (req.method === "GET") {
      // Anonymous → empty list (front-end will redirect to /auth)
      if (!userId) {
        return okResponse({ items: [], default_team_id: null });
      }
      const { data: teams, error } = await sb
        .from("teams")
        .select("*")
        .or(`owner_id.is.null,owner_id.eq.${userId}`)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const defaultTeamId = (teams && teams.length > 0) ? teams[0].id : null;
      return okResponse({ items: teams ?? [], default_team_id: defaultTeamId });
    }

    if (req.method === "POST") {
      if (!userId) return errorResponse("UNAUTHORIZED", "Sign in required");
      const body = await req.json();
      const { name, description } = body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("VALIDATION", "name is required");
      }
      const { data: team, error } = await sb
        .from("teams")
        .insert({ name: name.trim(), description: description ?? null, owner_id: userId })
        .select()
        .single();
      if (error) throw error;
      return okResponse({ team });
    }

    if (req.method === "PATCH") {
      if (!userId) return errorResponse("UNAUTHORIZED", "Sign in required");
      if (!teamIdParam) return errorResponse("VALIDATION", "team_id query param required");
      // Verify ownership
      const { data: existing, error: exErr } = await sb
        .from("teams").select("owner_id").eq("id", teamIdParam).maybeSingle();
      if (exErr) throw exErr;
      if (!existing) return errorResponse("NOT_FOUND", "Team not found");
      if (existing.owner_id !== userId) {
        return errorResponse("FORBIDDEN", "You do not own this team");
      }
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
      if (!userId) return errorResponse("UNAUTHORIZED", "Sign in required");
      if (!teamIdParam) return errorResponse("VALIDATION", "team_id query param required");
      const { data: existing, error: exErr } = await sb
        .from("teams").select("owner_id").eq("id", teamIdParam).maybeSingle();
      if (exErr) throw exErr;
      if (!existing) return errorResponse("NOT_FOUND", "Team not found");
      if (existing.owner_id !== userId) {
        return errorResponse("FORBIDDEN", "You do not own this team");
      }
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
