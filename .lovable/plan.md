

## Plan: Redesign InjuryReportModal — smaller watermark, team dropdown, photo + watermark on rows

### 1. Smaller NBA watermark (all states)
In `src/components/InjuryReportModal.tsx`:
- Change the background watermark `<img>` from `w-1/2 max-w-[260px] opacity-[0.04]` to `w-1/4 max-w-[140px] opacity-[0.035]`.
- Apply the same reduced size to the loading skeleton state and empty state (move the watermark wrapper so it covers all three states consistently).

### 2. Replace horizontal tab strip with `ALL | Team dropdown` header bar
Replace the current `TabsList` strip with a centered control row that spans full modal width.

**Layout (centered, full-width row, sticky under header):**
```
[ ALL (123) ] | [ Select team ▼ ]
```

- Left segment: a button-style "ALL" pill with the total count badge. Active by default.
- Divider: a thin `|` (`<span className="text-border">|</span>`).
- Right segment: a shadcn `Select` (or `Popover` + `Command` for searchability) trigger reading **"Select team"** when nothing is picked.
- Both segments sit in a flex container with `justify-center gap-3` and `w-full` padding.

**Dropdown content:**
- Built from `groups` (already sorted alphabetically by full team name).
- Each item renders: `<TeamLogo w-5 h-5> + Full team name + <Badge variant="destructive">{count}</Badge>`.
- Team logos pulled from `NBA_TEAMS` mapping by tricode (existing `tricodeFromTeamString` already used).
- Only teams with ≥1 player out are shown (already true — `groups` is built from injury data only).

**State & Tab switching:**
- Replace `Tabs` controlled state. Add `const [view, setView] = useState<"all" | string>("all")` where the string is the team tricode.
- "ALL" button → `setView("all")` and clears the Select value.
- Picking a team in the Select → `setView(tricode)`.
- Body renders `<InjuryList items={view === "all" ? enriched : groups.find(g => g.tricode === view)?.items ?? []} />`.
- Keep horizontal scroll fallback removed (no longer needed) but ensure the "ALL" button stays visible at all viewport sizes.

### 3. Player row redesign — photo + big team-logo watermark
Update `InjuryRow` in the same file:

**Row container:**
- Switch from a flat `<li>` to `<li className="relative overflow-hidden …">` so the watermark can be absolutely positioned and clipped.

**Team-logo watermark (big, vivid, hover surge):**
- Inside the row, render an absolutely positioned `<img>` of the team logo:
  - Source: lookup via `NBA_TEAMS` by `rec.team_tricode`.
  - Position: `absolute inset-0 m-auto` for centering; size `h-12 w-12` (bigger than typical row but clipped by row height).
  - Vivid by default: `opacity-30` (no greyscale).
  - Hover surge: parent gets `group` class, watermark gets `transition-all duration-300 group-hover:scale-125 group-hover:opacity-60`.
  - `pointer-events-none` and `aria-hidden`.

**Player photo (right after the OUT badge):**
- Add a small avatar between the status badge and the name:
  - `rec.photo` from the enriched record (already fetched from `players`).
  - Render `<img src={rec.photo} className="h-7 w-7 rounded-full object-cover border border-border/60 shrink-0 z-10 relative" />`.
  - If `!rec.photo` (off-roster): render a neutral fallback circle with the player's initials, dimmed.

**Stacking:**
- All existing row content (badge, photo, name, pos pill, injury text, return, info) gets `relative z-10` so they sit above the watermark.

**Spacing tweak:**
- Bump row vertical padding from `py-2` to `py-2.5` so the 28px photo doesn't crowd the line.

### Files to edit
- `src/components/InjuryReportModal.tsx` — only file that changes.

### Verification
- Open AI Coach → Injuries → Scan Injuries.
- NBA watermark is noticeably smaller (~140px) in loading, error, empty, and loaded states.
- Header now shows "ALL (123) | Select team ▼" centered, taking the modal width.
- Default view = ALL. Dropdown lists only teams with injuries, each showing logo + full name + red count.
- Picking a team switches the body to that team's rows; clicking ALL returns to the full list.
- Each row shows the OUT badge, then player photo, then name as before.
- Each row has a large, vivid team logo centered as a watermark; hovering scales it up and brightens it.
- Off-roster players still show the [Not on roster] suffix and italic name; their watermark uses `team_abbr` as fallback.

