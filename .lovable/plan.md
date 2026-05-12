## Problem

Cecilia Zandalasini shows as Day-To-Day in the Injury Report modal, but her injury status doesn't appear in the Player Modal, "My Roster", or other player surfaces.

Root cause confirmed via DB query: `players.injury` is `NULL` for her, even though the WNBA injury report fetches her record correctly.

The bug is in `supabase/functions/wnba-injury-report/index.ts`. Its `persistInjuriesToPlayers` writes long human labels like `"Day-To-Day — knee"` into `players.injury`, but the column is constrained to normalized health codes (`OUT | Q | DTD | GTD | PROB`) — exactly what the NBA twin function (`nba-injury-report`) writes via its `toInjuryCode` helper. The WNBA writes silently fail (errors are not logged), leaving `injury` null, so `normalizePlayerHealth` returns no status downstream — hence nothing shows in PlayerModal / roster / lineup health badges.

## Fix

In `supabase/functions/wnba-injury-report/index.ts`:

1. Add a `toInjuryCode(rec)` helper mirroring the NBA function — maps statuses to `"OUT" | "Q" | "DTD" | "GTD" | "PROB" | null` (treat Suspended / Personal / Rest / Inactive as `OUT`, conservative `Q` fallback).
2. Replace `buildInjuryLabel` usage in `persistInjuriesToPlayers` with `toInjuryCode`. Skip records where the code is `null`. Compare against existing `hit.injury` using the code, not the long label.
3. Capture and log Supabase update errors (matching the NBA function's `updateErrors` / `firstErr` logging) so future failures aren't silent.
4. Leave the API response shape unchanged — the modal still receives the full human-readable `status` / `injury_type` for display; only what we persist to `players.injury` changes.

## Verification

- Re-trigger the WNBA injury report (the Injury Report modal already invalidates player caches after persist).
- Confirm `select injury from players where name='Cecilia Zandalasini'` returns `'DTD'`.
- Open her Player Modal and her row in My Roster — DTD chip / health icon should now render via the existing `HealthStatusBadge` / `HealthStatusIcon` path.

## Out of scope

No UI changes; the frontend already handles normalized health codes correctly. NBA function is unchanged (already correct).