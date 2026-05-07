# Plan

## 1) YouTube Game Recaps — coverage and WNBA

**a) How to add more recaps to /schedule**
- The `youtube-recap-lookup` edge function already pulls from the GAMETIME HIGHLIGHTS channel, but only processes 50 FINAL games per call (max 100). It also only touches games where `status='FINAL'` and `youtube_recap_id IS NULL`.
- **Action for the user:** keep clicking **RE-SCAN ALL RECAPS** in `/commissioner` (it sends `clear=1&limit=100`) — every click clears stored IDs and re-tries up to 100 games. Re-run a few times until "remaining" reaches 0. Channel-scoped lookups are very cheap on YouTube quota, so several runs are fine.
- We will also raise the per-call cap from 50 → 100 by default (and surface the "remaining" count more visibly) so each click does the maximum work.

**b) WNBA support**
- GAMETIME HIGHLIGHTS is NBA only. For WNBA games the channel-scoped search will return nothing and the open-search fallback will rarely produce a confident match because the query template is hard-coded to "Full Game Highlights".
- We will make `youtube-recap-lookup` league-aware:
  - Read `league_code` from `schedule_games` (join via `leagues` if needed) per game.
  - For NBA → use `GAMETIME_CHANNEL_ID` as today.
  - For WNBA → use the official **WNBA YouTube channel** (`UCqYwOSqyi0tEPRRwTPL5MXA`, `@WNBA`) which posts `{Away} vs. {Home} | Highlights` (and "Full Game Highlights" for some games). Query template: `{awayFull} vs {homeFull} Highlights`. Same scoring, lower `minScore` (4) because WNBA titles often omit "Full Game".
  - WNBA fallback open-search keeps `highlights wnba` in the query.

## 2) App branding — show NBA + WNBA together

**a) Sidebar header (`src/components/layout/AppLayout.tsx`)**
- Remove the inline NBA logo to the left of "FANTASY MANAGER".
- Keep the existing NBA watermark (top-right, rotated, opacity .08).
- Add a second watermark with the WNBA logo (`src/assets/wnba-logo.png`) mirrored to the **far right inline with NBA** — actually the NBA watermark is already top-right; we move NBA to top-left watermark and add WNBA top-right watermark, both with identical size (`h-24 w-24`), opacity, rotation, and absolute placement, so the brand row reads as league-agnostic.
- Rationale: user asked to remove the NBA logo before the wordmark and add WNBA "to the far right" with the same effect/size as the existing NBA watermark.

**b) Welcome Back hero (`src/components/welcome-back/WelcomeBackHero.tsx`)**
- In the top-left brand cluster, add the WNBA logo (`h-9 w-auto`) inline **before** the existing NBA logo (so order = WNBA, NBA, "FANTASY"). Same size, same alignment.

**c) Onboarding hero (`src/components/onboarding/OnboardingHero.tsx`)** — apply the same WNBA + NBA inline pair so the two entry points stay consistent.

## 3) /schedule — Advanced Grid + Injury Report for WNBA

**Advanced Schedule Grid (`src/pages/ScheduleGridPage.tsx`)**
- Replace `import { NBA_TEAMS } from "@/lib/nba-teams"` with `useLeagueTeams()` (already exists, returns NBA or WNBA teams uniformly).
- Use `teams` from the hook for `sortedTeams`, tricode lookups, logos, and team modal links.
- The `useScheduleWeekGames` hook reads `schedule_games` which is already league-aware via `LeagueProvider`/`apiFetch` — no schema change needed.
- Header subtitle stays generic ("17 games"), no NBA-specific copy.

**Injury Report (`src/components/InjuryReportModal.tsx` + edge function)**
- Frontend: replace `NBA_TEAMS` references with `useLeagueTeams()` for the team filter dropdown, name/tricode resolution, and logo. Watermark logo switches to WNBA when `league==='wnba'`.
- Function call: when `league==='wnba'`, call a new `wnba-injury-report` edge function (mirrors `nba-injury-report` shape) that aggregates from ESPN WNBA + RotoWire WNBA injury pages. Same response envelope (`by_team`, `all`, `generated_at`).
- Modal title stays "Injury Report" (no "NBA").

## 4) HOW TO PLAY guide

**a) New chapter: "Indexes & Ballers.IQ"**
- Add an accordion item between **Scoring** and **FAQ** titled `🧠 Indexes & Ballers.IQ`.
- General copy (no formulas):
  - **Ballers.IQ** — a per-player intelligence score that blends recent form, role stability, opponent difficulty, schedule density, market value, and injury context into a single 0-100 read on "how confident should I be in this player this gameweek?".
  - **Form Index** — momentum signal weighted toward the most recent games.
  - **Matchup Index** — adjusts for opponent defensive strength and pace.
  - **Schedule Index** — accounts for back-to-backs, rest days, and games per gameweek.
  - **Market Index** — value-vs-salary read, flags over/under-priced players.
  - **Role Stability** — minutes/usage consistency over the trailing window.
- Closing line: "Indexes are advisory — always cross-check with the live injury report and your own watch."

**b) League-aware copy**
- The guide is shared across NBA and WNBA teams. Use `useLeague()` to resolve `league` and templating:
  - `"Maximum 2 players from the same {LEAGUE} team."` where `{LEAGUE}` = "NBA" or "WNBA".
  - `"Each gameday can have 1–15 {LEAGUE} games."` (cap stays accurate for both).
  - All other strings are already league-neutral; verify and remove any other "NBA" mentions.
- One source file, two outputs driven by the active team's league.

## Technical notes

- `youtube-recap-lookup`: needs to read `league_code` per game. Either join `leagues` in the FINAL-games query, or look it up once per league and pass it through (cheaper). New const `WNBA_CHANNEL_ID = "UCqYwOSqyi0tEPRRwTPL5MXA"`. Query selection branches on `league_code`.
- `wnba-injury-report`: new Deno function modeled on `nba-injury-report/index.ts`. Sources: `https://www.espn.com/wnba/injuries`, `https://www.rotowire.com/basketball/wnba-injury-report.php`. Reuse the same `normalizeStatus` + `InjuryRecord` shape so the modal needs no shape changes. Public, cached 30 min.
- No DB migration needed.
- After deploy, user must click **RE-SCAN ALL RECAPS** once more so WNBA games get re-tried with the new channel.

## Files to change

- `src/components/layout/AppLayout.tsx` — drop inline NBA, add WNBA watermark
- `src/components/welcome-back/WelcomeBackHero.tsx` — add WNBA logo before NBA
- `src/components/onboarding/OnboardingHero.tsx` — same dual-logo treatment
- `src/pages/ScheduleGridPage.tsx` — `useLeagueTeams()` everywhere `NBA_TEAMS` is used
- `src/components/InjuryReportModal.tsx` — `useLeagueTeams()`, league-aware function name + watermark
- `src/components/HowToPlayModal.tsx` — league templating + new BIQ chapter
- `supabase/functions/youtube-recap-lookup/index.ts` — league-aware channel/query
- `supabase/functions/wnba-injury-report/index.ts` — new file
