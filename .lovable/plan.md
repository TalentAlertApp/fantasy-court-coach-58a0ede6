## I) Roster — health icon placement + visual

**PlayerCard.tsx**

1. **Bench variant**: Move the health indicator out of `absolute bottom-0.5 right-1` and inline it right after the player name. The name line becomes:
   ```tsx
   <p className="… flex items-center gap-1.5">
     <span className="truncate">{formatShortName(core.name)}</span>
     {health.status && <HealthTooltip …><HealthStatusIcon health={health} size="xs" /></HealthTooltip>}
   </p>
   ```
   Remove the previous absolute-positioned block.

2. **Court variant**: Replace the `absolute -bottom-0.5 -left-0.5` indicator on the photo with an inline indicator next to the name. The name line becomes a flex row with the icon to the immediate right of the short name. Remove the absolute block on the photo.

3. **Icon swap + color by status**: Update `HealthStatusIcon.tsx` to use the same `Shield` icon used by the Injury Report trigger (the lucide `Shield` used in `InjuryReportModal`). Recolor by status to match `InjuryReportModal.statusClasses` palette:
   - OUT → `text-red-500` (with current red glow)
   - Day-To-Day (`DTD`) → `text-orange-500`
   - Game-Time Decision (`GTD`) → `text-amber-500`
   - Questionable (`Q`) → `text-yellow-400`
   - Probable (`PROB`) → `text-green-600`
   Keep sizes and tooltip behavior; ditch the `Activity` / `CircleAlert` branches — Shield only.

This is the only file affected for the icon swap; every consumer (`PlayerCard`, `PlayerRow`, modal headers, etc.) inherits the new look automatically.

## II) Onboarding — remove redundant CTA

**DraftPicker.tsx**

When `strategy === "manual"` and `picks.length > 0 && picks.length < 10`, two equivalent CTAs render:
- the "+ Add more players (N/10)" pill (lines ~246-255)
- the main `<Button>` showing "Pick N More" (same `handleGo` → opens `PlayerPickerDialog`)

Remove the small "+ Add more players" pill block entirely. The main yellow CTA already handles "Pick N More" and is the prominent action.

## III) Ballers.IQ entry intro polish

**BallersIQEntryIntro.tsx**

1. **Background**: behind the shatter SVG + rotating card, add a court-image layer using `@/assets/court-bg.png` (the same asset used by `RosterCourtView` for Starting 5 / TOTW):
   ```tsx
   <div
     className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-15"
     style={{ backgroundImage: `url(${courtBg})` }}
     aria-hidden
   />
   ```
   Use `opacity-15` in dark and `opacity-25` in light to read as "quite darker" in dark theme and "quite lighter" in light theme while remaining a background. The `bg-background` color stays as the base so the theme tint dominates.

2. **Timing**: bump `DURATION_MS` from `5000` to `6000`.

No changes to audio, shatter motion, or skip behavior.

## Out of scope
- No changes to data sources, edge functions, or roster business logic.
- No changes to the Injury Report modal itself; only its trigger icon convention is reused.
- `HealthStatusBadge` text pill (used elsewhere) is untouched.