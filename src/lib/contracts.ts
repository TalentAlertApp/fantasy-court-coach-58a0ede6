// lib/contracts.ts
// Strict API contracts for NBA Fantasy Manager (Private)
// - Uses zod to validate every response payload
// - Missing data must be null (not undefined) for nullable fields
//
// Usage (server):
//   import { PlayersListResponseSchema } from "@/lib/contracts";
//   const parsed = PlayersListResponseSchema.parse(payload); // throws on mismatch
//
// Usage (client):
//   import { PlayersListResponseSchema } from "@/lib/contracts";
//   const json = await fetch(...).then(r => r.json());
//   const data = PlayersListResponseSchema.parse(json);

import { z } from "zod";

/** ---------- helpers ---------- */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("YYYY-MM-DD");

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .describe("ISO datetime with offset, e.g. 2026-03-03T00:30:00+00:00");

export const NullableIsoDateSchema = IsoDateSchema.nullable();
export const NullableIsoDateTimeSchema = IsoDateTimeSchema.nullable();

export const NumSchema = z.number(); // always a number, never a string
export const IntSchema = z.number().int();

export const FCBCSchema = z.enum(["FC", "BC"]);
export const HomeAwaySchema = z.enum(["H", "A"]).nullable();

export const InjurySchema = z.enum(["OUT", "Q", "DTD"]).nullable();

export const ScoringRulesSchema = z
  .object({
    pts: z.literal(1),
    reb: z.literal(1),
    ast: z.literal(2),
    stl: z.literal(3),
    blk: z.literal(3),
  })
  .strict();

/** Envelope policy: every endpoint returns { ok, data, error? } */
export const ErrorObjectSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.string().nullable(),
  })
  .strict();

export const EnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z
    .union([
      z
        .object({
          ok: z.literal(true),
          data: dataSchema,
        })
        .strict(),
      z
        .object({
          ok: z.literal(false),
          data: z.null(),
          error: ErrorObjectSchema,
        })
        .strict(),
    ])
    .describe("API envelope");

/** ---------- shared types ---------- */
export const PlayerCoreSchema = z
  .object({
    id: IntSchema,
    name: z.string(),
    team: z.string(),
    fc_bc: FCBCSchema,
    photo: z.string().nullable(),
    salary: NumSchema,
    jersey: IntSchema,
    pos: z.string().nullable(),
    height: z.string().nullable(),
    weight: IntSchema,
    age: IntSchema,
    dob: NullableIsoDateSchema,
    exp: IntSchema,
    college: z.string().nullable(),
  })
  .strict();

export const PlayerSeasonSchema = z
  .object({
    gp: IntSchema,
    mpg: NumSchema,
    pts: NumSchema,
    reb: NumSchema,
    ast: NumSchema,
    stl: NumSchema,
    blk: NumSchema,
    fp: NumSchema,
    total_mp: NumSchema.optional().default(0),
    total_pts: NumSchema.optional().default(0),
    total_reb: NumSchema.optional().default(0),
    total_ast: NumSchema.optional().default(0),
    total_stl: NumSchema.optional().default(0),
    total_blk: NumSchema.optional().default(0),
    total_fp: NumSchema.optional().default(0),
  })
  .strict();

export const PlayerLast5Schema = z
  .object({
    mpg5: NumSchema,
    pts5: NumSchema,
    reb5: NumSchema,
    ast5: NumSchema,
    stl5: NumSchema,
    blk5: NumSchema,
    fp5: NumSchema,
  })
  .strict();

export const PlayerLastGameSchema = z
  .object({
    date: NullableIsoDateSchema,
    opp: z.string().nullable(),
    home_away: HomeAwaySchema,
    result: z.string().nullable(),
    a_pts: IntSchema,
    h_pts: IntSchema,
    mp: IntSchema,
    pts: IntSchema,
    reb: IntSchema,
    ast: IntSchema,
    stl: IntSchema,
    blk: IntSchema,
    fp: NumSchema,
    nba_game_url: z.string().nullable(),
  })
  .strict();

export const PlayerComputedSchema = z
  .object({
    value: NumSchema,
    value5: NumSchema,
    stocks: NumSchema,
    stocks5: NumSchema,
    delta_mpg: NumSchema,
    delta_fp: NumSchema,
  })
  .strict();

