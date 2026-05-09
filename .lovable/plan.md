## Court Show Polish — 4 fixes

### 1) BALLERS.IQ — equal card heights
**File:** `src/components/court-show/CourtShowSlide.tsx`
- On the BIQ grid (around L851), add `auto-rows-fr` and apply `h-full` to each card's `motion.div` wrapper.
- Inside `AICardView` root container, add `h-full flex flex-col` so the body section grows and the bottom chip row anchors to the bottom (use `mt-auto` on the team/player chips row), making cards visually consistent regardless of body length.

### 2) Played Games Recap — watermark badges + fixed card height
**File:** `src/components/court-show/CourtShowSlide.tsx` (`RecapCard` + `RecapCarousel`)

a) **Replace inline team marks with watermarks.** In `RecapCard`:
- Remove the two `<InlineTeamMark>` instances in the score row; render only `AWY 136 — 111 MIA` text (tricode + score), with the winner highlighted as today.
- Add two oversized blurred team-logo watermarks behind the card content (positioned `absolute` left/right, e.g. `-left-6 -top-2 h-44 w-44 opacity-[0.12] blur-[2px]` and mirrored on the right), matching the sidebar effect. Card root needs `relative overflow-hidden`.

b) **Stop cards from stretching when fewer rows.** In `RecapCarousel`:
- Replace `auto-rows-fr` with `auto-rows-min` on the grid.
- Remove `flex-1` from the grid and from the wrapping `flex flex-col h-full`; let the grid take its natural height and align to the top so 1-row pages keep the same card height as 3-row pages. Keep dot indicators below.

### 3) Outstanding Game — vertical centering + table breathing room
**File:** `src/components/court-show/CourtShowSlide.tsx` (`OutstandingSlide`)
- Change the outer grid wrapper from `content-start` to vertical centering: wrap the `grid` in a `h-full flex items-center` container (or change `content-start` → `content-center` and add `my-auto`).
- Table tweaks:
  - Remove `truncate` and `min-w-0` from the player-name `<span>`; allow it to take full width.
  - Tighten numeric columns: change all `w-[42px]` → `w-[38px]`, `w-[50px]` → `w-[46px]`; remove `pl-2` from MIN header/cell so columns sit closer.
  - Reduce avatar gap: `gap-1.5` → `gap-1`, image `h-6 w-6` → `h-5 w-5`.

### 4) Entry slide — front card with white frame removed
**Files:** `public/brand/ballers-iq-card-front-nba.png`, `public/brand/ballers-iq-card-front-wnba.png`, `src/index.css`

The current PNGs (1536×1024) ship with a thick silver/white outer frame; CSS `scale(1.32)` only partially clips it. The clean fix is to crop the source PNGs to just the inner blue badge and let CSS render at native fit.

- Use ImageMagick to **trim/crop** the white-silver frame out of both card PNGs (e.g. `magick … -gravity center -crop <inner-blue>+0+0 +repage`) so the resulting asset is just the blue Ballers.IQ logo on transparent/blue background, matching the back-card aspect.
- After cropping, in `src/index.css` `.biq-badge-art`: change `transform: scale(1.32)` → `scale(1)` (or remove transform), and switch to `object-fit: cover` so the inner art fully fills the card with zero white margin and matches the back card footprint exactly.

### Out of scope
- No changes to AI prompt/edge function, BIQ data shape, recap payload, or business logic — purely presentation tweaks plus 2 cropped image assets.