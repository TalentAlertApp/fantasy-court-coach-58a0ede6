## 1) Game Played modal — slimmer header

**File:** `src/components/GameDetailModal.tsx`

Tighten vertical rhythm in the header block (the `div` wrapping venue background, GW/D chip, score row, action links):

- Outer wrapper: `px-4 pt-3 pb-2` → `px-4 pt-2 pb-1.5`.
- GW/D + tipoff chip row: drop `pb-1.5`, reduce chip `py-0.5` → `py-px`.
- Score row: `py-1.5` → `py-1`; reduce away/home name container `h-12` → `h-10`, watermark logo `h-16 w-16` → `h-14 w-14`.
- Action-links row: `py-0.5` → `py-0`, link buttons `py-0.5` → `py-px`.
- Recap link: `pt-0.5` → `pt-0`, `py-1` → `py-0.5`.

Net effect: ~25–30 px shorter header, same content, no layout shift on small screens.

## 2) Schedule recap video — switch to GAMETIME HIGHLIGHTS channel

The current `youtube-recap-lookup` does an open YouTube search and frequently picks the wrong/weak match. Replace with a channel-scoped lookup against **GAMETIME HIGHLIGHTS** (channel ID `UC0LrZO9wORIqn_aRJtKdgfA`), which posts a "{Away} vs {Home} Full Game Highlights – {Month D, YYYY}" video for every NBA game shortly after final.

**File:** `supabase/functions/youtube-recap-lookup/index.ts`

Changes:
- Add `const GAMETIME_CHANNEL_ID = "UC0LrZO9wORIqn_aRJtKdgfA";`
- Build `query` as `"{awayFull} vs {homeFull} Full Game Highlights"` (no date in query — date is used for filtering and scoring).
- Call YouTube `search.list` with `channelId=GAMETIME_CHANNEL_ID`, `type=video`, `videoEmbeddable=true`, `order=date`, `maxResults=10`, `publishedAfter` = tipoff − 6h, `publishedBefore` = tipoff + 72h. Drop `videoDuration=medium` (their highlight reels are ~10 min and qualify, but the time-window already filters reliably).
- Scoring tweak: require both team city tokens AND ("highlights" OR "full game"); add +3 if title contains the exact ISO date `M D, YYYY` formatted as the channel uses (e.g. `April 5, 2026`); accept best match with `score >= 5`.
- If the channel-scoped search yields nothing (rare — old/foreign games), fall back to the previous open-search path so we never regress for already-stamped games.
- Keep the `clear=1` admin reset behavior so commissioner can re-scan and replace bad IDs from the old logic with the new channel-sourced ones.

**No DB schema change**; we keep `youtube_recap_id` (single 11-char video ID), and the existing `RecapCard` embed (`youtube-nocookie.com/embed/{id}`) keeps working.

**Commissioner action after deploy:** click "Re-scan all recaps" on `/commissioner` to repopulate IDs from the new source.

### Verification
- Header of played game modal visibly shorter (no overlap, score still bold/centered).
- After re-scan, opening any FINAL game shows the GAMETIME HIGHLIGHTS video matching that exact game/date; non-matching old IDs are replaced.
