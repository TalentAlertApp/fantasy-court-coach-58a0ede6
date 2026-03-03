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
} from "@/lib/contracts";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Generic validated fetch. Parses response with the given Zod schema.
 * Throws a ZodError if the server returns a shape that doesn't match.
 */
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

// deno-lint-ignore no-explicit-any
function unwrap(envelope: any): any {
  if (!envelope.ok) {
    throw new Error(envelope.error?.message || "API error");
  }
  return envelope.data;
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
export async function fetchRosterCurrent() {
  return unwrap(await apiFetch("roster-current", RosterCurrentResponseSchema));
}

/** POST /roster-save */
export async function saveRoster(body: {
  gw: number; day: number; starters: number[]; bench: number[]; captain_id: number;
}) {
  return unwrap(await apiFetch("roster-save", RosterSaveResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** POST /roster-auto-pick */
export async function autoPickRoster(body: {
  gw: number; day: number; strategy: "value5" | "fp5";
}) {
  return unwrap(await apiFetch("roster-auto-pick", RosterAutoPickResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** POST /transactions-simulate */
export async function simulateTransactions(body: {
  gw: number; day: number; adds: number[]; drops: number[];
}) {
  return unwrap(await apiFetch("transactions-simulate", TransactionsSimulateResponseSchema, {
    method: "POST", body: JSON.stringify(body),
  }));
}

/** POST /transactions-commit */
export async function commitTransaction(body: {
  gw: number; day: number; adds: number[]; drops: number[];
}) {
  return unwrap(await apiFetch("transactions-commit", TransactionsCommitResponseSchema, {
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