export const PlayerFlagsSchema = z
  .object({
    injury: InjurySchema,
    note: z.string().nullable(),
  })
  .strict();

export const PlayerListItemSchema = z
  .object({
    core: PlayerCoreSchema,
    season: PlayerSeasonSchema,
    last5: PlayerLast5Schema,
    lastGame: PlayerLastGameSchema,
    computed: PlayerComputedSchema,
    flags: PlayerFlagsSchema,
  })
  .strict();

export const RosterConstraintsSchema = z
  .object({
    salary_cap: NumSchema,
    starters_count: z.literal(5),
    bench_count: z.literal(5),
    starter_fc_min: IntSchema,
    starter_bc_min: IntSchema,
  })
  .strict();

export const RosterSnapshotSchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    deadline_utc: NullableIsoDateTimeSchema,
    starters: z.array(IntSchema).min(0).max(5),
    bench: z.array(IntSchema).min(0).max(5),
    captain_id: IntSchema,
    bank_remaining: NumSchema,
    free_transfers_remaining: IntSchema,
    constraints: RosterConstraintsSchema,
    updated_at: NullableIsoDateTimeSchema,
    team_id: z.string().uuid().optional(),
    team_name: z.string().optional(),
  })
  .strict();

export const ScheduleGameSchema = z
  .object({
    game_id: z.string(),
    gw: IntSchema,
    day: IntSchema,
    tipoff_utc: NullableIsoDateTimeSchema,
    away_team: z.string(),
    home_team: z.string(),
    away_pts: IntSchema,
    home_pts: IntSchema,
    status: z.string(),
    nba_game_url: z.string().nullable(),
    game_recap_url: z.string().nullable(),
    game_boxscore_url: z.string().nullable(),
    game_charts_url: z.string().nullable(),
    game_playbyplay_url: z.string().nullable(),
    youtube_recap_id: z.string().nullable().optional(),
  })
  .strict();

/** ---------- Game Box Score ---------- */
export const GameBoxscorePlayerSchema = z.object({
  player_id: IntSchema,
  name: z.string(),
  team: z.string(),
  fc_bc: FCBCSchema,
  photo: z.string().nullable(),
  mp: IntSchema,
  ps: IntSchema,
  fp: NumSchema,
  reb: IntSchema,
  ast: IntSchema,
  blk: IntSchema,
  stl: IntSchema,
  home_away: z.string().nullable(),
  salary: NumSchema.optional().default(0),
});

export const GameBoxscorePayloadSchema = z.object({
  game_id: z.string(),
  players: z.array(GameBoxscorePlayerSchema),
}).strict();

export const GameBoxscoreResponseSchema = EnvelopeSchema(GameBoxscorePayloadSchema);

/** ---------- endpoint payloads ---------- */

/** GET /api/v1/health */
export const HealthPayloadSchema = z
  .object({
    data_source_mode: z.enum(["sheet", "supabase"]),
    server_time_utc: IsoDateTimeSchema,
    scoring_rules: ScoringRulesSchema,
  })
  .strict();
export const HealthResponseSchema = EnvelopeSchema(HealthPayloadSchema);

/** GET /api/v1/players */
export const PlayersListMetaSchema = z
  .object({
    count: IntSchema,
    limit: IntSchema,
    offset: IntSchema,
    sort: z.enum([
      "salary",
      "fp",
      "fp5",
      "value",
      "value5",
      "stocks5",
      "delta_fp",
      "delta_mpg",
    ]),
    order: z.enum(["asc", "desc"]),
  })
  .strict();

export const PlayersListPayloadSchema = z
  .object({
    meta: PlayersListMetaSchema,
    items: z.array(PlayerListItemSchema),
  })
  .strict();

export const PlayersListResponseSchema = EnvelopeSchema(PlayersListPayloadSchema);

/** GET /api/v1/players/{id} */
export const PlayerHistoryItemSchema = z
  .object({
    date: IsoDateSchema,
    opp: z.string(),
    home_away: z.enum(["H", "A"]),
    mp: IntSchema,
    pts: IntSchema,
    reb: IntSchema,
    ast: IntSchema,
    stl: IntSchema,
    blk: IntSchema,
    fp: NumSchema,
    nba_game_url: z.string().nullable(),
    game_id: z.string(),
    gw: IntSchema,
    day: IntSchema,
    home_pts: IntSchema,
    away_pts: IntSchema,
    home_team: z.string(),
    away_team: z.string(),
  })
  .strict();

