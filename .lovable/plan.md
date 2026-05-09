## Scope
Three presentation-only fixes for the Daily Court Show modal. No data, edge functions, or AI prompts touched.

---

### 1) Entry slide — WNBA voice-over
**Problem:** `useCourtShowAudio` always plays `/audio/FantasyCourt_BallersIQ-MALE.mp3`. WNBA shows should play the FEMALE VO.

**Plan:**
- Copy uploaded `FantasyCourt_BallersIQ-FEMALE-2.mp3` → `public/audio/FantasyCourt_BallersIQ-FEMALE.mp3`.
- In `useCourtShowAudio.ts`, accept an `isWnba: boolean` argument (or `league` string). Replace the hard-coded `VO_URL` with a per-league pick:
  - `wnba` → `/audio/FantasyCourt_BallersIQ-FEMALE.mp3`
  - else → `/audio/FantasyCourt_BallersIQ-MALE.mp3`
- In `CourtShowModal.tsx`, read `useLeague().isWnba` and pass it to `useCourtShowAudio(open, isWnba)`.
- Reset `voPlayedRef` and rebuild `voRef` whenever the league changes so a switch mid-session doesn't stick to the previous voice.

### 2) Ballers.IQ slide — equal-size cards
**Problem:** With `auto-rows-min` + per-card content, the 4 BIQ cards have different heights/widths.

**Plan (in `CourtShowSlide.tsx`, `slide.payload.kind === "ballersiq"` block, lines ~872–897):**
- Switch the grid back to a uniform sizing model: `grid-cols-1 md:grid-cols-2 grid-rows-2 auto-rows-fr gap-3` (drop `content-start`, drop `auto-rows-min`).
- Wrap each card's motion.div with `h-full`.
- In `AICardView` (lines ~140–183), restore `h-full` on the card root and add `flex-1` (or `mt-auto`) on the bottom chip row so all cards stretch to the same height regardless of body length.
- Width is already equal via the 2-col grid; ensure no `max-w` on cards.

This reverses the earlier "size-to-content" change for BIQ only — it does not affect the Played Games Recap grid.

### 3) High-Competitive Matchups — watermark team logos
**Problem:** Slide currently renders large `TeamBadge` icons inside each card. Should mirror the Played Games Recap card style (oversized blurred logo watermark, no inline badge).

**Plan (in `CourtShowSlide.tsx`, `slide.payload.kind === "matchups"` block, lines ~811–843):**
- Remove both `<TeamBadge tricode={...} size={56} />` elements.
- Add `relative overflow-hidden` to the card button.
- Add two watermark `<img>` tags using `getTeamLogo(g.away_team)` / `getTeamLogo(g.home_team)`, copying the exact pattern from `RecapCard` (lines 249–264): `pointer-events-none absolute -left-4 -top-2 h-32 w-32 object-contain opacity-[0.13] blur-[1.5px] select-none` and the right-side mirror.
- Replace the inline header row with a centered tricode + VS + tricode layout:
  - `<span className="font-heading font-black text-lg tracking-wider text-white">{g.away_team}</span>` then the existing `VS` pill + tipoff, then home tricode.
  - Keep the existing `StoryBadge` row and `g.story` paragraph below.
- Wrap inner content in `relative` so it sits above the watermarks.
- Tricodes remain clickable: wrap each tricode `<span>` in a `<button onClick={() => onTeamClick(tricode)}>` (stopPropagation) so team-click behavior is preserved.

---

### Files touched
- `public/audio/FantasyCourt_BallersIQ-FEMALE.mp3` (new, copied from upload)
- `src/components/court-show/useCourtShowAudio.ts`
- `src/components/court-show/CourtShowModal.tsx`
- `src/components/court-show/CourtShowSlide.tsx`

No business logic, no schema, no edge functions.