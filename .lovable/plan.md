## 1. Injury Report modal — separate close X from Refresh

`src/components/InjuryReportModal.tsx` (header at line 475)

The Radix `DialogContent` auto-renders an absolute-positioned close `X` at top-right, which overlaps the Refresh icon button. Add right padding to the `DialogHeader` inner row so the Refresh button never sits under the X.

- On the `<div className="flex items-center justify-between gap-3 flex-wrap">` row, add `pr-8 sm:pr-10`.

## 2. Ballers.IQ modal → Explain tab

`src/components/AICoachModal.tsx` (Explain tab, lines 487–559)

**a) Search input border clipped**
The Input's focus ring is being clipped because the Popover/Tabs container has tight overflow. Fix by:
- Adding `py-1` (small vertical padding) wrapper around the `<div className="flex gap-2">` row, OR
- Replacing `flex-1` Input with `flex-1 focus-visible:ring-offset-0` and giving the wrapper row `p-0.5` so the 2px ring is no longer cut.

Use the second approach (minimal change): wrap the Input row with a `p-px` container and add `focus-visible:ring-offset-0` to the Input.

**b) Remove border from "Recently explained" button**
- Change the history `<Button>` from `variant="outline"` to `variant="ghost"` (line 513).

## 3. /scoring — inline tab strip with league selector

`src/pages/ScoringPage.tsx` (lines 161–233)

Currently the layout is:
```text
[ Header ]
[ FantasyLeagueSelector (full width) ]
[ Tabs ............. Team selector ]
```

Change to a single row so the area below gains vertical space:
```text
[ Header ]
[ League selector | Tabs (LEAGUE / YOUR TEAM / TX PULSE) | Team selector ]
```

Implementation:
- Wrap `FantasyLeagueSelector` and the existing tab-bar row in one `flex items-center gap-3 flex-wrap` container.
- Constrain `FantasyLeagueSelector` to its natural/min width (it likely already accepts width via internal Select); ensure it doesn't stretch to full width — wrap it in `<div className="shrink-0">`.
- Keep `TabsList` at `max-w-xl` but drop `w-full` so it sits next to the league selector.
- Keep the team selector with `ml-auto` so it pins right when `tab === "team"`.
- Remove the now-redundant outer wrapper / gap so the vertical stack is one row tighter.

If `FantasyLeagueSelector` internally renders as block/full-width, pass/add a `className` prop or wrap so it behaves as inline-flex. (Confirm by reading the component before editing; adjust the wrapper there only if necessary.)

## 4. /advanced — FC red, BC yellow toggle styling

`src/components/advanced/TrendingTab.tsx` (lines 168–180) and
`src/components/advanced/AdvancedStatsTab.tsx` (analogous block around line 182)

Replace the single active class with a per-value active style matching the table badges:

```tsx
const activeCls =
  f === "FC" ? "bg-destructive text-destructive-foreground"
: f === "BC" ? "bg-[hsl(var(--nba-yellow))] text-black"
:              "bg-primary text-primary-foreground";
className={`px-2.5 py-1 text-[11px] font-heading font-bold transition-colors ${
  fcBc === f ? activeCls : "text-muted-foreground hover:bg-muted"
}`}
```

Apply the same change in both tabs so the FC/BC toggles match the table color language (FC=red, BC=yellow, ALL=neutral/primary).

## Out of scope

- No logic, data, or backend changes.
- No changes to scoring formulas, table rendering, or filter behavior.
- No new dependencies.
