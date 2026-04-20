

## Plan: TOTW salary pill + Schedule header re-layout + venue name & background on game cards

### 1. Team of the Week modal — show actual salary value on the pill
File: `src/components/TeamOfTheWeekModal.tsx`

The pill currently renders `${player.salary}` but in the screenshot only the `$` icon-like glyph is visible because the salary number is being clipped / mis-rendered. Fix:

- Make the salary pill wider and explicit: `min-w-fit`, drop fixed `h-4`, use `h-5 px-2 gap-1` and render two spans: a small `$` glyph and the numeric value (`{player.salary.toFixed(1)}M`).
- Ensure the hook returns a real number — confirm `useTeamOfTheWeek.ts` sets `salary: Number(p.salary) || 0`. Also format with one decimal so values like `12.5` read as `$12.5M`.
- Final pill markup:
  ```tsx
  <span className="rounded-md bg-card/90 border border-border/40 px-2 h-5 inline-flex items-center gap-0.5 text-[11px] font-mono font-bold text-foreground shadow-md">
    <span className="text-[hsl(var(--nba-yellow))]">$</span>{player.salary.toFixed(1)}M
  </span>
  ```
- Same change applied to the FC/BC badge row so it stays visually balanced (`h-5` + `px-2` to match the pill).

### 2. `/schedule` — move TOTW / Players-of-the-Day buttons to the same row as Last Played / Today, centered
File: `src/pages/SchedulePage.tsx`

Today, the TOTW + POTD buttons sit on a separate row below the date header. The user wants them inline with Last Played and Today, centered.

Change the `Date header + Deadline + Buttons` block layout into a 3-zone flex bar:

```
[ DATE · Day · TODAY · Deadline · Grid ]   [ TOTW | POTD ]   [ Last Played · Today ]
       left (start)                            center                  right (end)
```

- Restructure the wrapper from a 2-column `flex justify-between` to a `flex items-center` with:
  - Left zone: existing date / deadline / grid icon group (unchanged), `flex-1`.
  - Center zone: the two TOTW + POTD buttons currently rendered below; absolutely centered using `absolute left-1/2 -translate-x-1/2` inside a `relative` parent so they stay perfectly centered regardless of left/right zone width. Keep the `|` divider between them.
  - Right zone: existing Last Played + Today buttons, `flex-1 justify-end`.
- Delete the now-empty second row (`<div className="flex items-center gap-2 mt-2">…</div>`).
- On narrow viewports (`md:` and below) drop the absolute centering and let the 3 zones wrap naturally (`flex-wrap gap-y-2 justify-center`) so nothing collides on mobile.

### 3. `/schedule` game cards — venue name (italic, centered) + arena image background
File: `src/components/ScheduleList.tsx` plus a new file `src/lib/nba-venues.ts`.

#### 3a. New venue metadata module
Create `src/lib/nba-venues.ts` exporting:
```ts
export interface VenueMeta { name: string; image: string; }
export const NBA_VENUES: Record<string, VenueMeta> = {
  ATL: { name: "State Farm Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/State_Farm_Arena_-_Atlanta_GA.jpg/1200px-State_Farm_Arena_-_Atlanta_GA.jpg" },
  BOS: { name: "TD Garden", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/TD_Garden_concourse.jpg/1200px-TD_Garden_concourse.jpg" },
  // …all 30 teams (CLE → "Rocket Arena", LAL → "Crypto.com Arena", etc.)
};
export function getVenue(tricode: string): VenueMeta | null { return NBA_VENUES[tricode] ?? null; }
```
All 30 tricodes will be filled with the official current arena name + a Wikimedia-hosted image URL. We use Wikimedia (CC-licensed, hot-link allowed) so we don't ship any binary assets.

#### 3b. Add venue name + background image to the game card row
Inside `ScheduleList.tsx`, in the row currently rendered by `<CollapsibleTrigger asChild>` (lines ~644-727):

- Wrap the row's existing `bg-card rounded-xl border …` div with `relative overflow-hidden` and add a background `<img>` layer:
  ```tsx
  {venue?.image && (
    <img
      src={venue.image}
      alt=""
      aria-hidden
      className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.07] dark:opacity-[0.12]"
    />
  )}
  <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-card pointer-events-none" />
  ```
  This keeps text readable in dark theme while the arena photo bleeds through.
- Add `relative z-10` to the row's content children so they sit above the photo + gradient.
- In the existing center status column (the `@ / FINAL / tipoff` block), add a third line below the tipoff:
  ```tsx
  {venue?.name && (
    <span className="mt-0.5 text-[10px] italic text-muted-foreground/80 truncate max-w-[140px]" title={venue.name}>
      {venue.name}
    </span>
  )}
  ```
  - Italic (`italic`), centered (already inside the `flex flex-col items-center` column), small and muted so it never competes with the score.
  - `truncate` + `max-w` keeps long names like "Smoothie King Center" tidy.
- Compute `const venue = getVenue(g.home_team)` once per game (home team's arena, since basketball games are hosted by the home team).

#### 3c. Edge cases
- If `getVenue` returns `null` (unknown tricode), no background image and no italic line — graceful degradation.
- Background image uses lazy loading (`loading="lazy"`) so off-screen rows stay cheap.

### Files touched
- `src/components/TeamOfTheWeekModal.tsx` — salary pill formatting (`$X.XM`, wider).
- `src/pages/SchedulePage.tsx` — re-layout the date header into 3 zones with TOTW/POTD centered.
- `src/lib/nba-venues.ts` — new file with 30-team venue + image map.
- `src/components/ScheduleList.tsx` — venue background image + italic venue name in game cards.

### Verification
- Open `/schedule` → click the medal → TOTW modal: each player pill now reads `$<salary>M` (e.g. `$12.5M`) instead of just a `$` glyph.
- `/schedule` header: TOTW and Players-of-the-Day buttons appear inline with Last Played / Today, perfectly centered between them on desktop, wrapping cleanly on mobile.
- Each game card shows the home arena name in small italic text centered between the team scores (e.g. CLE @ home → "Rocket Arena"), and a faint arena photo bleeds in as the row background while the team names, scores, and action icons remain fully legible in dark theme.

