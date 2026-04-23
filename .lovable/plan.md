

## Three small, surgical fixes

### 1. My Roster — schedule overlay needs more height for the 5th card
**File:** `src/pages/RosterPage.tsx` (line 535)

The overlay container is capped at `max-h-[440px]` with `overflow-hidden`, but `SchedulePreviewBody` itself has its own internal scrollers (sticky header + matchup list). The 5th card peeks but is clipped because the overlay's outer `overflow-hidden` doesn't account for the panel's internal header.

Fix:
- Bump the outer cap from `max-h-[440px]` → `max-h-[520px]`. That's exactly enough headroom for header (~80px) + 5 matchup cards (5 × 64px + 6px gaps = ~340px) + safe padding.
- Keep `overflow-hidden` on the outer container (the inner list owns scrolling).

### 2. Pick Player — team filter trigger + dropdown polish
**File:** `src/components/PlayerPickerDialog.tsx` (lines 197–256)

Three changes to the trigger and content:

a) **Remove the badge from the selected trigger** — currently shows logo + tricode when a team is selected. The user wants tricode only. Replace the inner `<span>...logo + truncate text...</span>` block with just `<span className="block w-full text-center truncate">{teamFilter}</span>` (mirroring the "ALL" branch).

b) **Decrease the trigger width** — change `grid-cols-[1fr_120px]` (line 197) → `grid-cols-[1fr_88px]`. Without the logo, 88px comfortably fits any 3-letter tricode + chevron.

c) **Increase the dropdown height** — currently `max-h-72` (288px). Replace with a viewport-relative cap calibrated to reach the bottom of the dialog: `max-h-[min(60vh,520px)]`. The Radix Select content auto-positions and, with this taller cap, will extend almost to the bottom of the modal, surfacing far more teams without scrolling.

(Logos in the dropdown items themselves stay — they only disappear from the trigger.)

### 3. Step 3 of 3 — full-screen takeover (no sidebar)
**File:** `src/pages/RosterPage.tsx` (line 432)

Confirmed root cause: the empty-state branch wraps `DraftPicker` in `fixed inset-0 z-40 bg-background`, but it's rendered *inside* `AppLayout`, and stacking-context inheritance makes the `z-40` fail to cover the sidebar in some preview situations (visible in the user's screenshot).

Two-part fix to make it bulletproof and consistent with Steps 1 & 2 (which use the full screen via the `/welcome` route outside `AppLayout`):

- Render the empty-state takeover via a React **portal** (`createPortal(..., document.body)`) so it escapes the `AppLayout` stacking context entirely. Use `fixed inset-0 z-[100] bg-background overflow-auto`.
- This guarantees the sidebar is visually hidden behind the takeover regardless of any future layout/z-index changes — same visual envelope as Steps 1 and 2.

No layout changes inside `DraftPicker` itself (Stage 3 vertical sizing was fixed last round and now matches Stages 1 & 2).

**Answer to the user's question**: Step 3 *should* render full-screen, and it already does for first-run onboarding (`/welcome` route renders outside `AppLayout` — see `src/App.tsx` line 46). The screenshot shows Step 3 reached via the **empty-roster path inside an existing team** (e.g. after deleting all players from a team, or selecting an empty team via the team switcher), which renders inside `RosterPage` and therefore inside `AppLayout`. The portal fix above unifies both paths so it's *always* a glorious full-screen takeover.

### Files touched
- `src/pages/RosterPage.tsx` — overlay max-h bump + portal-render the empty-state DraftPicker
- `src/components/PlayerPickerDialog.tsx` — trigger badge removal + width shrink + dropdown max-h bump

