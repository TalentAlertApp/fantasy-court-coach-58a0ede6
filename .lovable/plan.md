

## Implementation Plan: Incremental Sync, Enriched Status, Sync Card in Header

### Analysis of the Python Script

The uploaded Python script (`nba_fantasy_full_update_FORWEBAPP-2.py`) is a Google Colab notebook that:

1. **Block 1 (PerGame + LAST5)**: Fetches league-wide per-game stats from `stats.nba.com`, then per-player last-5 game logs. It writes to specific sheet columns while **preserving user-set columns** (FC_BC, salary, jersey, college, weight, height, DOB, EXP, POS) and **formula columns** (FP_PG_T, Value_T, FP_PG5, Value5).

2. **Block 2 (LAST_GAME)**: Fetches league game logs, finds each player's most recent game, maps team scores from the team game log, and writes to columns AI:AS (date, opp, away_pts, home_pts, mins, pts, ast, reb, blk, stl, link).

**The existing sheet fallback in `nba-sync` already correctly maps all these columns to Supabase.** The Python script populates the sheet, and the fallback reads it. The flow is: `Python Colab → Google Sheet → nba-sync fallback → Supabase`. This is already working correctly. No changes needed to the sheet mapping.

### Changes

#### 1. `supabase/functions/sync-status/index.ts`
Add `source`, `duration_ms`, `error_count`, `errors` to the summary (no `run_id`) response:

```typescript
// After computing lastSuccessAt and isStale, add:
const durationMs = (latest?.started_at && latest?.finished_at)
  ? new Date(latest.finished_at).getTime() - new Date(latest.started_at).getTime()
  : null;

return okResponse({
  last_success_at: lastSuccessAt,
  last_type: latest?.type ?? null,
  counts: latest?.details?.counts ?? {},
  is_stale: isStale,
  source: latest?.details?.source ?? null,
  duration_ms: durationMs,
  error_count: (latest?.details?.errors ?? []).length,
  errors: latest?.details?.errors ?? [],
});
```

#### 2. `src/lib/contracts.ts`
Extend `SyncStatusPayloadSchema` with the new fields:
```typescript
source: z.string().nullable().optional(),
duration_ms: z.number().nullable().optional(),
error_count: z.number().optional(),
```

#### 3. `src/components/layout/AppLayout.tsx` — Major UI changes

Replace the current simple "Sync: Xm ago" text + single Sync button with:

**A. Sync Status Card** — compact inline card placed *before* the Sync button:
```
┌──────────────────────────────┐
│ NBA ●  14s  │  3m ago        │
│ 521 players  │  0 errors     │
└──────────────────────────────┘
```
- Source badge: "NBA" (green) or "Sheet" (amber)
- Duration: formatted from `duration_ms`
- Relative time from `last_success_at`
- Player count from `counts.players`
- Error count (red badge if > 0)
- "Stale" badge if `is_stale`

**B. Split Sync Button** — replaces single button:
- Main click = **Quick Sync** (`type: "LAST_GAME"`) — lightweight, only fetches latest games
- Dropdown option = **Full Sync** (`type: "FULL"`) — heavy, all stats + game logs

Implementation: Use a DropdownMenu from radix with a split button pattern. The main button says "Quick Sync" with a small chevron-down trigger for the dropdown containing "Full Sync".

### Files Modified (3)
1. `supabase/functions/sync-status/index.ts` — enrich summary response
2. `src/lib/contracts.ts` — extend SyncStatusPayloadSchema
3. `src/components/layout/AppLayout.tsx` — sync status card + split sync button

