Scope: web fixes only. Mobile PWA gets its own dedicated plan in a follow-up turn.

## 1. Daily Court Show — new "Next Games" slide

Add a slide that appears **only on slates with finalized games** (i.e. `healthWatchMode === "played"`), previewing the upcoming gameday. Same glassy aesthetic, framer-motion entrance, oversized team-logo watermarks, and gold accents as the existing Outstanding Performances / Recap slides.

Data (in `src/components/court-show/useCourtShowData.ts`):
- After computing the played slate, look up the **next gameday** from `deadlines`: first entry with `deadline_utc > now` whose `(gw, day)` differs from the current `(gw, day)`.
- Fetch that gameday's games via `supabase.from("schedule_games")` filtered by `league_id`, `gw`, `day` (new `useQuery`, gated on having a "next" deadline).
- For each game, compute `myRosterCount` = number of `rosterIds` whose `playersById.get(id).core.team` matches `home_team` or `away_team`.
- Build a new payload `next_games` with `{ gw, day, dateLabel, deadlineUtc, games: [{ game_id, away_team, home_team, tipoff_utc, myRosterCount, myRosterPlayers: [{player_id,name,photo}] (max 3) }] }`.

Types (in `src/components/court-show/types.ts`):
- Add `"next_games"` to `SlideKind`.
- Add `NextGamesPayload` + extend `SlidePayload` union.

Render (in `src/components/court-show/CourtShowSlide.tsx`):
- New branch in the slide switch that renders a horizontal/grid layout of game cards: away tricode + logo · @ · home tricode + logo, tipoff time in Lisbon (`format(... "HH:mm")` from `tipoff_utc`), and a small "N of your players" chip with stacked photo avatars when `myRosterCount > 0`. Empty state: subtle "No roster players in action".
- Reuse existing motion variants (delay-staggered cards), oversized faded team logos, gold accent ring on cards with roster impact.
- Click on a card → existing `onGameClick` handler with a synthetic `MatchupGame`-shaped payload (game_id + teams) so it opens the existing GameDetailModal.

Slide insertion order: push the slide **after Best Value Plays and before the Outro** so it acts as a forward-looking close to the recap show. Title: "Next Up"; subtitle: `Coming on ${dateLabel}`.

## 2. Health Watch — drop "Questionable" on played slates

In `useCourtShowData.ts`, the played-day branch already filters to players whose team played but had `mp <= 0`. Currently `reason` falls back to "Questionable" when `h.raw_status` is `Q`. Change so on `healthWatchMode === "played"`:
- Skip any player whose `health.status === "Q"` / `GTD` / `DTD` / `PROB` AND who actually has logged minutes (already handled).
- For the remaining "missed" set, normalize `reason` to "Did not play" when the only signal is a Questionable tag (i.e. drop the "Questionable" wording entirely on played slates).
- Also remove the upstream Questionable-only entries from `myRosterPlayedMissed` / `leagueWatchPlayedMissed` if their team didn't actually play (already filtered by `playedTeams`, just confirm).

Net effect: the Health Watch slide on a played day shows only OUT / DNP outcomes, never "Questionable".

## 3. Advanced — add date to the game-picker dropdown

File: `src/pages/AdvancedPage.tsx`, around lines 660–693 (the `<Select>` for `Pick a game`).

- Compute the gameday date from the same deadline lookup (`deadlines.find((d) => d.gw === gw && d.day === day)?.deadline_utc`) → `format(new Date(deadlineUtc), "EEE, MMM d")`.
- Add a small muted-foreground date label next to the "Pick a game" placeholder text in the `SelectValue` area: `Pick a game · Wed, May 13`.
- Inside each `<SelectItem>`, keep team rows + tipoff time as today (no per-row date — they all share the same gameday).

## Technical details

```text
useCourtShowData.ts
  ├─ existing "played" branch
  ├─ NEW: nextDeadline = deadlines.find(d => d.deadline_utc > now && (d.gw,d.day) !== (gw,day))
  ├─ NEW useQuery("court-show-next-games", …) → schedule_games rows
  └─ push { kind: "next_games", … } before outro

types.ts
  + SlideKind "next_games"
  + NextGamesPayload { gw, day, dateLabel, deadlineUtc, games: NextGameRow[] }

CourtShowSlide.tsx
  + render branch for "next_games" using existing motion + getTeamLogo helpers

AdvancedPage.tsx (~L660)
  + show "EEE, MMM d" next to placeholder using existing deadlines hook
```

No backend, schema, edge function, or scoring-logic changes. Strictly UI/data composition in the existing court-show client module + Advanced page select.

## Out of scope (separate plan next turn)

- Independent Android-first PWA mobile app (Prompts 1–15). Will be planned as a brand-new Lovable project that mirrors the Fantasy Court Coach visual DNA but never imports/edits this web app.