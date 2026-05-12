
## Goal
When the user is watching the Game Recap video inside `GameDetailModal`, let them toggle two player-scoring tables (away on the left, home on the right) that animate out from behind the video and back in when closed.

## Scope
Single file: `src/components/GameDetailModal.tsx`. No backend, no schema, no new components — `GameBoxScoreTable` already supports a `filterTeam` prop and a height override (`maxBodyHeightClass`), which is exactly what we need.

## UX behavior
1. New state `panelsOpen` (default `false`), only meaningful when `recapOpen === true`.
2. New header icon button placed in the action row (next to BoxScore / Charts / PbP / NBA), visible **only while the recap is playing**. Context-sensitive, no container/border — just an icon button (using `PanelLeftOpen` / `PanelRightOpen` style or `Columns2` from lucide-react), with a subtle hover scale and color change to match the existing "Watch Recap" toggle styling (no pill background).
3. Clicking the icon toggles `panelsOpen`. The icon swaps to a "close" variant when open (e.g. `Columns2` ↔ `X`), and `aria-pressed` reflects state.
4. While `recapOpen && panelsOpen`, the modal becomes wider (`max-w-6xl`) and the recap area becomes a 3-column grid:
   - Left column: `GameBoxScoreTable` filtered to `away_team`
   - Center column: existing video iframe (unchanged size logic, fixed minHeight)
   - Right column: `GameBoxScoreTable` filtered to `home_team`
   Both tables use `maxBodyHeightClass` matching the video height so the three blocks share the exact same vertical extent.
5. While `recapOpen && !panelsOpen`, layout is exactly today's centered video.
6. When the recap is closed, `panelsOpen` is reset to `false` so reopening the recap starts collapsed.

## Slide-from-behind animation
Wrap the recap area in `relative overflow-hidden`. The two side tables are absolutely positioned behind the video (`z-0`), the video sits on top (`z-10`). The tables are translated horizontally off-screen behind the video when closed and slide outward when opened:
- Left table: `transition-transform duration-500 ease-out` with `translate-x-0` when open, `translate-x-full` (toward center, behind video) when closed; matching `opacity` fade.
- Right table: mirrored with `-translate-x-full` → `translate-x-0`.
- Video keeps its central column width when panels are open (CSS grid `[280px_1fr_280px]` on md+, collapsing to single column on small screens where panels stay closed).

To keep the "behind the video" illusion, the side tables are rendered *outside* the central video column but their initial `translate` keeps them tucked under the video edge before sliding outward; closing reverses the transform so they appear to retract behind it.

## Implementation outline
1. Add `panelsOpen` state and reset effect:
   ```ts
   const [panelsOpen, setPanelsOpen] = useState(false);
   useEffect(() => { if (!recapOpen) setPanelsOpen(false); }, [recapOpen]);
   ```
2. Add icon button in the existing action-row (only when `recapOpen && embedSrc`):
   ```tsx
   <button onClick={() => setPanelsOpen(v => !v)} aria-pressed={panelsOpen}
     className="text-muted-foreground hover:text-primary transition-transform hover:scale-110">
     {panelsOpen ? <X .../> : <Columns2 .../>}
   </button>
   ```
3. Replace the current recap render block with a layout that conditionally splits into 3 columns and renders the side tables wrapped in animated containers. Use `embedHeight` (already tracked) to set both `minHeight` for the iframe wrapper and a matching `style={{ maxHeight: embedHeight }}` on each side table's scroll body via inline style override (passing a custom `maxBodyHeightClass` like `max-h-none` and constraining the parent).
4. Widen the dialog when panels are open: switch `max-w-2xl` → `max-w-6xl` only when `played && recapOpen && panelsOpen`.
5. Filter the side tables by team using existing `filterTeam` prop on `GameBoxScoreTable`, passing a no-op `setFilterTeam` so the team can't be unselected by the user.

## Out of scope
- No edits to `GameBoxScoreTable` internals (it already supports `filterTeam` + height override).
- No mobile-specific layout — on narrow viewports, the side panels collapse and the icon still works but tables stack below the video. (If the user wants strict mobile behavior, we can refine after.)
- No changes to the inline boxscore that shows when the recap is closed.

## Verification
- Open a played game → click "Watch Recap" → confirm new icon appears in the action row.
- Click icon → side tables slide outward from behind the video; both tables match video height.
- Click icon again → tables retract behind the video.
- Close recap → reopen → panels start closed.
