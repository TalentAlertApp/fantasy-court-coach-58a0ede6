import { corsHeaders } from "./cors.ts";

export function okResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ ok: true, data }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function errorResponse(
  code: string,
  message: string,
  details: string | null = null,
  status = 400
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      data: null,
      error: { code, message, details },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
