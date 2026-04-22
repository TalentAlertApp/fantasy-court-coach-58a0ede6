/**
 * Admin guard for write/admin-only edge functions.
 * Requires the caller to send `x-admin-secret` matching the
 * ADMIN_API_SECRET env var. Uses constant-time comparison.
 *
 * Throws a Response (401) if the header is missing/wrong.
 * Returns void on success.
 */
import { errorResponse } from "./envelope.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function requireAdmin(req: Request): Response | null {
  const expected = Deno.env.get("ADMIN_API_SECRET");
  if (!expected) {
    return errorResponse(
      "ADMIN_NOT_CONFIGURED",
      "ADMIN_API_SECRET is not configured on the server.",
      null,
      500,
    );
  }
  const got = req.headers.get("x-admin-secret") ?? "";
  if (!got || !timingSafeEqual(got, expected)) {
    return errorResponse(
      "UNAUTHORIZED",
      "Missing or invalid admin secret.",
      null,
      401,
    );
  }
  return null;
}
