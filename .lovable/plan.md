## 1) Block illegal Starting 5 swaps with a modal (My Roster)

The Starting 5 must always be 2FC+3BC or 3BC+2FC (already enforced server-side). Today the user can attempt a drag swap or picker swap that would break this and either silently bounce or get a toast. We'll intercept *before* the save and show a blocking modal.

**`src/pages/RosterPage.tsx`**
- Add state: `blockedSwap: { message: string } | null`.
- Helper `wouldBreakStarting5(nextStarters: PlayerListItem[]): string | null` that returns an error string when starters length is 5 and FC/BC counts aren't (2,3) or (3,2). Returns `null` when ok.
- In `handleDnDSwap`: when the swap moves a player between starters↔bench (the two cross-zone branches), compute the resulting starters list, run the check, and if it returns a message → `setBlockedSwap({ message })` and `return` before `saveMutation.mutate`. Pure within-starters or within-bench reorders are unaffected.
- In `handleSwapSelect`: when the swap target is a starter (`starterIdx >= 0`) and the incoming player's `fc_bc` differs from the outgoing one, build the resulting starters list and run the same check; block via modal if invalid.
- Render a shadcn `<AlertDialog>` (already imported) bound to `blockedSwap`, single OK button that clears state. Title: "This change is not allowed". Description: the returned message (e.g. "Starting 5 must be 2 FC + 3 BC or 3 FC + 2 BC.").

No backend changes — server validation stays as the final safety net.

## 2) Health icon = same as Injury Report trigger (Bandage)

The `/schedule` Injury Report button uses lucide `Bandage` (see `SchedulePage.tsx` line 429). The roster health badge currently uses `Shield`.

**`src/components/health/HealthStatusIcon.tsx`**
- Replace `import { Shield } from "lucide-react"` with `import { Bandage } from "lucide-react"`.
- Replace `const Icon = Shield` with `const Icon = Bandage`.
- Keep the existing status→color mapping (OUT red, DTD orange, GTD amber, Q yellow, PROB green) so the icon still reads "type of injury" through color.

Every consumer (`PlayerCard` court + bench, list view, modal headers) picks up the new icon automatically.

## 3) Intro screen exit transition (inverse shatter)

**`src/components/welcome-back/BallersIQEntryIntro.tsx`**
- Introduce an `exiting` state. Replace the immediate-`onDone` of `finish()` with: `setExiting(true)` → after ~700ms call `onDone()`. Guard with `doneRef` so it only triggers once.
- Wrap the whole intro inside an `AnimatePresence` keyed by `!exiting`, so when `exiting` flips true the children unmount and we can run exit animations.
- On the shatter `<motion.svg>`, replace the single opacity tween with an `exit` that:
  - shards return to their original `{ x: s.x, y: s.y, rotate: s.rotate, scale: s.scale, opacity: 0 }` (the *inverse* of the entrance) over `0.55s` with `ease: [0.65, 0, 0.35, 1]`.
  - the svg keeps `opacity: 1` during exit (no fade — the shards themselves fly out).
- On the `RotatingBallersIQBadge` wrapper `motion.div`, add `exit={{ opacity: 0, scale: 0.85 }}` with `transition={{ duration: 0.35 }}`.
- On the skip-hint paragraph add `exit={{ opacity: 0, transition: { duration: 0.2 } }}`.
- Audio: in `finish()`, fade out the audio over the exit window instead of an instant pause (simple `a.volume` step-down via `setInterval`, then pause on unmount as today).

No timing change to `DURATION_MS` (still 6000).

## Out of scope
- No edits to server validation, optimizer, or roster contracts.
- No changes to InjuryReportModal itself; we only mirror its trigger icon.
- HealthStatusBadge text pill unaffected.
