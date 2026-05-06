## 1. Auto-Draft toast shows GW25 for WNBA — use league-aware gameday

`DraftPicker.tsx` (line 66) and `AICoachModal.tsx` (line 92) both call `getCurrentGameday()` from `src/lib/deadlines.ts`, which only knows the **NBA static schedule** — that's why a freshly drafted WNBA squad ends up "Saved under GW25 · Day 6". The WNBA already has a league-aware version: `useLeagueDeadlines()` + `getCurrentGamedayFrom()`.

Fix:
- In `DraftPicker.tsx`: use `useLeagueDeadlines()` + `getCurrentGamedayFrom(deadlines)` (with NBA fallback to the static `getCurrentGameday()` when no deadlines yet). Pass the resolved `{ gw, day }` to both `autoPickRoster` and `saveRoster`, and into the toast string.
- In `AICoachModal.tsx` `handleDraftFromEmpty`: same swap — use the league deadlines so the toast says e.g. "Saved under GW3 · Day 2" for a WNBA team.
- No backend changes needed (edge functions already accept any `gw/day`).

## 2. AI Coach modal — dynamic league logo, single watermark

`AICoachModal.tsx` currently hard-codes `nbaLogo` in two spots:
- A big watermark behind the whole modal (lines 251–256, inside `DialogContent`).
- A second watermark inside the "No roster yet" banner (lines 281–286).

Result: a WNBA user sees two NBA logos, including one inside the Ballers.IQ header band.

Fix:
- Import both `nbaLogo` and `wnbaLogo` and `useLeague()` from `@/contexts/LeagueContext`.
- Pick `const leagueLogo = isWnba ? wnbaLogo : nbaLogo;`.
- Remove the watermark inside the Ballers.IQ header banner entirely (the one rendered above `DialogHeader` at lines 251–256). Keep only ONE watermark — the one inside the "No roster yet" banner — and switch its src to `leagueLogo`. (Per user: "remove the one from the Ballers.IQ header".)
- That single remaining watermark uses the active league logo, so a WNBA team gets the WNBA logo.

## 3. Manual Roster picker — premium chip strip

`PlayerPickerDialog.tsx` lines 449–510 render the four glassmorphic chips (`PICKED`, `BANK`, `FC`, `BC`) plus the mute button. Per the screenshot they look washed-out and the labels/values cramp together at narrow widths.

Redesign (no behaviour change, just visuals):
- Lift the strip into a single dark gradient panel: `bg-gradient-to-r from-background/80 via-background/60 to-background/80`, `border border-foreground/10`, `rounded-2xl`, `p-1.5`, `shadow-lg`.
- Each chip becomes a vertical stack inside its own pill: `h-12`, rounded-xl, `flex items-center gap-2.5 px-3.5`, with:
  - Left: a small square icon tile (`h-8 w-8 rounded-lg`) tinted with the chip's accent (amber for Picked, emerald for Bank, red for FC, blue for BC), icon centred.
  - Middle: stacked label + value — `LABEL` in `text-[9px] uppercase tracking-[0.3em] font-heading text-foreground/55`, value beneath in `font-mono font-black text-base tabular-nums text-foreground` (colour-shifted when constraints hit: emerald when bank>0, destructive when bank<0, amber when picked=10, etc.).
- Active states (full / over-budget) keep the existing pulse + glow but use a subtler shadow (`shadow-[0_0_22px_-10px_<hue>]`) so it reads as premium rather than neon.
- Provide visible high-contrast value text in both light and dark themes by using `text-foreground` rather than the muted `text-destructive/text-primary` currently used for FC/BC values — instead colour the icon tile and the small label, leave the number white/foreground for legibility.
- Mute button: same square chip aesthetic (`h-12 w-12 rounded-xl`) so it visually aligns with the new row.

The grid stays `grid-cols-4` on desktop; on narrow widths it already wraps via the parent container.

## Technical Details

**Files to edit**
- `src/components/onboarding/DraftPicker.tsx` — switch to `useLeagueDeadlines` for the auto + manual save paths.
- `src/components/AICoachModal.tsx` — remove header watermark, swap remaining watermark to active league logo, switch `handleDraftFromEmpty` to league-aware gameday.
- `src/components/PlayerPickerDialog.tsx` — restyle the chip strip (lines 447–510) per spec above.

**Verification**
- Create a new WNBA team → Auto-Draft → toast reads e.g. "Saved under GW3 · Day 2" (WNBA-correct), not "GW25".
- Open AI Coach for a WNBA team → modal shows the WNBA logo as the only watermark (no NBA logo behind the Ballers.IQ header).
- Open Manual roster picker → top chip strip is dark, premium, with high-contrast counts and tinted icon tiles; states for FC=5/5, BC=5/5, picked=10/10, and over-budget all remain visually distinct.
