## Goal

Six related polish/UX upgrades to the Daily Court Show + Team of the Week, plus AI-powered Ballers.IQ intelligence cards and a brand-new "Outstanding Game" slide.

---

## 1) TOTW positioning (final pass)

`src/components/TeamOfTheWeekModal.tsx`:
- Replace the asymmetric `OFFSET_X = -9` with a smaller centered offset (`-3`), and bump `OFFSET_Y` from `-6` to `-10` so the formation visually sits centered horizontally and nudges up.
- Starting-5 contract tests in `src/test/court-formation.test.ts` remain untouched.

## 2) PLAYED GAMES RECAP — paginated all-games carousel + new card

`src/components/court-show/useCourtShowData.ts`:
- Stop slicing `recap` to 4. Pass ALL final games for the day, sorted by margin asc (closest first), into the slide payload.
- Each recap game already carries `topPerformer` (highest FP across both teams) — that's the player we surface (not "home team's top scorer").

`src/components/court-show/CourtShowSlide.tsx` (`recap` branch):
- Render up to 6 cards per page in a 2×3 grid; if there are more games, paginate every 3 seconds via an internal `useEffect` interval, then signal "page-done" so the modal can advance to the next slide once the last page has been shown.
- Card redesign:
  - Remove the "Margin: N" line entirely.
  - Replace the small bottom "top performer" inline label with the **full player block** currently used inside `BiqPlayedCard` (photo + flame + name + FP + box-score line) — extracted into a shared `<TopPerformerBlock />` so both slides use it.
  - Keep card vertical height comparable to the current one.

`src/components/court-show/CourtShowModal.tsx`:
- Extend the slide-duration logic so a `recap` slide with paginated content stays open until all pages have cycled (3s × pages). Voiceover/audio sync continues to use the original per-slide caption; pagination is purely visual.

## 3) GAMENIGHT INTELLIGENCE — true AI-driven cards

### Schema (migration)

Add `court_show_intelligence` table to cache pre-generated cards per league/gw/day:

```
court_show_intelligence(
  league_id uuid,
  gw int, day int,
  mode text,                  -- 'recap' | 'matchup' | 'mixed'
  cards jsonb,                -- array of 4 cards (see shape below)
  headline text,
  generated_at timestamptz,
  primary key (league_id, gw, day)
)
```
Public-read RLS, no client write (only edge functions write).

Each cached card is one of:
- `{ kind: "form_index", player_id, team, headline, body, indices: { form, matchup, schedule, market, role } }`
- `{ kind: "matchup_index", game_id, away, home, headline, body }`
- `{ kind: "schedule_index", team, headline, body }`
- `{ kind: "market_index", player_id, headline, body }`
- `{ kind: "role_stability", player_id, headline, body }`

Always 4 cards, drawn from the 5 indexes documented in the HOW TO PLAY → INDEXES & BALLERS.IQ guide (Form, Matchup, Schedule, Market, Role Stability) so the slide is consistent with the rest of the app.

### Edge function `court-show-intelligence`

