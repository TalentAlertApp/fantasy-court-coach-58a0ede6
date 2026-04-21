

## Plan: Premium First-Run Onboarding ("Draft Your Squad")

### Context
First-time users land on `/auth`, sign up, then arrive at `/` with **zero teams** of their own (legacy teams are visible but not owned). Today they'd see either someone else's roster or a tiny empty-state card — no narrative, no wow factor. We'll insert an immersive full-page onboarding flow that triggers automatically the first time a signed-in user has no owned team, and lets them name their franchise + draft a roster in one cinematic experience.

### Trigger
- New route component `OnboardingPage.tsx` mounted at `/welcome`.
- A new `useFirstRunGate` hook checks: `auth ready && teams loaded && (no team owned by current user)`. When true and the user is not already on `/welcome` or `/commissioner`, redirect to `/welcome`.
- Once the user finishes onboarding (their team is created and has 10 players), redirect to `/` and never trigger again.

---

### The Experience — 3 cinematic steps

**Full-screen, dark, NBA-yellow accents, large typography. No sidebar (rendered outside `AppLayout`).**

#### Step 1 · Hero
```text
┌──────────────────────────────────────────────────────────┐
│ [NBA logo]                                    [Sign out] │
│                                                          │
│              W E L C O M E   T O                         │
│            ███ FANTASY ███                               │
│            "Build the team. Run the league."             │
│                                                          │
│   [ Floating player photos drift across background ]     │
│                                                          │
│             ╭──────────────────────╮                     │
│             │  ► START YOUR DRAFT  │                     │
│             ╰──────────────────────╯                     │
│                                                          │
│         3 quick steps · ~60 seconds                      │
└──────────────────────────────────────────────────────────┘
```
- Animated gradient backdrop (deep navy → NBA blue), faint NBA logo watermark.
- A row of 8–10 randomly picked player photos from `usePlayersQuery` floats slowly left-to-right (CSS keyframe, `prefers-reduced-motion` respected) at low opacity to give cinematic life.
- Single yellow CTA `Start Your Draft` → step 2.
- Tiny chips at the bottom: `$100M cap · 10 players · 5 FC + 5 BC`.

#### Step 2 · Name your franchise
```text
       Step 1 of 2 ──●──○                  [skip naming]
       
       NAME  YOUR  FRANCHISE
       
       ┌──────────────────────────────────────┐
       │  Lakers of Lisbon                    │  ← big input
       └──────────────────────────────────────┘
       Suggestions: [Court Kings] [Splash Lab] [Triple Threat] [Glass Cleaners]
       
                    [ ← back ]   [ next → ]
```
- Pre-filled with 1 of ~12 punchy default names (random) so the user can hit `next` instantly.
- Suggestion chips are clickable and replace the input.
- `next` → calls `createTeam({ name })`, switches `selectedTeamId`, advances.

#### Step 3 · Draft your squad
```text
       Step 2 of 2 ──●──●
       
       D R A F T   Y O U R   S Q U A D
       
       ┌─ Pick a strategy ────────────────────────────────┐
       │ [⚡ AUTO-DRAFT]   [✋ MANUAL]   [🤖 AI COACH]    │
       └──────────────────────────────────────────────────┘
       
       Auto-Draft: We'll build a balanced 10-player roster
       optimised for the next 5 games (value-based).
       
       Manual: Hand-pick all 10 players yourself.
       
       AI Coach: Tell us your style ("punt assists", "stars
       and scrubs") and we'll draft for you.
       
            ╭─────────────────────────╮
            │   ▶  GO TO MY ROSTER    │
            ╰─────────────────────────╯
```
- **Auto-Draft** (default, primary yellow button) — calls existing `autoPickRoster({ gw, day, strategy: "value5" })`. Shows a 1.5s "Drafting…" overlay with NBA-yellow shimmer over a court silhouette, then routes to `/`.
- **Manual** — opens the existing `PlayerPickerDialog` in a centered modal; on close (or after first pick), routes to `/`. Roster page already supports incremental adds.
- **AI Coach** — opens existing `AICoachModal`; after closing, routes to `/`.

All three paths land on `/` with the new team selected and onboarding flag retired.

---

### Visual ingredients (premium polish)
- Background: layered radial gradients in `--primary` and `--accent` HSL with subtle animated noise overlay (CSS `background-image` + `@keyframes`).
- Typography: existing `font-heading` at `text-6xl/8xl`, `tracking-[0.25em]`, uppercase. Tagline in `font-body` italic.
- Buttons: extra-large rounded-full with NBA yellow glow (`shadow-[0_0_40px_-8px_hsl(var(--accent))]`), hover lifts `translate-y-[-2px]` + shadow intensifies.
- Player photo carousel: 200px avatars in a horizontal `flex` strip, `animation: marquee 40s linear infinite`, `mask-image` fades the edges.
- Step indicator: two dots that fill yellow as the user progresses.
- Confetti burst (simple CSS, no library) on successful auto-draft.

### Files

**New**
- `src/pages/OnboardingPage.tsx` — the 3-step flow, fully self-contained.
- `src/hooks/useFirstRunGate.ts` — returns `{ shouldOnboard: boolean }` based on auth + teams + owner_id check.
- `src/components/onboarding/OnboardingHero.tsx`, `NameStep.tsx`, `DraftStep.tsx`, `PlayerMarquee.tsx` — split for readability.

**Edited**
- `src/App.tsx` — add `<Route path="/welcome" element={<RequireAuth><OnboardingPage /></RequireAuth>} />` (sits OUTSIDE `<AppLayout>` so it's full-screen).
- `src/components/auth/RequireAuth.tsx` — after auth check, also run `useFirstRunGate` and `<Navigate to="/welcome" replace />` when triggered (skip if route is already `/welcome`).
- `src/contexts/TeamContext.tsx` — expose `ownedTeams` (filtered by current user id) so the gate can detect "no owned team". Requires reading `auth.uid()`-equivalent from `AuthContext`. The `teams` returned from the edge function include `owner_id`; we just filter client-side.
- `src/integrations/supabase/types.ts` — already has `owner_id` from prior migration, no change.

### Acceptance
- Sign up brand-new account → redirected to `/welcome`. Hero shows player marquee.
- Click `Start Your Draft` → name step with random suggestion pre-filled. Click a suggestion chip → input updates. Click `next` → team is created with `owner_id = me`.
- Click `Auto-Draft` → 10-player roster appears on `/` within ~2s, $100M-compliant, captain not yet set, ready to play.
- Reload `/` → no longer redirected (team now exists and is owned).
- Sign out, sign in as a different new user → onboarding fires again for that user. Existing user's team is invisible (RLS).
- Existing users with at least one owned team never see `/welcome` (unless they manually navigate).

