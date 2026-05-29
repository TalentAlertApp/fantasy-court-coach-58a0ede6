# Plan — 4 UI consistency fixes

## 1. Undo the modal "Logo Splash"
Restore Team of the Week and Court Show modals to how they were before the splash was added.
- `src/components/TeamOfTheWeekModal.tsx`: remove the `LogoSplash` import and the `<LogoSplash open={open} league={league} />` line.
- `src/components/court-show/CourtShowModal.tsx`: remove the `LogoSplash` import and its usage.
- Delete `src/components/brand/LogoSplash.tsx` (no longer referenced).

## 2. Sidebar divider above Player Search
Currently `mx-4 my-1 h-px` with a `0.45`-opacity gradient — it reads too strong and is narrower than the search box (which sits in a `px-3` container).
- In `src/components/layout/AppLayout.tsx` (the expanded branch, line ~204): change `mx-4` → `mx-3` so its width matches the Player Search box exactly, and drop the gradient opacity from `0.45` → `0.22` so it appears as a far fainter, thinner hairline.

## 3. /schedule — HoopsFantasy logo watermark at far left
The user-team league logo already sits as a watermark at the top-right of the week-strip header (`-top-6 -right-6 h-40 w-40 opacity-[0.08] rotate-6` with hover surge). Mirror it on the left with the HF logo.
- In `src/pages/SchedulePage.tsx`, inside the same `group` header (next to the existing league-logo `<img>`), add a second `<img src={getHoopsFantasyLogo(league)}>` using identical sizing/opacity/effects but mirrored: `-top-6 -left-6 ... -rotate-6 group-hover:opacity-[0.22] group-hover:scale-110 group-hover:rotate-0`.
- Import `getHoopsFantasyLogo` from `@/lib/hoopsfantasy-brand`.

## 4. Header consistency across /scoring, /transactions, /teams, /leagues
Adopt the clean `/advanced` pattern: a small centered caption line over a full-width, underline-style tab bar (bottom border on the row, active tab marked by a yellow underline). Each page keeps its own tabs and content — only the header chrome changes.

Reference (`/advanced`):
```text
            ADVANCED · WNBA INSIGHTS          (centered, tiny, wide tracking)
 ──────────────────────────────────────────
  PLAY SEARCH   FANTASY POINTS   ADV STATS   [TRENDING]   (underline tabs)
```

Create a small shared presentational component `src/components/layout/PageHeaderTabs.tsx` that renders:
- the centered caption (`text-[10px] font-heading uppercase tracking-[0.4em] text-muted-foreground`), and
- a full-width `TabsList` styled exactly like Advanced (transparent list, bottom border row, `data-[state=active]` yellow underline).

Then apply per page:
- **/teams** (`TeamsPage.tsx`): replace the inline `h1 + pill tabs` row with the caption (e.g. "WNBA · TEAMS") + the underline tab bar for Teams / Standings / Stats. Keep the sort button and (Standings) division filter aligned to the right of the bar; keep all tab content unchanged.
- **/scoring** (`ScoringPage.tsx`): keep the existing premium gradient title bar but swap the boxed pill `TabsList` for the underline tab bar (League / Your Team / Tx Pulse). Keep the Fantasy-league selector and the per-tab team selector. Content unchanged.
- **/leagues** (`LeaguesPage.tsx`): convert the Mine / Discover pill tabs to the underline tab bar and add the centered caption ("LEAGUES · MINE & DISCOVER"). Keep the sticky header, the Join/Create buttons, and both tabs' content.
- **/transactions** (`PlayersPage.tsx`): this page has no tabs (single trade workbench). Apply only the caption line ("TRANSACTIONS · TRADE CENTER") for visual consistency and keep the existing toolbar (Roster / Schedule / Ballers.IQ / chips). No tab bar is added since there are no tabs.

### Technical notes
- All changes are presentation-only — no data, hooks, routing, or business logic touched.
- Reuse existing semantic tokens (`--nba-yellow`, `border-border`, `text-muted-foreground`) and the existing `Tabs`/`TabsList`/`TabsTrigger` primitives; no new CSS variables.
- The shared `PageHeaderTabs` keeps the four pages visually in sync and avoids duplicating the Advanced markup.