export const PlayerUpcomingItemSchema = z
  .object({
    game_id: z.string(),
    tipoff_utc: NullableIsoDateTimeSchema,
    away_team: z.string(),
    home_team: z.string(),
    status: z.string(),
    gw: IntSchema,
    day: IntSchema,
  })
  .strict();

export const PlayerDetailPayloadSchema = z
  .object({
    player: PlayerListItemSchema,
    history: z.array(PlayerHistoryItemSchema),
    upcoming: z.array(PlayerUpcomingItemSchema),
  })
  .strict();

export const PlayerDetailResponseSchema = EnvelopeSchema(PlayerDetailPayloadSchema);

/** GET /api/v1/last-game */
export const LastGameBulkItemSchema = z
  .object({
    player_id: IntSchema,
    lastGame: PlayerLastGameSchema,
  })
  .strict();

export const LastGameBulkPayloadSchema = z
  .object({
    items: z.array(LastGameBulkItemSchema),
  })
  .strict();

export const LastGameBulkResponseSchema = EnvelopeSchema(LastGameBulkPayloadSchema);

/** GET /api/v1/roster/current */
export const RosterCurrentPayloadSchema = z
  .object({
    roster: RosterSnapshotSchema,
  })
  .strict();

export const RosterCurrentResponseSchema = EnvelopeSchema(RosterCurrentPayloadSchema);

/** POST /api/v1/roster/save */
export const RosterSaveBodySchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    starters: z.array(IntSchema).min(0).max(5),
    bench: z.array(IntSchema).min(0).max(5),
    captain_id: IntSchema,
  })
  .strict();

export const RosterSavePayloadSchema = z
  .object({
    roster: RosterSnapshotSchema,
    warnings: z.array(z.string()),
  })
  .strict();

export const RosterSaveResponseSchema = EnvelopeSchema(RosterSavePayloadSchema);

/** POST /api/v1/roster/auto-pick */
export const RosterAutoPickBodySchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    strategy: z.enum(["value5", "fp5"]),
  })
  .strict();

export const RosterAutoPickPayloadSchema = z
  .object({
    roster: RosterSnapshotSchema,
    debug: z
      .object({
        objective: z.string(),
        constraints: z
          .object({
            salary_cap: NumSchema,
            starter_fc_min: IntSchema,
            starter_bc_min: IntSchema,
          })
          .strict(),
        candidates_considered: IntSchema,
      })
      .strict(),
  })
  .strict();

export const RosterAutoPickResponseSchema = EnvelopeSchema(RosterAutoPickPayloadSchema);

/** POST /api/v1/transactions/simulate */
export const TransactionsSimulateBodySchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    adds: z.array(IntSchema),
    drops: z.array(IntSchema),
  })
  .strict();

export const TransactionsSimulatePayloadSchema = z
  .object({
    is_valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    before: z
      .object({
        salary_used: NumSchema,
        bank_remaining: NumSchema,
        proj_fp5: NumSchema,
        proj_stocks5: NumSchema,
      })
      .strict(),
    after: z
      .object({
        salary_used: NumSchema,
        bank_remaining: NumSchema,
        proj_fp5: NumSchema,
        proj_stocks5: NumSchema,
      })
      .strict(),
    delta: z
      .object({
        proj_fp5: NumSchema,
        proj_stocks5: NumSchema,
        proj_ast5: NumSchema,
      })
      .strict(),
  })
  .strict();

export const TransactionsSimulateResponseSchema = EnvelopeSchema(
  TransactionsSimulatePayloadSchema
);

/** POST /api/v1/transactions/commit */
export const TransactionRecordSchema = z
  .object({
    id: z.string(),
    created_at: IsoDateTimeSchema,
    type: z.enum(["ADD", "DROP", "SWAP", "CAPTAIN_CHANGE"]),
    player_in_id: IntSchema,
    player_out_id: IntSchema,
    cost_points: NumSchema,
    notes: z.string().nullable(),
  })
  .strict();

