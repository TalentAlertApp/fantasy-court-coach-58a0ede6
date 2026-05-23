## Add "Ongoing" status badge to WNBA card

Add a premium, game-style status indicator to the WNBA league card in the onboarding "Name Your Franchise" screen, signaling that WNBA is the only active season right now.

### Where
`src/components/LeaguePickerCards.tsx` — extend the per-league metadata so any card can opt-in to a status badge; only WNBA gets one for now.

### Visual design
- Position: top-right corner of the card, absolutely positioned with a small inset (`top-2 right-2`).
- Shape: small pill with a thin red ring + soft red glow (uses `hsl(var(--destructive))` so it stays on-theme rather than a hardcoded red).
- Content: tiny pulsing red dot + uppercase label "ONGOING" in the heading font, `tracking-[0.25em]`, `text-[10px]`.
- Background: semi-transparent dark (`bg-background/70 backdrop-blur-sm`) so it reads cleanly over the colored card tint.
- Subtle glow via `shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.6)]` + the dot uses `animate-pulse` for a live-game feel.
- Z-index above the watermark logo but below the active halo ring.

### Implementation notes
- Add an optional `statusBadge?: { label: string; tone: "live" }` config map keyed by competition code, with only `wnba` populated.
- Render the badge inside the existing card `<button>` after the watermark `<img>` and before the active halo, so layering stays correct.
- No changes to layout sizing of the card or logos — purely additive overlay.
- Keep accessibility: include `aria-label` extension on the button (e.g. `Select WNBA (season ongoing)`) and mark the badge `role="status"`.

### Out of scope
- Onboarding logic, league selection, ordering, or auto-selecting WNBA.
- Any other surface that uses `LeaguePickerCards` (badge will appear wherever the picker renders, which is correct — WNBA is the only ongoing league globally).
