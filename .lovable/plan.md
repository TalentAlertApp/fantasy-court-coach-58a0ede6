## Plan

### Issue 1 — MAIN EUROLEAGUE shouldn't appear in Discover
**Root cause:** Main NBA and Main WNBA are stored with `visibility = 'private'`, but Main EuroLeague was seeded with `visibility = 'public'`. The `leagues-discover` edge function filters by `visibility = 'public'`, so only the EuroLeague main leaks into Discover.

Verified via DB:
- `00000000-…010` (NBA Main) → private
- `00000000-…020` (WNBA Main) → private
- `00000000-…030` (EuroLeague Main) → **public** ← outlier

**Fix:** add a migration that flips Main EuroLeague to `visibility = 'private'` to match the other two mains. Belt-and-braces, also exclude any main-league id from the `leagues-discover` query so a future misconfiguration never re-leaks a main into Discover.

### Issue 2 — League names misaligned on "Name Your Franchise"
**Root cause:** `LeaguePickerCards` renders the long subtitle (e.g. "National Basketball Association") inside `max-w-[14ch] break-words`. With uppercase + `tracking-[0.2em]`, every glyph eats ~1.2ch, so the third word breaks mid-letter ("ASSOCIATIO" / "N"). The three cards then visually disagree because each name wraps at a different column.

**Fix:** in `src/components/LeaguePickerCards.tsx`, drop `break-words` (allow only normal word breaks), widen the subtitle to `max-w-[22ch]`, and reduce the subtitle's letter-spacing slightly (`tracking-[0.15em]`) so all three full-name labels wrap onto the same number of lines and stay center-aligned.

### Issue 3 — AI Coach Captain photo cuts off the forehead
**Root cause:** `CaptainPreview` in `src/components/ai-coach/StylePreferencesPanel.tsx` renders the captain headshot with `object-cover` and no anchor, so the rounded crop sits in the geometric center — same forehead-cut problem we just fixed on the court and Team of the Week cards.

**Fix:** add `object-top` so the face anchors to the top of the crop circle, matching the convention already used in `PlayerCard`, `LeaderTable`, `RotatingLeaderCard`.

### Files touched
- new migration: `supabase/migrations/<ts>_main_euroleague_private.sql` (UPDATE single row).
- `supabase/functions/leagues-discover/index.ts` — `.not("id","in", "(...)")` over the three known main-league UUIDs.
- `src/components/LeaguePickerCards.tsx` — subtitle alignment tweak.
- `src/components/ai-coach/StylePreferencesPanel.tsx` — `object-top` on captain headshot.
- Deploy `leagues-discover`.

No schema, RLS, or scoring changes. Purely a data correction + two presentation fixes.