Generates 4 AI-driven cards for a given `(league_id, gw, day)`:
- Pulls `schedule_games` for the slate, `players` season + last5 stats, top performers from `player_game_logs`, and roster context.
- Builds a structured prompt using the existing `src/lib/ballers-iq` modules (`indexes`, `narrative`, `promptBuilder`) so card content is grounded in real numbers, not free invention.
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) via tool-calling for structured JSON; system prompt enforces consistency with the in-app Indexes definitions.
- For PLAYED days: cards summarise what happened (top performer's Form Index spike, biggest market mover, role stability winner, matchup whose result confirmed/broke the matchup index).
- For SCHEDULED days: cards highlight the night's best Form/Matchup/Schedule/Market/Role reads.
- Upserts into `court_show_intelligence`. Idempotent.

### Trigger from `import-game-data`

After a successful game-data ingest for a given gw/day, the function `await`s a single call to `court-show-intelligence` (mode "recap" or "mixed") so cards are ready before the user opens the modal. Failure is logged but not fatal — the UI falls back to the legacy generated cards.

### Frontend

`src/components/court-show/types.ts` — extend `BallersIQSlidePayload` with `aiCards: AICard[]` (typed union of the 5 kinds).

`src/components/court-show/useCourtShowData.ts`:
- New query that reads `court_show_intelligence` for the current `(league_id, gw, day)`.
- If present, hydrate `aiCards` (always 4). If absent, render skeleton cards + invoke the edge function on-demand.
- Drop the current `played`/`scheduled` card builders for this slide — those move to the new "OUTSTANDING GAME" + the existing "PLAYED GAMES RECAP" / "HIGH-COMPETITIVE MATCHUPS" slides.

`src/components/court-show/CourtShowSlide.tsx` (`ballersiq` branch):
- Render 4 AI cards in a 2×2 grid. Each card uses one accent color per index (Form=emerald, Matchup=amber, Schedule=sky, Market=violet, Role=rose), an enamel pill with the index name, headline, body, and small "Index 0–100" mini-meter when applicable.
- Inline team logos / player photos are clickable (deep-link via existing `onTeamClick` / `onPlayerClick`).
- Premium polish kept: gradient border, sheen sweep, staggered entry.

## 4) Entry slide tweaks

`src/components/court-show/CourtShowSlide.tsx` (`intro` branch):
- Remove the `dateLabel` line under `GW X.Y`.
- Move the Games + Deadline row up (reduce top gap; place it directly under GW number).
- Keep the rotating Ballers.IQ badge anchored at its current vertical position (no shift).
- Restyle the Deadline value to use the same `text-3xl font-heading font-black text-white` treatment as `gamesCount`, with a smaller `Deadline` caption underneath identical to `Games`. Drop the `<Clock>` icon and the amber mono font.

## 5) Slide order

`src/components/court-show/useCourtShowData.ts`:
- Reorder pushes so the sequence becomes: **Intro → Ballers.IQ → Performances/Value → Played Games Recap (if any) → Outstanding Game (if any) → High-Competitive Matchups (if any) → Captain Radar → Outro**.
- Ballers.IQ slide is always present (skeleton if AI cards are still generating).

## 6) HIGH-COMPETITIVE MATCHUPS — NLP storyline replaces metric chips

`CourtShowSlide.tsx` (`matchups` branch):
- Remove the `Star {n}` / `{n} fantasy-rel.` chips.
- Replace with a single short NLP sentence built from the same numbers (e.g. "Two All-Stars and three rostered starters in a near-even tilt." or "Late-tip slate hammer with elite ceiling on both sides."). Sentence is generated client-side by a small helper in `useCourtShowData.ts` using thresholds on `competitiveScore`, `starPower`, `rosterRelevant`, and `label`. No AI call needed for this one.
- Keep the StoryBadge label.

## 7) NEW SLIDE — "OUTSTANDING GAME" (played-game days only)

### Selection

In `useCourtShowData.ts`, compute composite score per FINAL game:
```
score = normalize(topPerformerFP) * 0.45
      + normalize(1 / (margin + 1)) * 0.30   // closeness
      + normalize(home_pts + away_pts) * 0.25
```
Pick the highest-scoring game; expose as `outstanding: { game, topPerformers: TopPerformer[] (top 10 by FP) }`.

### Types

Add `OutstandingGamePayload` and `kind: "outstanding"` to `SlidePayload` in `types.ts`.

### Slide UI (`CourtShowSlide.tsx`)

Two-column layout mirroring `/schedule` row expansion:
- **Left**: game header (away logo + tricode + score · FINAL · home score + tricode + logo, tipoff venue), then a top-10 player table (rank, photo, name, team, FP, PTS, REB, AST, STL, BLK) sorted by FP. Reuses `GameBoxScoreTable`-style layout already in the project. Rows are clickable → `onPlayerClick`.
- **Right**: embedded YouTube recap (uses `schedule_games.youtube_recap_id`); fallback to a thumbnail link if missing.
- Header: "OUTSTANDING GAME · GW X.Y", subtitle: short NLP one-liner ("Drama, ceiling and points — the night's marquee tilt.").

### Data

Already covered by the `player_game_logs` query in the hook. Need to widen the top-10 list to all logs of the chosen game (already fetched).

---

## Files touched

- `src/components/TeamOfTheWeekModal.tsx` (item 1)
- `src/components/court-show/useCourtShowData.ts` (items 2, 3, 5, 6, 7)
- `src/components/court-show/CourtShowSlide.tsx` (items 2, 3, 4, 6, 7)
- `src/components/court-show/CourtShowModal.tsx` (item 2 — paginated slide duration)
- `src/components/court-show/types.ts` (items 3, 7)
- New shared `src/components/court-show/TopPerformerBlock.tsx` (item 2)
- New `supabase/functions/court-show-intelligence/index.ts` (item 3)
- `supabase/functions/import-game-data/index.ts` (item 3 — post-ingest trigger)
- New migration: `court_show_intelligence` table + RLS (item 3)

## Validation

- `bunx vitest run` — TOTW formation + Starting-5 snapshot tests still green.
- Visual on `/schedule` → open Court Show modal:
  - TOTW: formation centered horizontally, lifted up.
  - Intro: no date line, Games + Deadline visually paired and styled identically.
  - Slide order: Intro → Ballers.IQ → … as specified.
  - Played-day modal: Recap paginates 6-at-a-time every 3s, top-performer block matches Ballers.IQ styling, no Margin label.
  - Outstanding Game slide renders with top-10 table left + YouTube recap right.
  - Ballers.IQ slide always shows 4 AI-driven cards; played vs scheduled framing is consistent.
  - Matchups slide shows a single short narrative sentence in place of the chips.
- Edge function: invoke `court-show-intelligence` for a known gw/day, confirm row in `court_show_intelligence` and 4 well-formed cards.

