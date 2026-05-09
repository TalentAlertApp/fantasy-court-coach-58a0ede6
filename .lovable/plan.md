## Goal

Three fixes for the Daily Court Show + Team of the Week:
1. Move TOTW formation further left and up.
2. Polish the entry slide (sponsor card sizing + softer badge entry).
3. Redesign the Ballers.IQ slide: team logos in cards, deep-link the cards, drop FP5/L5 metrics, branch content for played vs scheduled games, and lift it to a premium look.

---

## 1) TOTW positioning fix

In `src/components/TeamOfTheWeekModal.tsx`:
- Increase the horizontal shift left in the `getFormation` offset (current `OFFSET_X = -6`, move to roughly `-9`).
- Add a vertical offset so both rows shift up: top FC row from `28%` → about `22%`, bottom BC row from `72%` → about `66%`. Apply by adjusting the `top` value returned from `getCourtFormation` (parse and subtract a constant), so we don't mutate `getRowPositions`/Starting-5 contract.
- Keep using `getCourtFormation` for left percentages.
- Update the snapshot tests in `src/test/court-formation.test.ts` if needed (only TOTW-specific tests, not the Starting-5 contract tests, which must remain locked).

## 2) Entry slide polish

In `src/components/court-show/RotatingBallersIQBadge.tsx`:
- The provided front PNGs (`ballers-iq-card-front-nba.png` / `wnba.png`) include a white/silver frame. Render the front `<img>` so it covers the entire card area (matches the gold back's footprint) — set `object-fit: cover`, remove the inset rounded white frame visually, scale image up so the silver border is clipped beyond the card. Concretely, wrap the `<img>` in an overflow-hidden rounded div and apply `transform: scale(~1.08)` plus negative inset, so the actual artwork fills the same area as the back.
- Match border-radius/dimensions of front and back exactly.

In `src/components/court-show/CourtShowSlide.tsx` (intro motion wrapper around the badge):
- Soften the entry: replace `scale 0.92 → 1` with a gentler `opacity 0 → 1, y: 12 → 0, scale 0.97 → 1`, longer duration (~1.1s), eased `[0.22, 0.61, 0.36, 1]`, and hold the rotation fade-in until after entry.

## 3) Ballers.IQ slide — premium redesign

### Data model (`src/components/court-show/types.ts` and `useCourtShowData.ts`)

Replace the flat `bullets` payload with structured cards so each card knows:
- `kind: "played" | "scheduled" | "player"`
- `away_team`, `home_team` (tricodes) + optional `nba_game_url` / `game_recap_url` / `game_id`
- `player_id` when card is player-anchored (linked to `/players?focus=…` or PlayerModal)
- Played-game payload: final score, margin, top performer (name + FP + box line), no L5/FP5 anywhere.
- Scheduled-game payload: tipoff time (Europe/Lisbon), competitiveness narrative, star anchor (player name only), roster relevance count — **no FP5/L5/value5/mpg5**.
- Player payload (e.g. slate-leading performer): season-to-date or single-game stats only.

In `useCourtShowData.ts`:
- Stop reading `last5`/`fp5`/`value5`/`mpg5` for the Ballers.IQ bullets.
- Build separate generators:
  - `buildPlayedCard(g, topPerformer)` → uses recap data already computed.
  - `buildScheduledCard(g, teamAgg)` → uses tipoff + competitive score + a player headline from season/last-game stats (e.g. `pts_pg`, `fp_pg_t`), not L5.
- Mix both kinds of cards on the slate (up to 4 cards): if some games are FINAL and some scheduled, show both with distinct visuals.

### Visual redesign (`CourtShowSlide.tsx` — `ballersiq` branch)

- Remove the current generic icon+title+body cards. Build two card variants:
  - **Played card**: dark glass panel, top row `[awayLogo] AWY  away_pts  —  hom_pts  HOM [homeLogo]`, "FINAL · margin N" chip, bottom strip with top performer (clickable photo + name + FP + box line). Background uses subtle radial highlight from winner's team color (already available via `nba-teams`).
  - **Scheduled card**: top row `[awayLogo] AWY  @  HOM [homeLogo]`, tipoff time pill, competitive score chip, a "Story" line ("Star-power leader", "Most competitive matchup", "Trap spot", etc.), optional star player chip.
- No container around the team logos — render them inline next to the tricode (away logo before AWY, home logo after HOM), each with a `hover:scale-110` surge and drop-shadow glow on hover. Reuse `getTeamLogo` directly.
- Wire interactivity:
  - Clicking the card calls `onGameClick(game)` (already plumbed → opens GameDetailModal / NBAGameModal).
  - Clicking a team logo/tricode calls `onTeamClick(tri)`.
  - Clicking the player chip calls `onPlayerClick(id)`.
- Premium polish:
  - Larger headline ("GAMENIGHT INTELLIGENCE") with subtle gradient text and a thin gold underline.
  - Cards use `bg-gradient-to-br from-white/[0.07] to-white/[0.02]`, 1px gold border at low opacity, hover lifts (translateY + glow), animated sheen sweep on mount.
  - Stagger reveal (Framer Motion, 80ms delay per card, easing `[0.22, 0.9, 0.3, 1]`).
  - Mode chip ("MATCHUPS · GW X.Y" / "RECAP · GW X.Y") rendered as a small enamel pill with the Ballers.IQ wordmark logo.

### Files touched

- `src/components/TeamOfTheWeekModal.tsx`
- `src/components/court-show/RotatingBallersIQBadge.tsx`
- `src/components/court-show/CourtShowSlide.tsx`
- `src/components/court-show/useCourtShowData.ts`
- `src/components/court-show/types.ts`
- (maybe) `src/test/court-formation.test.ts` for any TOTW-specific shifts; Starting-5 snapshot tests stay untouched.

### Validation

- `bunx vitest run` (court-formation tests still green).
- Visual check on `/schedule` → open Court Show modal: intro animates softly, front card fills the metallic frame, Ballers.IQ slide shows clickable team-logo + tricode pairs, played vs scheduled cards render distinctly, no `FP5` / `L5` strings anywhere on the slide.
- Visual check on TOTW modal for both 3FC+2BC and 2FC+3BC: formation visibly shifted left and up, no clipping.
