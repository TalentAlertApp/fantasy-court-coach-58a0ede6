# Plan

## 1) YouTube API key rotation (doubles daily quota)

**Secret**
- Add `YOUTUBE_API_KEY_2` via the secrets tool (you provide the value in the secure form).

**`supabase/functions/youtube-recap-lookup/index.ts`**
- Read both `YOUTUBE_API_KEY` and `YOUTUBE_API_KEY_2` at startup into a `keys: string[]` (filter out empty).
- Track `keyIndex = 0`. Build each `search.list` URL with `keys[keyIndex]`.
- On HTTP 403 with a quota-style reason (`quotaExceeded` / `dailyLimitExceeded`):
  - If `keyIndex < keys.length - 1`: increment `keyIndex`, retry the SAME game once with the next key.
  - If already on last key: set `quotaExhausted = true`, break the loop (current behavior).
- Add `keys_used` (count) and `rotated` (boolean) to the response envelope so the panel can show "rotated to backup key".
- No change to scoring / matching / DB writes.

## 2) EuroLeague "Missing Recaps" counter at /commissioner

**`src/components/commissioner/MissingRecapsPanel.tsx`** — extend the existing panel to support EuroLeague:
- Widen the `league` prop type to `"nba" | "wnba" | "euroleague"`.
- Add EuroLeague league_id to `LEAGUE_ID` (`00000000-0000-0000-0000-000000000003`, matching `euroleague-recap-scrape`).
- Replace the NBA/WNBA tricode→logo lookup with a league-aware resolver: import `EUROLEAGUE_TEAMS` from `src/lib/euroleague-teams.ts` for EL rows. Falls back to plain tricode text when no logo.
- All other behavior (paged fetch, per-row refresh, batch re-scan, quota toast) already works — it calls `youtube-recap-lookup?league=euroleague` which is the same endpoint we just upgraded.

**`src/pages/CommissionerPage.tsx`**
- In the EuroLeague tab section (next to `EuroleagueSheetSyncPanel`), render `<MissingRecapsPanel league="euroleague" />`.

## Out of scope
- No DB migrations.
- No frontend logic changes outside the two files above + one panel mount.
- No changes to NBA/WNBA recap flows beyond the shared key-rotation upgrade.

## Verification
- After deploy: open /commissioner → EuroLeague tab → "Missing Recaps" shows a count + games list.
- Click "Re-scan missing only" → batches of 100 run; if the first key 403s, the response shows `rotated: true` and processing continues on the backup key.
