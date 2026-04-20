

## Plan: Injury Report Modal + supporting edge function

### 1. New Edge Function: `nba-injury-report`
Create `supabase/functions/nba-injury-report/index.ts` based on the user's reference TS, with these adjustments:
- Add the project's standard CORS headers (matching `_shared/cors.ts` style — `Access-Control-Allow-Origin: *`, allow `authorization, apikey, content-type`).
- Keep the three scrapers (ESPN, CBS, RotoWire) running via `Promise.allSettled`.
- Keep the `deduplicate` step prioritising ESPN → CBS → RotoWire.
- Keep response payload: `{ generated_at, total_players, sources_failed?, by_team, all }`.
- Cache header `public, max-age=1800` (30 min).
- Register in `supabase/config.toml` with `verify_jwt = false` so the modal can call it with the standard anon key.

### 2. New Component: `src/components/InjuryReportModal.tsx`
Standalone modal triggered from the AI Coach Injuries tab.

**Header**
- Title "Injury Report" with shield icon.
- Right-side "Refresh" icon button (`RefreshCw`) — re-runs the fetch.
- Subtitle "Updated X min ago" computed from `generated_at`.

**Data fetching**
- On open: call `nba-injury-report` via `supabase.functions.invoke("nba-injury-report")`.
- Loading: skeleton rows with a faint NBA logo watermark (reuse `src/assets/nba-logo.svg` at low opacity).
- Error: inline error card with retry button.
- Cache result in component state; refresh button reruns.

**Player enrichment (the join step)**
- After fetch, query `players` table: `supabase.from("players").select("id, name, team, pos, fc_bc, photo")`.
- Build a `Map` keyed by `normalize(name)` (NFD strip diacritics + lowercase + trim) for robust matching.
- For each injury record, attach `{ player_id, pos, fc_bc, photo, team_tricode, on_roster }` from the map. **Position displayed comes only from `players.pos` — never from the injury source.**
- If no match: `on_roster = false`, no position rendered, name greyed out with `[Not on roster]` suffix.

**Tab structure**
- Tabs built from `by_team`. Tab labels = team **tricode** (resolved from `players.team` for matched players, else fallback to abbreviation in payload mapped through `NBA_TEAMS`).
- Sort tabs alphabetically by team full name.
- Each tab shows a small red badge with count.
- Prepend "All" tab with combined list.
- Horizontal scroll on mobile (`overflow-x-auto`).

**Player row (single line, compact)**
Layout: `[StatusBadge] [Name] [Pos] · [Injury, truncated 40ch] · [Return]  [ⓘ?]`
- **Status badge** colors:
  - Out → red (`bg-destructive`)
  - Day-To-Day → orange
  - Game-Time Decision → amber
  - Questionable → yellow
  - Probable → green
  - Rest → blue-grey (slate)
  - Personal → grey
  - Suspended → dark red (`bg-red-900`)
  - G-League / fallback → muted
- **Name**: `font-heading font-bold`. If `!on_roster` → `text-muted-foreground italic` plus `[Not on roster]` suffix.
- **Position**: small outline badge with `pos` (e.g. "PG"). Hidden when off-roster.
- **Injury**: truncated to 40 chars with ellipsis, `text-xs`.
- **Return**: formatted `MMM d` via `date-fns`. `null` → "TBD". Literal "Season-ending" rendered red.
- **Notes tooltip**: if `notes` non-empty, render `Info` icon (`lucide-react`) wrapped in shadcn `Tooltip` showing full notes.

**Empty states**
- A team tab with zero rows → centered message "No reported injuries" with `CheckCircle2` icon.
- All tabs empty → same message in All tab.

**Styling**
- `Dialog` with `max-w-3xl` on desktop, full-screen on mobile (`w-screen h-screen sm:h-auto sm:max-h-[85vh]`).
- Body scrollable: `overflow-y-auto`.
- Reuse existing design tokens (no inline hex except status colors which use Tailwind palette tokens consistent with the app).

### 3. Wire it into `AICoachModal.tsx`
- Import the new modal.
- Replace the current `handleInjury` flow on the Injuries tab: keep the yellow "SCAN INJURIES" button, but on click it now opens `InjuryReportModal` (`setInjuryModalOpen(true)`) instead of calling the old `aiInjuryMonitor` API.
- Remove the now-unused per-row injury rendering inside the Injuries TabsContent (cleaner: just the trigger button + helper text).
- Render `<InjuryReportModal open={injuryModalOpen} onOpenChange={setInjuryModalOpen} />` at the bottom of the AI Coach modal tree.

### Files to change
- **Create** `supabase/functions/nba-injury-report/index.ts`
- **Edit** `supabase/config.toml` (add function with `verify_jwt = false`)
- **Create** `src/components/InjuryReportModal.tsx`
- **Edit** `src/components/AICoachModal.tsx` (open modal from button + render it)

### Verification
- Click "SCAN INJURIES" → new modal opens with skeleton, then loads.
- Tabs show NBA tricodes alphabetically with red count badges; "All" first.
- Each row is a single line with correct color-coded status.
- Position values match `players.pos` (verified by spot-checking a known player).
- Off-roster players appear greyed with `[Not on roster]`, no position shown.
- Hovering ⓘ shows full notes.
- Refresh button re-fetches and updates "Updated X min ago".
- Mobile: modal full-screen, tabs scroll horizontally.
- Empty team → "No reported injuries" with check icon.

