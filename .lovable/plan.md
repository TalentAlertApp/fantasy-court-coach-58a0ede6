## 1. Ballers.IQ — past-tense voice on played gamedays

Problem: the slide shown for GW 2.1 (already played) uses the same forward-looking voice as GW 5.2 (scheduled). "ATL at DAL tips at 01:00…", "3 WNBA games tip on tonight's Wednesday…", "best WNBA value… makes him the easiest way to free cap room…" — all present/future for a slate that is already over.

Edit `supabase/functions/court-show-intelligence/index.ts`:

- Bump `VALIDATOR_VERSION` to `7` so every existing cached row regenerates.
- LLM system prompt: add an explicit voice rule keyed off `mode`:
  - `recap` → past tense, recap voice. Tips become "tipped", "led", "posted", "delivered", "finished as best $/FP". No "tonight's"/"tips at" phrasing; use "Wednesday's slate" / "last night".
  - `matchup` → present/future preview voice (current behavior).
  - `mixed` → blend, but every fact tied to a FINAL game must use past tense; facts tied to upcoming games stay present/future.
- Pass `mode`, plus `playedGames` and `upcomingGames` summaries, in `userPayload` so the model knows which tricodes/players are recap vs preview.
- Rewrite the deterministic backfill templates with a `recap` variant for each kind:
  - matchup_index → "{AWAY} at {HOME} tipped at {tip} Lisbon and {finished AWAYpts–HOMEpts | delivered the night's highest-leverage spot}. {topPerf} led the night with {fp} FP…"
  - form_index → "{player} ({team}) closed the {weekday} slate as the form leader, posting {fp} FP across his/her last five played games."
  - schedule_index → "{n} {league} games played on {weekday}, with first tip at {tip} Lisbon. {b2b ? "…back-to-back fatigue showed" : "minutes ran clean across the board"}."
  - market_index → "{player} ({team}) finished as the slate's best {league} value at {$/FP} dollars per fantasy point on {fp5} FP5 — the cleanest cap-relief anchor of the night."
- Choose recap vs preview backfill from the existing `mode` variable; for `mixed`, prefer recap voice for the form/market cards (anchored on `topPerformers`) and preview voice for the schedule card.

No frontend changes required for this item.

## 2. Feedback modal header — logos as cool watermark

Edit `src/components/FeedbackModal.tsx`:

- Remove the inline NBA + WNBA logo chip from the header row (the small bordered pill containing `nbaLogo` + `wnbaLogo`).
- Inside `DialogContent`'s decorative background layer (the `-z-10` div), add a top-left watermark group:
  - NBA logo rotated `-18deg`, ~`h-32 w-32`, `opacity-[0.10]` dark / `opacity-[0.07]` light, positioned `-top-6 -left-8`.
  - WNBA logo rotated `+12deg`, slightly smaller (~`h-24 w-24`), same opacity, positioned `top-10 left-14` so it overlaps the NBA mark with offset.
  - Wrapped in `pointer-events-none select-none`, `z-0`.
- Keep the existing `MessageSquareHeart` chip + title; header row collapses to just that text block.

## 3. Onboarding — sport-gated league chooser, no cross-league offers

Root cause: `NameStep` already collects the sport. `ChooseLeagueStep` then shows **all** the user's leagues plus a single MAIN card with an *additional* sport toggle, so a WNBA user could select MAIN-NBA, or pick a WNBA league row that goes through `teams` membership check (only `00…0010` is treated as the free Main league, while `00…0020` is not), producing the UNAUTHORIZED error.

Fix:

