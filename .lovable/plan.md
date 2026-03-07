

## Plan: Fix Schedule Page — Correct Default Week + Separate Selectors

### Root Cause

The schedule data IS in Supabase (254 games, weeks 21-25). The page defaults to `gw=1, day=1` which has zero rows. The edge function works correctly — it just returns no games for week 1.

### Changes

#### 1. `src/pages/SchedulePage.tsx` — New defaults + separate week/day controls

- Default to `gw=21` (current week as of 2026-03-07)
- Compute initial day from today's date using the calendar lookup, or default to day 1
- Replace the single prev/next arrows with **two separate selector pairs**:
  - **Week selector**: `- [Week 21] +` (range 21-25)
  - **Day selector**: `- [Day 3] +` (range 1-7)
- When day goes below 1 → wrap to day 7 of previous week
- When day goes above 7 → wrap to day 1 of next week

#### 2. `src/components/ScheduleList.tsx` — Remove built-in nav

- Remove the prev/next buttons and "Gameweek X · Day Y" header from ScheduleList (navigation now lives in the page)
- ScheduleList becomes a pure game list renderer

### Calendar Lookup (embedded in SchedulePage)

```typescript
const CALENDAR: Record<string, { week: number; day: number }> = {
  '2026-03-09': { week: 21, day: 1 },
  // ... through '2026-04-10': { week: 25, day: 5 }
};
```

Used to compute the default week/day from today's date. If today is before the first entry, default to week 21 day 1.

### Files Modified (2)

1. **`src/pages/SchedulePage.tsx`** — New defaults, calendar lookup, separate week/day +/- controls
2. **`src/components/ScheduleList.tsx`** — Remove navigation controls, keep game list only

