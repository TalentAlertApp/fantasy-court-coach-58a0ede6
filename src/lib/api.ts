/**
 * Client-side API fetcher with Zod validation.
 * Hard rule: every response is Schema.parse(json) before the caller sees it.
 */
import { z } from "zod";
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
  AISuggestTransfersResponseSchema,
  AIPickCaptainResponseSchema,
  AIExplainPlayerResponseSchema,
  AIAnalyzeRosterResponseSchema,
  AIInjuryMonitorResponseSchema,
  TeamListResponseSchema,
  TeamCreateResponseSchema,
} from "@/lib/contracts";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export async function apiFetch<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit
): Promise<z.infer<T>> {
  const url = `${SUPABASE_URL}/functions/v1/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json();
  return schema.parse(json);
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
  gw: number; day: number; adds: number[]; drops: number[];
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