export const TransactionsCommitPayloadSchema = z
  .object({
    roster: RosterSnapshotSchema,
    transaction: TransactionRecordSchema,
  })
  .strict();

export const TransactionsCommitResponseSchema = EnvelopeSchema(
  TransactionsCommitPayloadSchema
);

/** GET /api/v1/schedule */
export const SchedulePayloadSchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    deadline_utc: NullableIsoDateTimeSchema,
    games: z.array(ScheduleGameSchema),
  })
  .strict();

export const ScheduleResponseSchema = EnvelopeSchema(SchedulePayloadSchema);

/** GET /api/v1/schedule/impact */
export const ScheduleImpactMyPlayerSchema = z
  .object({
    id: IntSchema,
    name: z.string(),
    team: z.string(),
    proj_fp: NumSchema,
  })
  .strict();

export const ScheduleImpactGameSchema = z
  .object({
    game: ScheduleGameSchema,
    my_players: z.array(ScheduleImpactMyPlayerSchema),
  })
  .strict();

export const ScheduleImpactPayloadSchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    games: z.array(ScheduleImpactGameSchema),
  })
  .strict();

export const ScheduleImpactResponseSchema = EnvelopeSchema(ScheduleImpactPayloadSchema);

/** ---------- AI endpoints ---------- */

/** POST /api/v1/ai/suggest-transfers */
export const AISuggestTransfersBodySchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    max_cost: NumSchema,
    objective: z.enum(["maximize_fp5", "maximize_value5", "maximize_stocks5"]),
  })
  .strict();

export const AISuggestTransferMoveSchema = z
  .object({
    add: IntSchema,
    drop: IntSchema,
    reason_bullets: z.array(z.string()).min(1).max(6),
    expected_delta: z
      .object({
        proj_fp5: NumSchema,
        proj_stocks5: NumSchema,
        proj_ast5: NumSchema,
      })
      .strict(),
    risk_flags: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const AISuggestTransfersPayloadSchema = z
  .object({
    moves: z.array(AISuggestTransferMoveSchema).max(5),
    notes: z.array(z.string()),
  })
  .strict();

export const AISuggestTransfersResponseSchema = EnvelopeSchema(
  AISuggestTransfersPayloadSchema
);

/** POST /api/v1/ai/pick-captain */
export const AIPickCaptainBodySchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
  })
  .strict();

export const AIPickCaptainPayloadSchema = z
  .object({
    captain_id: IntSchema,
    alternatives: z.array(
      z
        .object({
          id: IntSchema,
          why: z.string(),
        })
        .strict()
    ),
    reason_bullets: z.array(z.string()).min(1).max(6),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const AIPickCaptainResponseSchema = EnvelopeSchema(AIPickCaptainPayloadSchema);

/** POST /api/v1/ai/explain-player */
export const AIExplainPlayerBodySchema = z
  .object({
    player_id: IntSchema,
  })
  .strict();

export const AIExplainPlayerPayloadSchema = z
  .object({
    summary: z.string(),
    why_it_scores: z.array(
      z
        .object({
          factor: z.enum(["rebounds", "assists", "stocks", "minutes", "usage"]),
          impact: z.enum(["low", "medium", "high", "very_high"]),
          note: z.string(),
        })
        .strict()
    ),
    trend_flags: z.array(
      z
        .object({
          type: z.enum([
            "fp_up",
            "fp_down",
            "minutes_up",
            "minutes_down",
            "stocks_spike",
          ]),
          detail: z.string(),
        })
        .strict()
    ),
    recommendation: z
      .object({
        action: z.enum(["add", "hold", "drop"]),
        rationale: z.string(),
      })
      .strict(),
  })
  .strict();

export const AIExplainPlayerResponseSchema = EnvelopeSchema(AIExplainPlayerPayloadSchema);

/** POST /api/v1/ai/analyze-roster */
export const AIAnalyzeRosterBodySchema = z
  .object({
    gw: IntSchema,
    day: IntSchema,
    focus: z.enum(["lineup", "waiver", "trade", "balanced"]),
  })
  .strict();

export const AIAnalyzeRosterPayloadSchema = z
  .object({
    summary_bullets: z.array(z.string()).min(1).max(5),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    quick_wins: z.array(
      z
        .object({
          title: z.string(),
          why: z.array(z.string()),
          risk_flags: z.array(z.string()),
          confidence: z.number().min(0).max(1),
        })
        .strict()
    ),
    recommended_actions: z.array(
      z
        .object({
          type: z.enum(["PICK_CAPTAIN", "SUGGEST_TRANSFERS", "OPTIMIZE_LINEUP"]),
          note: z.string(),
        })
        .strict()
    ),
    notes: z.array(z.string()),
  })
  .strict();

export const AIAnalyzeRosterResponseSchema = EnvelopeSchema(AIAnalyzeRosterPayloadSchema);

/** POST /api/v1/ai/injury-monitor */
export const AIInjuryMonitorBodySchema = z
  .object({
    player_ids: z.array(IntSchema),
    include_replacements: z.boolean(),
    max_salary: NumSchema.nullable(),
  })
  .strict();

export const AIInjuryMonitorPayloadSchema = z
  .object({
    items: z.array(
      z
        .object({
          player_id: IntSchema,
          status: z.enum(["OUT", "Q", "DTD", "ACTIVE", "UNKNOWN"]),
          headline: z.string().nullable(),
          impact: z.enum(["low", "medium", "high"]),
          recommended_move: z
            .object({
              action: z.enum(["hold", "bench", "drop", "swap"]),
              replacement_targets: z.array(
                z
                  .object({
                    player_id: IntSchema,
                    why: z.array(z.string()),
                    confidence: z.number().min(0).max(1),
                  })
                  .strict()
              ),
            })
            .strict(),
          risk_flags: z.array(z.string()),
        })
        .strict()
    ),
    notes: z.array(z.string()),
  })
  .strict();

export const AIInjuryMonitorResponseSchema = EnvelopeSchema(AIInjuryMonitorPayloadSchema);

/** ---------- Teams ---------- */

export const TeamSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
  })
  .strict();

