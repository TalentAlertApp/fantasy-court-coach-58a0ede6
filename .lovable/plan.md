

## Step 3 typography & rhythm — align with Steps 1 & 2

Two surgical edits to **`src/components/onboarding/DraftPicker.tsx`**. The empty-roster takeover wrapper in `RosterPage.tsx` already matches Steps 1 & 2 exactly (same radial gradient stack, same `48px 48px` grid at `opacity-[0.04]`, same `bg-background text-foreground`) — no changes needed there.

### 1. Heading — two-line break to match Step 2's rhythm

Step 2 heading is two lines (`Name Your` / `Franchise`). Step 3 currently renders on one line (`Draft Your Squad`), which makes the hero block feel shorter and shifts the CTA upward inconsistently.

Change:
```tsx
<h2 className="font-heading font-black uppercase tracking-[0.15em] text-foreground"
    style={{ fontSize: "clamp(2.5rem, 8vh, 5rem)", lineHeight: 1 }}>
  Draft
  <br />
  <span className="text-accent">{teamName || "Your Squad"}</span>
</h2>
```

Font size, tracking, line-height already match Step 2 — this only fixes the line-break.

### 2. Vertical rhythm — tighten the inter-block spacing

Step 2 cadence: `eyebrow mb-4` → `h2` → `mt-8` (input) → `mt-10` (button row). Step 3 currently uses `mt-3` (subtitle) → `mt-8` (options) → `mt-8` (CTA) → `mt-10` (chips), which compounds to a noticeably taller stack and pushes the CTA off-screen on shorter viewports.

Adjust the four spacings on the existing wrapper elements:
- Subtitle paragraph: `mt-3` → `mt-4` (matches eyebrow `mb-4` rhythm)
- Options grid: `mt-8` → `mt-7`
- "Add more players" inline alert: `mt-5` → `mt-4`
- CTA button row: `mt-8` → `mt-7`
- Chip strip outside the centered block: `mt-10` → `mt-8`

Net effect: identical hero/CTA proximity to Step 2, with the extra option-cards row absorbed cleanly above the CTA.

### 3. Confirmed already-matching (no changes)

- Wrapper padding `px-6 py-8` ✓
- StepIndicator pill at `top-8` ✓
- Eyebrow `text-[11px] tracking-[0.4em] text-accent mb-4` ✓
- Heading font-size, tracking, line-height ✓
- CTA button `h-14 px-10 rounded-full text-base tracking-[0.25em]` with same accent shadow ✓
- Empty-roster portal background gradient + grid overlay ✓ (already mirrored verbatim from `OnboardingPage`)

### Files touched
- `src/components/onboarding/DraftPicker.tsx` — heading `<br/>` insertion + 5 className spacing tweaks

### Out of scope
- No changes to `RosterPage.tsx` (takeover shell already matches)
- No changes to `OnboardingPage.tsx`, `OnboardingHero.tsx`, `NameStep.tsx`

