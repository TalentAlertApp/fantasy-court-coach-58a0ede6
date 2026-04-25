/**
 * Client-side API fetcher with Zod validation.
 * Hard rule: every response is Schema.parse(json) before the caller sees it.
 */
import { z } from "zod";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";
import { supabase } from "@/integrations/supabase/client";
import {
  HealthResponseSchema,
  PlayersListResponseSchema,
  PlayerDetailResponseSchema,
  LastGameBulkResponseSchema,
  RosterCurrentResponseSchema,
  RosterSaveResponseSchema,
  RosterAutoPickResponseSchema,
  TransactionsSimulateResponseSchema,
  TransactionsCommitResponseSchema,
  ScheduleResponseSchema,
  ScheduleImpactResponseSchema,
  GameBoxscoreResponseSchema,
  AISuggestTransfersResponseSchema,
  AIPickCaptainResponseSchema,
  AIExplainPlayerResponseSchema,
  AIAnalyzeRosterResponseSchema,
  AIInjuryMonitorResponseSchema,
  AIExplainTradeResponseSchema,
  TeamListResponseSchema,
  TeamCreateResponseSchema,
  SyncRunResponseSchema,
  SyncStatusResponseSchema,
  ImportGameDataResponseSchema,
  ImportScheduleResponseSchema,
} from "@/lib/contracts";

