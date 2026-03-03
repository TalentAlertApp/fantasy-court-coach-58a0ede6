import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Inline Zod schemas (edge functions can't import from src/) ──

const IsoDateTimeSchema = z.string().datetime({ offset: true });

const ScoringRulesSchema = z
  .object({
    pts: z.literal(1),
    reb: z.literal(1),
    ast: z.literal(2),
    stl: z.literal(3),
    blk: z.literal(3),
  })
  .strict();

const HealthPayloadSchema = z
  .object({
    data_source_mode: z.enum(["sheet", "supabase"]),
    server_time_utc: IsoDateTimeSchema,
    scoring_rules: ScoringRulesSchema,
  })
  .strict();

const ErrorObjectSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.string().nullable(),
  })
  .strict();

const HealthResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: HealthPayloadSchema }).strict(),
  z.object({ ok: z.literal(false), data: z.null(), error: ErrorObjectSchema }).strict(),
]);

// ── Handler ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = {
      ok: true as const,
      data: {
        data_source_mode: "sheet" as const,
        server_time_utc: new Date().toISOString(),
        scoring_rules: {
          pts: 1 as const,
          reb: 1 as const,
          ast: 2 as const,
          stl: 3 as const,
          blk: 3 as const,
        },
      },
    };

    // Hard rule: Schema.parse before returning
    HealthResponseSchema.parse(payload);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorPayload = {
      ok: false as const,
      data: null,
      error: {
        code: "INTERNAL_VALIDATION_ERROR",
        message: err instanceof Error ? err.message : "Unknown error",
        details: err instanceof z.ZodError ? JSON.stringify(err.issues) : null,
      },
    };

    return new Response(JSON.stringify(errorPayload), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
