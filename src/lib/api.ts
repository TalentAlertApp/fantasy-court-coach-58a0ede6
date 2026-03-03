/**
 * Client-side API fetcher with Zod validation.
 *
 * Hard rule: every response is Schema.parse(json) before the caller sees it.
 */
import { z } from "zod";
import { HealthResponseSchema } from "@/lib/contracts";

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

  // Hard rule: Schema.parse before rendering
  const parsed = schema.parse(json);
  return parsed;
}

/** GET /api/v1/health — validated on both server and client */
export async function fetchHealth() {
  const envelope = await apiFetch("health", HealthResponseSchema);
  if (!envelope.ok) {
    throw new Error((envelope as { error: { message: string } }).error.message);
  }
  return envelope.data;
}
