## Ballers.IQ Explain Tab — Player Intelligence Report Upgrade

Upgrade the existing Explain tab in `AICoachModal` so the AI's `explain-player` response is rendered as a structured scouting report (verdict, BIQ rating, archetype, form, salary, risk, schedule). No new buttons, no new modals, no new entry points — just enrich the schema, the edge function payload, and the existing `ExplainReport` component.

### 1. Extend the explain-player schema (`src/lib/ballers-iq/schemas.ts`)
Extend `BIQExplainPlayerResponse` and `validateExplainPlayer` with optional fields:
- `biq_label?: "Elite" | "Strong" | "Playable" | "Watch" | "Risk"`
- `archetype?: string` (Usage Engine, Stocks Hunter, Glass Cleaner, Value Play, Form Climber, Minutes Monster, Safe Floor, Ceiling Swing, Trap Pick)
- `risk_flags?: string[]`
- `schedule_context?: { next_game?: string | null; games_count?: number; label?: "Schedule Boost" | "Schedule Drag" | "Neutral" | "No Game Risk"; warning?: string | null }`
- Keep existing required fields untouched so older responses still validate.

### 2. Compute archetype + schedule context server-side (`supabase/functions/_shared/biq.ts`)
Add a pure `archetypeFor(p, packParts)` helper based on existing index values (no new data sources):
- High usage + high fp5 → "Usage Engine"
- High `stocks5` → "Stocks Hunter"
- High rebound contribution → "Glass Cleaner"
- `salary_eff.label === "Underpriced"` + decent rating → "Value Play"
- `form === "Form Spike" | "Minutes Spike"` → "Form Climber"
- High `mpg5` + stable minutes → "Minutes Monster" / "Safe Floor"
- High ceiling vs floor gap → "Ceiling Swing"
- `salary_eff.label === "Salary Trap"` → "Trap Pick"
- Default → "Safe Floor"

Extend `buildPlayerPack` to also return `archetype` and a richer `schedule` field including the next upcoming opponent string (e.g. `vs LAL` / `@ BOS` from the first matching game) and a `warning` when `games === 0`.

### 3. Wire new fields into the edge function (`supabase/functions/ai-coach/index.ts`)
- Update the `explain-player` prompt schema description so the model echoes `biq_label`, `archetype`, `risk_flags` (verbatim from `biq.player.risk.flags`), and `schedule_context` (verbatim from `biq.player.schedule`), and so the `verdict` rule references the archetype/risk combo.
- `validateShape("explain-player", ...)` stays permissive (current required keys only) so the AI Coach modal never hard-fails on the richer schema. The client-side validator already accepts unknown extra fields.

### 4. Update fallback (`src/lib/ballers-iq/narrative.ts`)
Extend `fallbackExplainPlayer` to populate `biq_label`, `archetype`, `risk_flags`, and `schedule_context` from the locally-built `BIQPlayerIndexPack` so the report still renders fully if the AI call fails.

### 5. Redesign `ExplainReport` in `src/components/AICoachModal.tsx` (no new files)
Keep the existing player header, summary block, "Why it scores" list, and recommendation banner. Reorganize so the report reads as a scouting card:

```text
┌─ Player header (unchanged) ─────────────────┐
├─ VERDICT pill  +  BIQ Rating (score / label)
│  Archetype chip · Form Signal chip
├─ Salary Efficiency  |  Risk Radar (LOW/MED/HIGH + flags chips)
├─ Schedule Context (next game · games count · boost/drag · no-game warning)
├─ Summary (italic quote — existing)
├─ Why it scores (existing list)
└─ Recommendation banner (existing)
```

Rules respected:
- Single primary button stays the existing "Explain" — no new CTAs.
- Recent player chips above search remain untouched.
- Sections render only when their field is present (graceful with partial AI/fallback data).
- All new chips use existing `Badge` / utility classes; no new dependencies.

### 6. Acceptance check
- Existing search, autocomplete, recent chips, and AI streaming still work.
- Report shows verdict, BIQ rating + label, archetype, form signal, salary efficiency, risk radar with flags, and schedule context (when data exists).
- No new entry points elsewhere in the app; Explain remains inside the AI Coach modal.
- Light/dark theme respected via existing tokens.

### Files touched
- `src/lib/ballers-iq/schemas.ts` (extend interface + validator)
- `src/lib/ballers-iq/narrative.ts` (extend fallback)
- `supabase/functions/_shared/biq.ts` (archetype + richer schedule)
- `supabase/functions/ai-coach/index.ts` (prompt schema for explain-player) — redeploy
- `src/components/AICoachModal.tsx` (`ExplainReport` only; no other UI)
