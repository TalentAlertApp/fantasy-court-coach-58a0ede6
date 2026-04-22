

## Four targeted fixes + a new "Welcome Back" recap screen

### 1. PICK PLAYER team dropdown — tighten layout
File: `src/components/PlayerPickerDialog.tsx`

- Move the 3-letter tricode label from `ml-7` → sits **immediately after** the watermark (left-aligned, ~28px from start). Restructure the `SelectItem` content so the tricode + count uses `pl-8` (just clears the now-tighter watermark) instead of `ml-7`.
- Shrink the watermark from `h-10 w-10 -left-2` → `h-8 w-8 -left-1` so it doesn't dominate the now-narrower row.
- Reduce the dropdown width: change the grid template from `grid-cols-[1fr_140px]` → `grid-cols-[1fr_110px]`, and update the `SelectTrigger` text so "All Teams" still fits (`text-[11px]`).
- `SelectContent` width follows the trigger automatically; no extra change needed.

### 2. Roster Schedule panel — overlay instead of pushing layout
File: `src/pages/RosterPage.tsx`

Currently the `<Collapsible>` between the toolbar and the court pushes the Starting 5 / Bench down when opened. Convert it to an **absolutely positioned overlay**:

- Wrap the page body in `relative` (already implied by `h-full flex flex-col`).
- Replace the inline `<Collapsible>` block (lines ~533-537) with an absolute panel:
  - `absolute left-0 right-0 top-[~145px] z-30` (positioned just under the toolbar row).
  - `bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl` for premium feel.
  - Smooth open via `data-[state=open]:animate-accordion-down` (already in tailwind config) or a simple `max-h` transition.
  - Closed by default; clicking the SCHEDULE button toggles `scheduleOpen`.
  - Add a small close X in the top-right of the overlay for explicit dismissal.
- The court layout stays fixed in place; only the overlay floats over the toolbar+court area.

### 3. SchedulePreview — default to current day for the selected GW
File: `src/components/SchedulePreviewPanel.tsx`

The current `useEffect` only switches day if the current `day` isn't in `daysWithGames`, falling back to the **first** available day. Two issues:
- When the user changes GW, `day` stays stuck on the previously selected one.
- "Current day" is only resolved once at mount.

Fix:
- Recompute the desired default day whenever `gw` changes:
  - If `gw === initial.gw` → target = `initial.day` (today's day in the current GW).
  - Else → target = `1` (first day of any other selected GW).
- After `daysWithGames` resolves, snap `day` to: `target` if present, else the closest day ≥ `target`, else the first available.
- Track GW changes with a ref so we only re-snap on GW transitions or when `daysWithGames` first arrives — never when the user manually clicks a chip.

### 4. "Welcome Back" recap screen — premium full-screen takeover
New file: `src/components/welcome-back/WelcomeBackHero.tsx`
New file: `src/lib/welcome-back-store.ts`
Edit: `src/App.tsx` (mount the gate), `src/contexts/AuthContext.tsx` (record sign-out timestamp).

**Trigger logic** (`welcome-back-store.ts`):
- On `signOut`, persist `localStorage["nba_last_signout:{userId}"] = ISO timestamp`.
- On next successful sign-in for the **same user**, if a previous timestamp exists AND it's > 1 hour ago AND not yet shown this session, render the recap once. After dismissal, write `sessionStorage["nba_welcome_back_seen"] = "1"` and clear the signout timestamp.
- Skip entirely for first-time users (no prior signout entry → it's their first session) and for users in onboarding (`useFirstRunGate.shouldOnboard === true`).

**Mount point**: gate inside `RequireAuth`'s authenticated branch (or a new `<WelcomeBackGate>` wrapping `AppLayout` route element). Renders **full-screen**, identical chrome to onboarding (no sidebar, no header) — same `h-screen w-full bg-background` shell with the radial-gradient + grid backdrop used in `OnboardingPage`.

**Layout** (matches onboarding stages 1 & 2):
- Top bar: NBA logo + "Fantasy" wordmark left, sign-out icon right (mirrors `OnboardingHero`).
- Hero center: `text-[11px] uppercase tracking-[0.4em] text-accent` eyebrow saying "Welcome back" with the team name; large `font-heading uppercase` headline "Here's what you missed".
- Below the headline: a **3-card recap strip** (`grid grid-cols-3 gap-5 max-w-5xl`) — each card is `bg-card/40 border border-border rounded-2xl p-6 backdrop-blur` with an icon, value, and caption:
  1. **Roster pulse** — show top scorer from current roster's last 5 games (resolve from `useRosterQuery` + `last5.fp5`). Card shows player photo (circular, 64px), name, "FP last 5: {value}".
  2. **Captain check** — current captain name + their FP5; if no captain set, show "No captain locked yet — set one before deadline".
  3. **Next deadline** — `getCurrentGameday()` GW · Day, formatted deadline, live countdown. Tinted with NBA-yellow accent.
- Below the cards: a **"What's new" bullet list** of 3-4 hard-coded curated items (premium, sports-editorial copy):
  - "AI Coach now ignores diacritics in player search."
  - "Pick Player modal: schedule preview + team filter with badge watermarks."
  - "Roster: in-place schedule overlay, no more layout jumps."
  - "Wishlist & Player Comparison improvements."
  Items rendered as small chips with a `Sparkles` icon — same `border border-[hsl(var(--nba-yellow))] bg-[hsl(var(--nba-yellow))]/10` styling as the onboarding chip strip at the bottom.
- Primary CTA: `Button size="lg"` "Enter Court →" with the same shadow/glow treatment as `OnboardingHero`'s "Start Your Draft" button. Click → dismiss + navigate to `/`.
- Secondary text link below: "Tour what's changed" — opens the existing How-to-Play / Guide modal.
- Same animated `PlayerMarquee` background as onboarding so it feels visually continuous.

**Premium polish**:
- Subtle `framer-motion` stagger entry on the eyebrow → headline → cards → chips → CTA (200ms cascade).
- Card hover: `hover:border-accent/40 transition-colors`.
- Time-since-last-visit micro line under the eyebrow: "Last visit: 3 days ago" (computed from the stored timestamp via a small `formatDistanceToNow` helper — no new dependency, write inline).

### Files touched
- `src/components/PlayerPickerDialog.tsx` — dropdown layout (item 1).
- `src/pages/RosterPage.tsx` — convert schedule panel to absolute overlay (item 2).
- `src/components/SchedulePreviewPanel.tsx` — day default logic (item 3).
- `src/contexts/AuthContext.tsx` — write sign-out timestamp (item 4).
- `src/lib/welcome-back-store.ts` — NEW, storage helpers (item 4).
- `src/components/welcome-back/WelcomeBackHero.tsx` — NEW, full-screen recap UI (item 4).
- `src/components/auth/RequireAuth.tsx` — mount the gate before children (item 4).

### Outcome
- Tighter, cleaner team dropdown with the tricode reading immediately after the badge.
- Schedule overlay floats over the roster — Starting 5 / Bench never shift.
- Day chips always land on today (when viewing the current GW) or D1 (when browsing ahead).
- Returning users get a one-time premium "what's new + roster pulse" hero that visually matches onboarding stages 1 & 2 — full-screen, no sidebar, marquee-backed.

