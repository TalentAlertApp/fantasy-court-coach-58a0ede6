## Goal
Make the **Game Recaps** modal video play as smoothly as the other 3 contexts (ScheduleList, CourtShowSlide, GameDetailModal), with no visible UI change.

## Root cause (verified by cross-context comparison)
The recap iframe in `GameRecapsModal.tsx` is a descendant of an element with `backdrop-blur-md` (the modal root, line 206). An actively-playing iframe inside a `backdrop-filter` subtree triggers a known Chromium compositing bug → continuous repaint = the "permanent glitch."

None of the 3 working contexts have a `backdrop-filter` ancestor over their iframe:
- ScheduleList: in-page, no blur ancestor
- CourtShowSlide: inside `CourtShowModal` whose content is `bg-black` (no blur)
- GameDetailModal: blur only on tiny pill badges, never over the iframe

The embed URL is identical to GameDetailModal (default `autoplay` options), so the URL is not the problem.

## Fix
1. **Remove `backdrop-blur-md` from the modal root** in `src/components/schedule/GameRecapsModal.tsx` (line 206 inner wrapper). The element behind it is the opaque Radix `DialogContent` (`bg-background`) plus the modal's own radial gradient and venue image, so the frosted blur is not actually visible — removing it is a zero-impact visual change but eliminates the backdrop-filter ancestor over the iframe.
2. **Keep the GPU-isolated video wrapper** already added (`transform-gpu isolate z-10` + `backface-visibility:hidden`) so the iframe sits on its own composited layer, matching the robust `GameDetailModal` pattern. (Belt-and-suspenders; harmless.)

## What stays exactly the same
- Autoplay behavior (unchanged embed URL/options).
- Layout, grid, side panels, fallback "Recap not yet available" UI.
- All other `backdrop-blur-sm` usages on sibling pills/panels (not ancestors of the iframe) remain untouched.

## Verification
- Confirm the chain from modal root → iframe contains no remaining `backdrop-filter` after the change.
- Build check (auto), then visually confirm in the preview that the recap plays with a natural flow and the modal still looks identical.

## Technical detail
Only one file changes: `src/components/schedule/GameRecapsModal.tsx`. The single substantive edit is dropping `backdrop-blur-md` from the inner root `div`; the GPU-isolation classes on the video wrapper are already in place from the prior pass.