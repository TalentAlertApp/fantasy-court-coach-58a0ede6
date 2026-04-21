

## Plan: Onboarding polish + resume + manual draft + roster handoff

### 1 · Skip-for-now bypass (session-scoped)
- In `OnboardingHero.tsx`, add a small `Skip for now →` link right under the "3 quick steps · ~60 seconds" caption (low contrast, underline on hover).
- On click, set `sessionStorage["nba_onboarding_skipped"] = "1"` and `navigate("/", { replace: true })`.
- In `useFirstRunGate.ts`, suppress `shouldOnboard` when the session flag is present, so `RequireAuth` won't bounce the user back to `/welcome` until the next browser session (closing the tab clears `sessionStorage`).
- Sign-out clears the flag so a new account on the same machine still gets onboarded.

### 2 · Persistent step + resume
- Extract step state into `localStorage["nba_onboarding_state"]` keyed by user id. Shape: `{ step: "hero"|"name"|"draft", teamId?: string, teamName?: string }`.
- `OnboardingPage.tsx` initialises `step` from this store (falling back to `"hero"`); every transition writes to the store.
- On mount, if `step === "draft"` but `teamId` does not match an owned team in `useTeam().teams`, fall back to `"name"` (defensive against deleted teams). If `teamId` is valid, hydrate `selectedTeamId` and `createdTeamName` so `<DraftStep>` renders correctly after refresh.
- When onboarding completes (handoff to roster — see §6), clear the store.

### 3 · Auto-draft uses live gameweek/day
- Replace the hardcoded `{ gw: 1, day: 1 }` in `DraftStep.tsx` (and the same call we'll add for manual completion) with `getCurrentGameday()` from `@/lib/deadlines` — same source the rest of the app uses (Roster, Schedule, Advanced).
- Pass the resolved `{ gw, day }` to `autoPickRoster({ gw, day, strategy: "value5" })`. No new endpoint required.

### 4 · Manual mode → PlayerPickerDialog gated to 10 picks
- The "Manual" tile in `DraftStep.tsx` becomes a real flow:
  - Open `<PlayerPickerDialog>` inline, supplying `allPlayers` from `usePlayersQuery({ limit: 1000 })` and an empty `rosterIds` set initially.
  - Each `onSelect(player)`: append to local `picks: PlayerListItem[]`, keep dialog open, update `rosterIds` and `rosterTeams` so the picker enforces the standard rules (no duplicates, max-2-per-NBA-team via the same plumbing the roster page uses).
  - Show a sticky progress strip above the dialog: `Picked 4/10 · 2 FC · 2 BC · $42M / $100M` so the user always knows what they need.
  - Continue/Done button enables only when picks satisfy: 10 players, exactly 5 FC + 5 BC, sum(salary) ≤ 100, max 2 per team.
- On Done: split into starters (first 5: must include ≥2 FC + ≥2 BC — auto-pick best valid combination) and bench (remaining 5), then call `saveRoster({ gw, day, starters, bench, captain_id: 0 })` with current gameweek (§3). Then proceed to handoff (§6).

### 5 · Hero (Step 1) visual updates
- **Sign-out → icon, context-sensitive**: replace the `Sign out` text button in the header with a `<LogOut />` icon button (`size-9 rounded-full hover:bg-foreground/10`), with `aria-label` and a `<Tooltip>` reading "Sign out · {email}". The email no longer renders as standalone text.
- **"Welcome to" sparkles**: drop the two `<Sparkles />` icons from the eyebrow line; keep only the centered text `WELCOME TO`.
- **Bottom info chips** (`$100M Cap`, `10 Players`, `5 FC + 5 BC`, `1 Captain · 2× FP`):
  - Border: NBA yellow — `border border-[hsl(var(--nba-yellow))]` (same token used by the `SQUAD` accent and the rest of the app's yellow surfaces).
  - Background: stays subtle/translucent.
  - Text: `text-foreground` becomes `text-black font-bold` so the label reads as bold black on the yellow ring (still legible on the page background; the chip itself remains transparent so this matches image-214's intent of "yellow border + bold black label").

### 6 · Step 3 layout consistency + roster handoff
- Restructure `DraftStep.tsx` to match steps 1 & 2:
  - Same vertical layout: eyebrow `STEP 2 OF 2` → big heading `DRAFT YOUR SQUAD` → option cards → primary CTA.
  - Reuse the same yellow chip styling from §5 for the strategy summary chips.
- After **any** path completes (auto-draft success, manual 10/10 save, AI Coach apply), instead of showing a separate "drafting" overlay, run a short success state ("Roster ready · routing to court…") then:
  - Invalidate `["roster-current", teamId]` and `["teams"]`.
  - Clear `localStorage["nba_onboarding_state"]`.
  - `navigate("/", { replace: true })` — `RosterPage` (already the index route) takes over and renders the standard MY ROSTER screen with the freshly-drafted 10 players. No bespoke embedded roster view inside onboarding — the user lands on the real page they'll use every day.

### Files
**Edit**: `src/pages/OnboardingPage.tsx`, `src/components/onboarding/OnboardingHero.tsx`, `src/components/onboarding/DraftStep.tsx`, `src/hooks/useFirstRunGate.ts`, `src/contexts/AuthContext.tsx` (clear session+local onboarding keys on signOut).
**New**: `src/lib/onboarding-store.ts` — typed get/set/clear helpers for the per-user resume state and the session skip flag.

### Acceptance
- Hero shows a `LogOut` icon (tooltip = email + Sign out); no sparkles around "Welcome to"; the four chips have a yellow border and bold black text.
- Click `Skip for now` → land on `/` and stay there; refresh `/` keeps you on roster (no bounce). Close tab + reopen → onboarding shows again because session flag is gone.
- Type a name on step 2, refresh `/welcome` → still on step 2 with name preserved. Advance to step 3, refresh → still on step 3 with the franchise name in the heading and `selectedTeamId` already set.
- Auto-Draft now stamps the rows under today's `(gw, day)` per `getCurrentGameday()`.
- Manual: pick fewer than 10 → Done disabled with helper text. Reach 10 valid players → Done enabled → land on `/` with the 10 players visible on the standard roster screen.
- Step 3 mirrors the visual rhythm of steps 1 & 2 (eyebrow, heading, cards, CTA, chips).