- `src/hooks/useFantasyLeagues.ts`: leave `MAIN_LEAGUE_IDS` as-is (both treated as accessible).
- `supabase/functions/teams/index.ts`: in the POST branch, treat both `MAIN_LEAGUE_NBA_ID` (`…0010`) and `MAIN_LEAGUE_WNBA_ID` (`…0020`) as free-entry: skip the `league_members` membership check for these two ids, and resolve the sport from the league row instead of `league_code`. Capacity check still applies.
- `src/components/onboarding/ChooseLeagueStep.tsx`:
  - Accept the locked sport from the parent via a new `lockedSport: "nba" | "wnba"` prop.
  - Remove the in-step "Choose sport" toggle on the MAIN card.
  - Show MAIN as a single row matching `lockedSport` (MAIN WNBA if WNBA, MAIN NBA if NBA) using `MAIN_LEAGUE_WNBA_ID`/`MAIN_LEAGUE_NBA_ID`. Default `selectedId` to that id.
  - Filter `others` to `l.sport === lockedSport` only — the user never sees the other league's customs/publics.
  - On submit, always pass `leagueCode: lockedSport`.
- `src/pages/OnboardingPage.tsx`: pass `lockedSport={pendingMainSport}` into `<ChooseLeagueStep />`. Remove `pendingMainSport` from `handleLeagueSubmit` since the chooser now owns the league id.

Result: user picks NBA/WNBA in NameStep → chooser only offers `{MAIN <sport>} + <sport> publics + <sport> customs + Join Code (private)` → `Create Team` succeeds on MAIN without membership check.

## 4. Premium "Enter the Court" intro polish

Edit `src/components/welcome-back/BallersIQEntryIntro.tsx`:

- Lengthen `DURATION_MS` to `7200` and `EXIT_MS` to `1100` for a slower, less hurried beat.
- Replace the shatter-in shards with a smoother sequence:
  - Background `courtBg` fades in from `opacity-0` to its target opacity over `1.2s` with a subtle `scale 1.04 → 1.00`.
  - Radial spotlight pulses (`opacity 0.6 → 1 → 0.85`) using `ease: [0.22, 1, 0.36, 1]`.
  - Keep shards but reduce their `scale` jitter (0.7–1.1) and `x/y` spread (±60), stagger via `delayChildren: 0.08, staggerChildren: 0.025`, total in-duration `0.9s` with `ease: [0.16, 1, 0.3, 1]`. On exit, shards drift outward instead of snapping back — `opacity 0`, `scale 1.06`, `transition duration: 0.9`.
- Logo (`RotatingBallersIQBadge`) animation:
  - Initial `opacity 0, scale 0.78, y: 24, filter: blur(8px)`, animate to `opacity 1, scale 1, y: 0, filter: blur(0)` over `0.9s` with `ease: [0.22, 1, 0.36, 1]`, delay `0.55s`.
  - Continuous subtle float: wrap badge in a second `motion.div` running `y: [0, -6, 0]` and `scale: [1, 1.015, 1]` on a `4.5s` infinite `easeInOut` loop.
  - Exit: `opacity 0, scale 1.06, filter: blur(6px)`, `duration 0.7`.
- Audio polish:
  - Fade IN over the first 700ms: start at `volume 0`, ramp to `0.9` in 14 steps of 50ms.
  - Extend the existing fade OUT to 700ms (already uses 10 steps; keep but slow each step).
  - Add `audio.preload = "auto"` and only start `play()` after `canplaythrough` (with a 250ms safety timeout) so the first half-second isn't clipped.
- Skip hint: animate in later (`delay 2.2`), softer color (`text-foreground/30`), gentle pulsing `opacity: [0.3, 0.55, 0.3]` on a `2.6s` loop.
- Wrap the whole `motion.div` exit with `opacity 0` over the full `EXIT_MS` (remove the `delay: EXIT_MS/1000 - 0.15` so the fade is continuous, not a late snap).
- Reduced-motion path: keep simple fade in/out (no shards, no float), but apply the same audio fade.

## Technical notes

- Edge function regeneration is automatic via the `VALIDATOR_VERSION` bump; the next read per `(league_id, gw, day)` will delete + rewrite the cached row.
- The `teams` POST change is the single source of truth for membership; no migration needed (the `00…0020` row already exists in `leagues`).
- No new dependencies; framer-motion is already used in `BallersIQEntryIntro`.

## Out of scope

- No changes to `NameStep` UI or sport picker styling.
- No edits to other Court Show slides (TopPerformerBlock etc.).
- No changes to LeaguesPage / Create / Join flows outside the chooser filter.
