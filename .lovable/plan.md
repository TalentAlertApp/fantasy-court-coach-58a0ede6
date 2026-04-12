

## Plan: Premium Layout Overhaul Across All Pages

This plan covers ~15 files across 5 major areas. All changes maintain existing functionality.

### 0. Sidebar — Move Guide icon to top

**File: `src/components/layout/AppLayout.tsx`**
- Move `HowToPlayModal` from sidebar bottom to the brand header row, aligned far-right inline with "FANTASY"
- Change `HowToPlayModal` icon from `HelpCircle` (?) to `BookOpen` (book)
- Update `src/components/HowToPlayModal.tsx` to use `BookOpen` icon and accept an optional `iconClassName` prop

### 1. Roster Page (`/`)

**File: `src/pages/RosterPage.tsx`**
- a) FC/BC badges below header: increase size from `text-[9px]` to `text-xs`, add `px-2 py-0.5` padding
- Remove `hidden sm:flex` so they always show

**File: `src/components/RosterSidebar.tsx`**
- a) Force white bold text in dark mode: add `dark:text-white dark:font-bold` to value spans and labels
- b) Make ROSTER INFO fixed at bottom of screen, aligned with sidebar: wrap in `fixed bottom-0` container with `left-[var(--sidebar-width)]` and appropriate width

**File: `src/components/RosterCourtView.tsx`**
- c) Add a "STARTING 5" header bar above the court, matching the BENCH header style (same height, bg-muted, border, icon)
- Adjust court to fill remaining vertical space: change `maxHeight: 62vh` to `calc(100vh - <header+toolbar height>)` and use `flex-1` approach
- d) Bench cards: increase player name to match starter size, shift name right so team badge fills full card height, add `hover:scale-110 transition-transform` to team badge

**File: `src/components/PlayerCard.tsx`**
- d) Court variant: increase photo from `w-14 h-14` to `w-18 h-18`, add `group-hover:scale-110 transition-transform` surge effect on photo, increase name from `text-xs` to `text-sm`, increase team badge from `w-5 h-5` to `w-7 h-7`, increase opponent badges from `w-5 h-5` to `w-6 h-6`, allow wider card width (`w-[18%]` instead of `w-[17%]`)
- f) Bench variant: increase name to `text-sm font-bold`, restructure layout so team logo gets `h-full` (fills card height), add `hover:scale-110 transition-transform` surge on team badge

### 2. Transactions Page (`/transactions`)

**File: `src/components/FiltersPanel.tsx`**
- a) Add team logo as watermark to each `SelectItem` in the TEAM dropdown: render team logo at far-right, large (`w-8 h-8 opacity-30`), with `hover:scale-110 hover:opacity-60` surge effect
- b) Add NBA logo + "FANTASY" branding fixed at bottom of the right sidebar column

**File: `src/pages/PlayersPage.tsx`**
- c) Make right sidebar column sticky/fixed, not scrolling, aligned to bottom with sidebar: use `sticky top-0 h-[calc(100vh-...)]` and `overflow-y-auto`
- d) Make central table column fill available height and scroll independently, aligned at bottom with sidebar: use `h-[calc(100vh-...)] overflow-y-auto`

### 3. Teams Page (`/teams`, tab TEAMS)

**File: `src/pages/TeamsPage.tsx`**
- Remove the centered team logo from card content
- Add team logo as centered watermark behind card content: `absolute inset-0 flex items-center justify-center` with large logo (`w-20 h-20 opacity-15`), add `group-hover:scale-125 group-hover:opacity-30 transition-all duration-500` surge
- Vertically center remaining elements (tricode, full name, W-L record, players badge)

### 4. Schedule Page (`/schedule`)

**File: `src/pages/SchedulePage.tsx`**
- a) Remove `CURRENT WEEK` badge; instead add a distinct border (`ring-2 ring-[hsl(var(--nba-yellow))]`) to the current week button, and color its number differently (`text-[hsl(var(--nba-yellow))]`) when not selected
- d) Move Grid3X3 and Trophy icons from below the week strip to inline with it, at the far-left before week buttons
- e) Make everything above game rows (week nav, day nav, date header) sticky with `sticky top-0 z-20 bg-background`

**File: `src/components/ScheduleList.tsx`**
- b) Increase team badges from `w-8 h-8` to `w-10 h-10`, add `hover:scale-110 transition-transform` surge
- c) Move SCHEDULED/FINAL status text to center of the row, remove Badge container, increase font size to `text-sm font-heading font-bold`, style the row with more premium spacing and subtle gradient background

### Files Summary

| File | Changes |
|------|---------|
| `src/components/layout/AppLayout.tsx` | Move Guide to brand row |
| `src/components/HowToPlayModal.tsx` | BookOpen icon |
| `src/pages/RosterPage.tsx` | Bigger FC/BC badges |
| `src/components/RosterSidebar.tsx` | White text dark mode, fixed bottom |
| `src/components/RosterCourtView.tsx` | Starting 5 header, fill height, bench card layout |
| `src/components/PlayerCard.tsx` | Bigger photos/names/badges with surge effects |
| `src/components/FiltersPanel.tsx` | Team logos in dropdown watermark |
| `src/pages/PlayersPage.tsx` | Sticky sidebar + table, NBA branding at bottom |
| `src/pages/TeamsPage.tsx` | Watermark logo, remove centered logo |
| `src/pages/SchedulePage.tsx` | Current week styling, move icons, sticky header |
| `src/components/ScheduleList.tsx` | Bigger badges, centered status, premium rows |
| `src/index.css` | Any supporting utility classes |