export const TeamListPayloadSchema = z
  .object({
    items: z.array(TeamSchema),
    default_team_id: z.string().uuid(),
  })
  .strict();

export const TeamListResponseSchema = EnvelopeSchema(TeamListPayloadSchema);

export const TeamCreateBodySchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
  })
  .strict();

export const TeamCreatePayloadSchema = z
  .object({
    team: TeamSchema,
  })
  .strict();

export const TeamCreateResponseSchema = EnvelopeSchema(TeamCreatePayloadSchema);

/** ---------- Sync endpoints ---------- */

export const SyncRunPayloadSchema = z
  .object({
    run_id: z.string().uuid().nullable(),
    status: z.string(),
    counts: z.record(z.number()).optional(),
    errors: z.array(z.string()).optional(),
  });

export const SyncRunResponseSchema = EnvelopeSchema(SyncRunPayloadSchema);

export const SyncStatusPayloadSchema = z
  .object({
    last_success_at: z.string().nullable(),
    last_type: z.string().nullable(),
    counts: z.record(z.number()),
    is_stale: z.boolean(),
    source: z.string().nullable().optional(),
    duration_ms: z.number().nullable().optional(),
    error_count: z.number().optional(),
    // Fields present when querying a specific run_id
    run_id: z.string().uuid().optional(),
    status: z.string().optional(),
    started_at: z.string().optional(),
    finished_at: z.string().nullable().optional(),
    step: z.string().nullable().optional(),
    errors: z.array(z.string()).optional(),
  });

export const SyncStatusResponseSchema = EnvelopeSchema(SyncStatusPayloadSchema);

/** ---------- Import Game Data ---------- */
export const ImportGameDataPayloadSchema = z.object({
  games_imported: z.number(),
  player_logs_imported: z.number(),
  errors: z.array(z.string()).optional(),
});

export const ImportGameDataResponseSchema = EnvelopeSchema(ImportGameDataPayloadSchema);

/** ---------- Import Schedule ---------- */
export const ImportSchedulePayloadSchema = z.object({
  games_imported: z.number(),
  errors: z.array(z.string()).optional(),
});

export const ImportScheduleResponseSchema = EnvelopeSchema(ImportSchedulePayloadSchema);

/** ---------- optional: runtime helpers ---------- */
export function assertOk<T extends z.ZodTypeAny>(
  schema: z.ZodTypeAny,
  payload: unknown
): asserts payload is z.infer<T> {
  schema.parse(payload);
}
