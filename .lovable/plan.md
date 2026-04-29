# Plan — /advanced premium polish + Welcome Back Continue + URL param fixes

## 1. Fix NBAPlayDB URL params (bug)

`src/pages/AdvancedPage.tsx` (`handleActionOpen`):
- Replace `params.set("isaftertimeout", "true")` with `params.set("isATO", "true")`.
- Replace `params.set("isbuzzerbeater", "true")` with `params.set("isBuzzerBeater", "true")`.
- These are the exact param keys NBAPlayDB expects (case-sensitive).

The `+` vs `%20` encoding difference in the example URLs is normal `URLSearchParams` behavior and is accepted server-side — no change needed there.

## 2. NBA Play Search "Reset filters" action

In the Player Action tab toolbar (`src/pages/AdvancedPage.tsx`):
- Replace the existing tiny ghost "Clear" with a clearer **Reset filters** button: outline variant, `RotateCcw` icon, label "Reset filters", always enabled when any of `actionPlayer`, `actionTypes`, or any non-empty `subFilters` field is set.
- Resets `actionPlayer`, `actionTypes`, and `subFilters` to `EMPTY_SUBFILTERS` in one click.
- Place it inline at the right of the action row, separated by a subtle vertical divider so it's visually distinct from the primary "Open Plays on NBAPlayDB" CTA.

## 3. Premium /advanced page styling

Goal: align all 4 tabs with the row-based premium layout already used by the Trends/Trade Report cards, with consistent **blue/red section headers** and **yellow active-tab accents**.

### Tabs bar (`AdvancedPage.tsx`)
- Wrap `TabsList` in a sticky-feel container with subtle border + backdrop blur.
- Active tab: yellow underline accent + bold heading text (no bg fill). Inactive: muted.
  - Use `data-[state=active]:border-b-2 data-[state=active]:border-[hsl(var(--nba-yellow))] data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent` and remove the rounded grid pill look.
- Add a small section-eyebrow below the tabs ("Advanced · NBA insights") for editorial feel.

### Section headers (consistent across tabs)
Every panel inside Advanced gets the same header pattern as `TrendTable`:
- Left band: colored icon + heading.
- **Blue band** (`bg-primary/10 border-b border-primary/20`, blue icon) for neutral/primary panels: NBA Play Search, Advanced Stats leaders, Trending leaders.
- **Red band** (`bg-destructive/10 border-b border-destructive/20`, red icon) for negative-direction panels: Decreased Playing Time, Cold Snap, Most Waived (in Trending).
- **Green band** stays for Increased Playing Time / hot streaks.
- Right side of each header: small meta chip (e.g. "Through {date}", "Last 5 GP") in muted mono.

Apply the new header style by:
- Updating the inline header in `NBAPlaySearchSection` to use the blue band style.
- Updating headers inside `AdvancedStatsTab.tsx`, `TrendingTab.tsx`, `LeaderTable.tsx`/`RotatingLeaderCard.tsx` to share a small `<SectionHeader />` helper. New file: `src/components/advanced/SectionHeader.tsx` — props: `tone: "blue"|"red"|"green"|"yellow"`, `icon`, `title`, `meta?`.

### Card body
- All panels: `border border-border rounded-lg overflow-hidden bg-card/40 backdrop-blur-sm`.
- Row hover: `hover:bg-accent/30` (already used in Trends — propagate to all leaderboard rows).
- Yellow accent for active-state UI inside panels (selected chips in PlaySubFilters, primary metric values in leaders) using `text-[hsl(var(--nba-yellow))]`.

### Specific panel touch-ups
- `NBAPlaySearchSection` body padding bumped to `p-5`, sub-tabs (Player Action / By Game) styled with the same yellow underline accent (transparent bg).
- `RotatingLeaderCard.tsx` / `LeaderTable.tsx`: header band gets blue tone; tone switches to red for negative-delta categories.
- `TrendingTab.tsx`: each leader block uses `SectionHeader` with the appropriate tone (blue for V5/FP5, red for Cold Snap, green for hot streaks).

## 4. Welcome Back "Continue" button → return to last /advanced tab

### Persist last advanced tab
- New helper `src/lib/advanced-tab-store.ts` with `getLastAdvancedTab()` / `setLastAdvancedTab(tab)` backed by `localStorage` (key `nbaf:lastAdvancedTab`).
- In `AdvancedPage.tsx`: use the store as initial value for the Tabs `value` (controlled), and call setter on `onValueChange`.

### Welcome Back hero CTA
- `src/components/welcome-back/WelcomeBackHero.tsx`: keep the existing "Enter Court" CTA but add a **Continue** button next to it that navigates back to the user's last viewed advanced tab.
  - Continue is shown only when `getLastAdvancedTab()` returns a value.
  - Button label: "Continue · {Tab Label}" (e.g. "Continue · NBA Play Search").
  - Click handler:
    1. Calls the same session-cleanup as `onEnter` (mark seen, clear last sign-out).
    2. Navigates to `/advanced` (the page reads the stored tab on mount).
- Update `WelcomeBackHero` props: add optional `onContinue?: (tab: string) => void`. Wire it from `RequireAuth.tsx` to `navigate("/advanced")` after the same cleanup as `onEnter`.

### RequireAuth wiring
- `src/components/auth/RequireAuth.tsx`: pass `onContinue` that performs the same `markWelcomeBackSeenThisSession()` + `clearLastSignOut(user.id)` + `setWelcomeOpen(false)` and then `navigate("/advanced")`.

## Files touched

- edit `src/pages/AdvancedPage.tsx` — URL param fix, Reset filters button, controlled tabs + persistence, premium tab styling, header tones.
- edit `src/components/advanced/AdvancedStatsTab.tsx` — use `SectionHeader`, blue/red tones.
- edit `src/components/advanced/TrendingTab.tsx` — same.
- edit `src/components/advanced/LeaderTable.tsx` and `RotatingLeaderCard.tsx` — adopt `SectionHeader`, yellow accents on key metrics.
- new  `src/components/advanced/SectionHeader.tsx` — shared band header.
- new  `src/lib/advanced-tab-store.ts` — last-tab persistence.
- edit `src/components/welcome-back/WelcomeBackHero.tsx` — add Continue CTA.
- edit `src/components/auth/RequireAuth.tsx` — pass `onContinue` handler.

No backend or schema changes. No new dependencies.
