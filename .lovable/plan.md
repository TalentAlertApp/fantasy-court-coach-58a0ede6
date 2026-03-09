

## Fix Deadline Timezones + Display on Schedule

### Problem
The deadline times in `deadlines.ts` are Lisbon local times stored as if they were UTC. Portugal observes DST (UTC+1) from last Sunday of March to last Sunday of October. This means ~20 entries during DST periods have incorrect UTC values.

### Affected Entries

**GW1 Days 1-5 (Oct 22-25, 2025 — Lisbon is UTC+1):** Each needs -1 hour
- Day 1: `00:00Z` → `23:00Z` (Oct 21)
- Day 2: `23:30Z` → `22:30Z`
- Day 3: `00:00Z` → `23:00Z` (Oct 23)
- Day 4: `00:00Z` → `23:00Z` (Oct 24)
- Day 5: `23:30Z` → `22:30Z`

**GW23 Day 7 (Mar 29 — DST starts):** `20:00Z` → `19:00Z`

**GW24 all 7 days (Mar 30 - Apr 5 — UTC+1):** Each needs -1 hour

**GW25 all 6 days (Apr 6-12 — UTC+1):** Each needs -1 hour

### Changes

| File | Change |
|------|--------|
| `src/lib/deadlines.ts` | Fix ~20 UTC values for DST; update `formatDeadline()` to display in `Europe/Lisbon` timezone using `Intl.DateTimeFormat` |
| `src/pages/SchedulePage.tsx` | Add deadline display below the date header: "Deadline: Mon 9 Mar 22:30" |

### formatDeadline Update

Replace manual UTC formatting with `Intl.DateTimeFormat` using `timeZone: 'Europe/Lisbon'` so displayed times always match the user's Lisbon reference:

```typescript
export function formatDeadline(utc: string): string {
  const d = new Date(utc);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return fmt.format(d);
}
```

### Schedule Page Deadline Display

Add below the existing date header row a small line showing the deadline for the selected day:

```text
Mon, Mar 9 — Day 1  [TODAY]          [Today btn]
⏰ Deadline: Mon 9 Mar 22:30
```

Uses `DEADLINES.find(d => d.gw === gw && d.day === day)` to get the deadline for the selected day, then `formatDeadline()` to display it.

