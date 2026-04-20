

## Plan: 4 fixes across AI Coach + Roster info display

### 1. AI Coach Explain — autocomplete dropdown still empty (server cap)
**Root cause (new):** `supabase/functions/players-list/index.ts` line 46 hard-caps the request limit at 500:
```ts
const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);
```
So even though the modal already asks for `limit: 1000`, the server only returns the top 500 by salary. Paul George (and any player outside the top-500 salary bucket) is silently dropped, which is why typing "Paul Ge" produces zero suggestions.

**Fix:**
- Raise the server cap in `players-list` from 500 → 2000 (covers the full 592-player roster with headroom).
- Keep the client request at `limit: 1000`.
- Add a tiny defensive guard in `AICoachModal`: when the user types, also reset `selectedExplainPlayer` and force `setShowDropdown(true)` so the dropdown re-opens after a previous selection.

### 2. Richer autocomplete cards — team logo + FP5 + recent-explained chips
In `src/components/AICoachModal.tsx`, autocomplete row redesign:
- Add a small **team logo (w-5 h-5)** next to the team full name (next to the existing watermark, not replacing it).
- Add the player's **FP5** value as a right-aligned mono badge on each row (`{p.last5.fp5.toFixed(1)} FP5`).
- Keep photo, name, FC/BC badge, and team watermark from the current row.

**"Recent 5" Explained players:**
- Persist the last 5 successfully-explained players in `localStorage` under `nbaf:ai-explain-recent` (array of `{ id, name, team, photo, fc_bc }`, max 5, most-recent first, deduped).
- When the Explain tab opens with no search text and no result, render a **"Recent" strip** of up to 5 small chips (photo + last name) above the search input. Clicking a chip selects that player and immediately runs `handleExplain`.
- Update on each successful explain (push to front, dedupe, slice 5).

### 3. Roster Sidebar — Bank Remaining color states
In `src/components/RosterSidebar.tsx`, replace the plain `InfoRow` for Bank Remaining with a colored value:
- `bank > 0` → bold **green** (`text-green-500 font-bold`)
- `bank === 0` → bold **yellow** (`text-[hsl(var(--nba-yellow))] font-bold`)
- `bank < 0` → bold **red** (`text-destructive font-bold`) **plus** a small inline warning line below: "Over budget — adjust roster to bring bank to 0 or higher" (only shown when negative).
- Keep the existing wallet icon and label; only the value (and the warning line) change.

### 4. Roster cards — Salary/Value styling & font alignment with /transactions
Reference style (from `src/components/PlayerRow.tsx` line 64-66) used on `/transactions`:
```tsx
<TableCell className="text-right font-mono text-sm">${core.salary}</TableCell>
```
Plain `font-mono text-sm`, neutral foreground color, **no** drop-shadow, **no** dark blue.

In `src/components/PlayerCard.tsx`:

**Court variant (lines 213-225):** Wrap Salary and Value in their own light pill containers (matching the FC/BC badge shape — `rounded-md bg-card/80 border border-border/40 px-1.5 py-0 h-4`), and replace the current text styling with `font-mono text-xs text-foreground` so it matches `/transactions`. Drop the `text-[#1e3a5f]` blue and the `drop-shadow-[...]` glow.

**Bench variant (lines 116-122):** Same treatment — wrap `${core.salary}` and `{v5}` in matching light pills with `font-mono` neutral text instead of muted-foreground inline text. Keep the size compact (`text-[10px]`).

This affects every PlayerCard rendered across the roster screen (Starting 5 court + Bench), so Salary/Value visually align with the `/transactions` table while keeping FC/BC pill geometry consistent.

### Files touched
- `supabase/functions/players-list/index.ts` — raise server-side `limit` cap from 500 → 2000.
- `src/components/AICoachModal.tsx` — autocomplete reset/show fix; team logo + FP5 in rows; Recent 5 chips with localStorage persistence.
- `src/components/RosterSidebar.tsx` — color-coded Bank Remaining + over-budget warning.
- `src/components/PlayerCard.tsx` — light pill containers and `font-mono` for Salary / Value in court & bench variants.

### Verification
- AI Coach → Explain: typing "Pa" or "Paul Ge" lists Paul George (and other Pauls) with team logos and FP5 visible.
- Selecting a player and pressing Explain succeeds, then the player appears in the "Recent" strip on next open.
- Roster Info: Bank shows green when positive, yellow when 0, red with warning when negative.
- My Roster: Salary and Value on every player card sit inside light pills and visually match the font/weight used in the `/transactions` table.