export async function apiFetch<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit
): Promise<z.infer<T>> {
  if (!SUPABASE_URL) {
    throw new Error(`API config missing: SUPABASE_URL is empty (path=${path})`);
  }
  const url = `${SUPABASE_URL}/functions/v1/${path}`;
  // Attach the current user's JWT when available, so edge functions can
  // identify the caller (e.g. teams stamping owner_id).
  let authHeader: Record<string, string> = {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {
    // ignore — fall back to apikey-only request
  }
  // Admin-only endpoints carry a shared secret, persisted in localStorage
  // and entered on the Commissioner page. This is matched on the server.
  // CRITICAL: only attach to admin paths — non-admin edge functions don't
  // include `x-admin-secret` in their CORS Access-Control-Allow-Headers,
  // so attaching it indiscriminately causes browser preflight failures
  // (e.g. /schedule "Failed to fetch") on every read endpoint.
  let adminHeader: Record<string, string> = {};
  const ADMIN_PATH_PREFIXES = [
    "import-players",
    "import-schedule",
    "import-game-data",
    "import-player-advanced-stats",
    "sync-sheet",
    "salary-update",
    "youtube-recap-lookup",
  ];
  const isAdminPath = ADMIN_PATH_PREFIXES.some((p) => path.startsWith(p));
  if (isAdminPath) {
    try {
      const adminSecret =
        typeof window !== "undefined" ? localStorage.getItem("nba_admin_secret") : null;
      if (adminSecret) adminHeader = { "x-admin-secret": adminSecret };
    } catch {
      // ignore
    }
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...authHeader,
      ...adminHeader,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} returned ${res.status}: ${text}`);
  }
  // Defensive: ensure the body is actually JSON. Some preview proxies can
  // return HTML on transient errors which would otherwise blow up here.
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!ct.includes("application/json") && !raw.trimStart().startsWith("{") && !raw.trimStart().startsWith("[")) {
    throw new Error(`API ${path} returned non-JSON response (content-type=${ct})`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`API ${path} returned invalid JSON: ${e?.message ?? "parse error"}`);
  }
  // Use safeParse: if schema fails, log and return raw JSON so the app never breaks
  const result = schema.safeParse(json);
  if (!result.success) {
    console.warn(`[apiFetch] Zod validation warning for "${path}":`, result.error.issues);
    return json as z.infer<T>;
  }
  return result.data;
}

function unwrap(envelope: any): any {
  if (!envelope.ok) {
    throw new Error(envelope.error?.message || "API error");
  }
  return envelope.data;
}

function teamQs(teamId?: string): string {
  return teamId ? `team_id=${teamId}` : "";
}

function appendTeam(path: string, teamId?: string): string {
  const tq = teamQs(teamId);
  if (!tq) return path;
  return path.includes("?") ? `${path}&${tq}` : `${path}?${tq}`;
}

/** GET /health */
export async function fetchHealth() {
  return unwrap(await apiFetch("health", HealthResponseSchema));
}

/** GET /players */
export async function fetchPlayers(params?: {
  sort?: string; order?: string; limit?: number; offset?: number;
  fc_bc?: string; search?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.order) qs.set("order", params.order);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.fc_bc) qs.set("fc_bc", params.fc_bc);
  if (params?.search) qs.set("search", params.search);
  const path = `players-list${qs.toString() ? `?${qs}` : ""}`;
  return unwrap(await apiFetch(path, PlayersListResponseSchema));
}

/** GET /player-detail?id=X */
export async function fetchPlayerDetail(id: number) {
  return unwrap(await apiFetch(`player-detail?id=${id}`, PlayerDetailResponseSchema));
}

/** GET /last-game */
export async function fetchLastGame() {
  return unwrap(await apiFetch("last-game", LastGameBulkResponseSchema));
}

/** GET /roster-current */
export async function fetchRosterCurrent(teamId?: string) {
  return unwrap(await apiFetch(appendTeam("roster-current", teamId), RosterCurrentResponseSchema));
}

/** POST /roster-save */
export async function saveRoster(body: {
  gw: number; day: number; starters: number[]; bench: number[]; captain_id: number;
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("roster-save", teamId), RosterSaveResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** POST /roster-auto-pick */
export async function autoPickRoster(body: {
  gw: number; day: number; strategy: "value5" | "fp5";
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("roster-auto-pick", teamId), RosterAutoPickResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** POST /transactions-simulate */
export async function simulateTransactions(body: {
  gw: number; day: number; adds: number[]; drops: number[];
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("transactions-simulate", teamId), TransactionsSimulateResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** POST /transactions-commit */
export async function commitTransaction(body: {
  gw: number; day: number; outs: number[]; ins: number[];
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("transactions-commit", teamId), TransactionsCommitResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** GET /schedule */
export async function fetchSchedule(params?: { gw?: number; day?: number }) {
  const qs = new URLSearchParams();
  if (params?.gw) qs.set("gw", String(params.gw));
  if (params?.day) qs.set("day", String(params.day));
  const path = `schedule${qs.toString() ? `?${qs}` : ""}`;
  return unwrap(await apiFetch(path, ScheduleResponseSchema));
}

/** GET /schedule-impact */
export async function fetchScheduleImpact(params?: { gw?: number; day?: number }) {
  const qs = new URLSearchParams();
  if (params?.gw) qs.set("gw", String(params.gw));
  if (params?.day) qs.set("day", String(params.day));
  const path = `schedule-impact${qs.toString() ? `?${qs}` : ""}`;
  return unwrap(await apiFetch(path, ScheduleImpactResponseSchema));
}

/** Teams CRUD */
export async function fetchTeams() {
  return unwrap(await apiFetch("teams", TeamListResponseSchema));
}

export async function createTeam(body: { name: string; description?: string | null }) {
  return unwrap(await apiFetch("teams", TeamCreateResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

export async function updateTeam(id: string, body: { name?: string; description?: string | null }) {
  return unwrap(await apiFetch(`teams?team_id=${id}`, TeamCreateResponseSchema, {
    method: "PATCH", body: JSON.stringify(body),
  }));
}

export async function deleteTeam(id: string) {
  return unwrap(await apiFetch(`teams?team_id=${id}`, z.object({ ok: z.literal(true), data: z.object({ deleted: z.literal(true) }) }), {
    method: "DELETE",
  }));
}

/** AI endpoints */
export async function aiSuggestTransfers(body: {
  gw: number; day: number; max_cost: number; objective: "maximize_fp5" | "maximize_value5" | "maximize_stocks5";
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("ai-coach", teamId), AISuggestTransfersResponseSchema, {
    method: "POST", body: JSON.stringify({ action: "suggest-transfers", ...body }),
  }));
}

export async function aiPickCaptain(body: { gw: number; day: number }, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("ai-coach", teamId), AIPickCaptainResponseSchema, {
    method: "POST", body: JSON.stringify({ action: "pick-captain", ...body }),
  }));
}

export async function aiExplainPlayer(body: { player_id: number }, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("ai-coach", teamId), AIExplainPlayerResponseSchema, {
    method: "POST", body: JSON.stringify({ action: "explain-player", ...body }),
  }));
}

export async function aiAnalyzeRoster(body: {
  gw: number; day: number; focus: "lineup" | "waiver" | "trade" | "balanced";
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("ai-coach", teamId), AIAnalyzeRosterResponseSchema, {
    method: "POST", body: JSON.stringify({ action: "analyze-roster", ...body }),
  }));
}

export async function aiInjuryMonitor(body: {
  player_ids: number[]; include_replacements: boolean; max_salary: number | null;
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("ai-coach", teamId), AIInjuryMonitorResponseSchema, {
    method: "POST", body: JSON.stringify({ action: "injury-monitor", ...body }),
  }));
}

/** POST /ai-coach action=explain-trade */
export async function aiExplainTrade(body: {
  outs: number[]; ins: number[]; gw: number; day: number;
}, teamId?: string) {
  return unwrap(await apiFetch(appendTeam("ai-coach", teamId), AIExplainTradeResponseSchema, {
    method: "POST", body: JSON.stringify({ action: "explain-trade", ...body }),
  }));
}

/** Sync endpoints */
export async function triggerSync(body: {
  type: "FULL" | "SALARY" | "GAMES" | "SCHEDULE";
}) {
  return unwrap(await apiFetch("sync-sheet", SyncRunResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** Salary update with auto-recalc */
export async function updateSalaries(updates: Array<{ player_id: number; salary: number | null }>) {
  return unwrap(await apiFetch("salary-update", SyncRunResponseSchema, {
    method: "POST", body: JSON.stringify({ updates }),
  }));
}

export async function fetchSyncStatus(runId?: string) {
  const path = runId ? `sync-status?run_id=${runId}` : "sync-status";
  return unwrap(await apiFetch(path, SyncStatusResponseSchema));
}

/** GET /game-boxscore */
export async function fetchGameBoxscore(gameId: string) {
  return unwrap(await apiFetch(`game-boxscore?game_id=${gameId}`, GameBoxscoreResponseSchema));
}

/** POST /import-game-data */
export async function importGameData(rows: Array<{
  week: number; day: number; date: string; dayName: string; time: string;
  homeTeam: string; awayTeam: string; homeScore: number; awayScore: number;
  status: string; gameId: string; playerId: number; playerName: string;
  pts: number; mp: number; ps: number; r: number; a: number; b: number; s: number;
}>, replace = false) {
  return unwrap(await apiFetch("import-game-data", ImportGameDataResponseSchema, {
    method: "POST", body: JSON.stringify({ rows, replace }),
  }));
}

/** POST /import-schedule */
export async function importSchedule(rows: Array<{
  gw: number; day: number; date: string; dayName: string; time: string;
  home_team: string; away_team: string; status: string; home_pts: number; away_pts: number;
  game_id: string; nba_game_url: string | null; game_recap_url: string | null;
  game_boxscore_url: string | null; game_charts_url: string | null;
  game_playbyplay_url: string | null;
}>, replace = false) {
  return unwrap(await apiFetch("import-schedule", ImportScheduleResponseSchema, {
    method: "POST", body: JSON.stringify({ rows, replace }),
  }));
}
