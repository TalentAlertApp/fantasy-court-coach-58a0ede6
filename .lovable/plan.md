## Three small UI tweaks

### 1) Ballers.IQ — shorter cards
**File:** `src/components/court-show/CourtShowSlide.tsx`
- In the BIQ grid wrapper (the one with `auto-rows-fr flex-1`), drop `flex-1` and switch `auto-rows-fr` → `auto-rows-min` so cards size to content instead of stretching to fill the slide.
- In `AICardView` root, remove `h-full` (added last turn) so each card collapses to its natural body height. Keep `mt-auto` on the chip row removed (or change to `mt-3`) since cards no longer stretch.

### 2) Played Games Recap — smaller watermark badges
**File:** `src/components/court-show/CourtShowSlide.tsx` (`RecapCard`)
- Reduce both team-logo watermark `<img>` sizes from `h-56 w-56` → `h-32 w-32` and tighten offsets from `-left-10 -top-6` / `-right-10 -top-6` → `-left-4 -top-2` / `-right-4 -top-2`. Keep the same `opacity-[0.13] blur-[1.5px]` treatment.

### 3) TOTW — nudge formation further left to full centering
**File:** `src/components/TeamOfTheWeekModal.tsx`
- Change `OFFSET_X` from `-8` to `-14` (percent). `OFFSET_Y` stays at `-10`.

### Out of scope
No changes to data, AI prompts, or other slides — purely presentation tweaks.