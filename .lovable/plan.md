## Scope

Four polish/fix items. No business-logic changes.

---

### 1. Sidebar — actually center collapsed icons

`src/index.css` (collapsed nav block ~ line 358–367) and `src/components/layout/AppLayout.tsx`.

- Force the collapsed `.nav-item` to be a 40×40 flex box centered on the 60 px sidebar (`width: 40px; margin: 0 auto;` instead of `width: 100%`), keep `gap: 0.45rem`.
- Make the active `::before` indicator a **centered horizontal underline** (or a dot) instead of a vertical bar pinned to the left edge — that bar is what visually pulls icons off-center in image-501.
- Set the brand block (`px-4 py-5` div with the league logo) to use `justify-center` when collapsed so the NBA logo lines up on the same vertical axis as the nav icons + footer icons.
- Apply the same `40 px square + mx-auto` rule to the bottom Sign-Out / Theme / Collapse buttons (`.theme-toggle`) when collapsed so the whole column is one neat axis.

### 2. Game Detail modal — embedded recap + venue

`src/components/GameDetailModal.tsx`.

- **Venue in header (no extra height):** Render `venue.name` as a tiny chip on the same row as the GW/Day + tipoff badges (line 95–107). It re-uses the existing row, so header height does not grow.
- **Inline recap player:**
  - Only show a new green Tv2 icon-button (same green styling as the existing "Watch Recap on NBA.com" link, but icon-only) **directly under the score**, when `game.game_recap_url` exists. Hide it when not.
  - Clicking it sets a local `recapOpen` state. While true, the bottom panel (currently `<GameBoxScoreTable>` for played games) is replaced by an embedded video container that fills exactly that area (same height as the table — measured via `useRef` on the table wrapper, persisted in state, applied as `min-height` to the embed) with a small "× Close" pill in the top-right that returns to the box-score view.
  - Embed strategy: convert YouTube `watch?v=ID` / `youtu.be/ID` URLs to `https://www.youtube.com/embed/ID?autoplay=1` and render via `<iframe allow="autoplay; encrypted-media" allowFullScreen>`. For non-YouTube URLs, fall back to opening in a new tab (keep the existing external link as a secondary action).
  - The existing "Watch Recap on NBA.com" pill row stays for played games where users prefer the source site, but is hidden while the embed is open.
- No layout changes for scheduled games.

### 3. Injury persistence not landing on `players.injury`

Confirmed via DB read: Aaron Gordon (id 203932, NBA) has `injury = NULL` despite the report listing him OUT. The edge function's writer is the suspect.

`supabase/functions/nba-injury-report/index.ts` and `supabase/functions/wnba-injury-report/index.ts`.

- Drop the **25-minute in-memory throttle** (`lastPersistAt` / `PERSIST_THROTTLE_MS`). It only protects per-cold-start and is the most likely cause of "first run wrote nothing visible / next runs were skipped". Replace with a tiny per-request guard (skip only if `injuries.length === 0`).
- Add structured `console.log` lines around persist (`matched`, `cleared`, sample of unmatched names) so future regressions are obvious in edge logs.
- Verify name matching: keep current `normalizeName` (NFD + lowercase). Add a fallback that also tries `last-name + first-initial` only when an exact match fails, to catch CBS's `"A. DavisAnthony Davis"` residue.
- Re-deploy both functions (NBA + WNBA) so the new code is the one running when the user clicks "Refresh injury report".
- Client side: `InjuryReportModal` already invalidates `["players"]` and `["roster-current"]` when `persisted.matched > 0`. Also invalidate when `persisted.cleared > 0` (already covered) and when `persisted` is missing — defensive fallback so a deploy lag doesn't leave stale cache.
- Acceptance: after one click on "Injury Report" → refresh, `SELECT injury FROM players WHERE name='Aaron Gordon'` returns `'Out — …'`, and the player modal / Roster Court & List show his OUT badge.

### 4. /MY ROSTER header icons — color & Ballers.IQ button polish

`src/index.css` (`.header-icon-btn` block ~ line 322–356) and `src/pages/RosterPage.tsx` (header row ~ line 571–740).

- Add per-icon accent color modifiers on `.header-icon-btn`:
  - `.is-wishlist` → rose (`text-rose-400/70` → hover `text-rose-400`)
  - `.is-schedule` → sky (`text-sky-400/70` → hover `text-sky-400`)
  - `.is-advisor` → amber (matches Ballers.IQ accent)
  - `.is-chips` → violet
  - `.is-quick` → yellow (Zap)
  - `.is-reset` → keep destructive red (already done)
  - All keep the existing `scale(1.18)` surge + glow on hover; only the color tokens change. Works in light + dark via HSL tokens.
- Apply the matching class on each header button in `RosterPage.tsx`.
- **Ballers.IQ button (line 571–576):**
  - Increase the wordmark PNG to `!h-6` (was `!h-4`) and add internal padding so the PNG visually fills the pill.
  - Remove the opaque background — set the button to `bg-transparent`.
  - Replace the current border with `border-amber-400/60 hover:border-amber-400` and add a subtle amber glow ring on hover (`hover:shadow-[0_0_16px_-4px_hsl(var(--accent)/0.55)]`).
  - Add the same `scale(1.04)` surge on hover (button-level), and `scale(1.06)` on the inner PNG so it feels alive.
  - Verified in both dark + light via the existing `dark:hidden` / `hidden dark:block` PNG swap.

---

## Out of scope

- WNBA Google Sheets sync (postponed by user).
- Bottom Action Bar / deadline strip.
- Team Modal / Teams page health surfaces.
- Any change to scoring formulas or roster constraints.

## Verification

- TypeScript build passes.
- Manual: collapsed sidebar — icons centered on the same vertical axis as the league logo and footer icons.
- Manual: open a played game with `game_recap_url` set → green Tv2 icon under score → click → embed fills the box-score area → close returns to box score.
- Manual: click Injury Report → refresh → DB shows `players.injury` populated for Aaron Gordon → roster modal shows OUT.
- Manual: roster header in light + dark — each icon has its own tint; Ballers.IQ pill is transparent with amber border that glows on hover.
