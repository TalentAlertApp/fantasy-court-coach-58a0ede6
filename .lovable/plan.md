## 1) Game Played modal — consistent vertical height

**File:** `src/components/GameDetailModal.tsx`

The box-score-only state (`played && !recapOpen && !biqStandalone`) renders the table at its natural height, while the recap and BIQ states lock to `embedHeight` (≥420px). When the table is shorter, the modal "shrinks" between states.

**Fix:** apply `style={{ minHeight: embedHeight }}` to the box-score-only container (the grid wrapper around `tableWrapRef`) so all three states share the same minimum height. The internal `tableWrapRef` keeps measuring natural height for the recap calculation, but the surrounding container is pinned.

## 2) BallersIQ button — light-theme readability

**File:** `src/components/GameDetailModal.tsx` (`BallersIQButton`)

Current classes use `bg-black/40` + amber tones that vanish on light backgrounds; the wordmark is also force-themed `dark`.

**Fix:** rebuild both states using semantic-friendly contrast that works in both themes:
- OFF: solid amber tint background (`bg-amber-500/15 dark:bg-black/40`), darker amber text in light (`text-amber-700 dark:text-amber-200/85`), stronger border (`border-amber-500/60`).
- ON (Live): filled amber chip (`bg-amber-500 text-black dark:bg-amber-400/20 dark:text-amber-100`) with subtle glow preserved in dark only.
- Drop `forceTheme="dark"` on the wordmark when in light mode so the logo recolors properly (use `forceTheme={undefined}` or rely on default).

## 3) Ballers.IQ Market Watch — remove Quick Actions card

**File:** `src/components/ballers-iq/MarketWatchStudio.tsx` (lines 548–568)

Delete the entire bottom `GlassPanel` "Quick Actions" block. Drop unused imports (`Target`, `ArrowLeftRight`, `BarChart3`, `Crown`, `Heart`) if no longer referenced after removal.

## 4) EuroLeague Game modal — player photo face crop

**File:** `src/components/game/GameBoxScoreTable.tsx` (line 184)

`AvatarImage` defaults to `object-cover object-center`, so faces sit too high (same issue fixed elsewhere). Add `className="object-cover object-[center_15%]"` to `<AvatarImage>` to match the crop used in `PlayerRow` / My Roster.

## Notes

- Only frontend/presentation edits.
- No business-logic or data changes.
- No new files.
