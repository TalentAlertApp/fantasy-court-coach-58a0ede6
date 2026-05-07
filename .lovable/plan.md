## Part 1 — YouTube Recaps: stop the bleeding, get every game populated safely

### What actually happened
- "Re-scan All Recaps" calls the edge function with `clear=1` once. That update **wipes `youtube_recap_id` from every FINAL game in one SQL statement** before searching anything.
- Then the loop tries to refill them, but each YouTube `search.list` call costs **100 quota units**. The default daily quota is **10,000 units = ~100 searches/day**. With **1,215 NBA games**, a full re-scan needs ~12 days of quota. Quota dies after ~100 games → every other game is left with `null`.
- That's why hitting Re-scan twice nuked everything: the second wipe ran, then quota died before any could be refilled.

### Fix (no DB changes, edge-function + UI only)

1. **Make `Re-scan All Recaps` non-destructive by default.**
   `youtube-recap-lookup` → change `clear=1` semantics from "bulk wipe THEN search" to **"per-game clear-and-search"**: for each game in the batch, only `null` its `youtube_recap_id` *immediately before* we search it (and only persist the new ID if found, otherwise leave previous ID intact). This guarantees you can never lose more recaps than YouTube actually replaces in the same call.
   - Add a new query param `replace=1` that opts into that behavior (used by Re-scan).
   - `clear=1` (the old footgun) is removed.

2. **Add a strict typed confirmation** in `/commissioner` before Re-scan ever runs: a small inline `<input>` requiring the word `RESCAN` + a red warning banner with the quota math and the time-cost ("≈12 days at 100 games/day").

3. **Populate behavior** stays as-is (loops batches of 100, only fills missing IDs). Add a "Pause / resume tomorrow" hint to the progress bar when quota error fires, plus persist a `recap_last_run_at` timestamp in `localStorage` so the user can see when the next batch is worth attempting.

4. **Add a per-game "Refresh recap" action** on each Schedule card (commissioner-only) — a single targeted lookup costs 100 units and lets you fix bad matches without re-scanning everything.

5. **Doc the long-term path**: to populate all 1,215 games faster, request a YouTube Data API v3 quota increase from Google Cloud Console (they routinely grant 1M units/day for legitimate apps). Add a small note to that effect in the YouTube Recaps card.

### Files
- `supabase/functions/youtube-recap-lookup/index.ts` — replace bulk wipe with per-game clear-and-search; honor `replace=1`; remove `clear=1`.
- `src/pages/CommissionerPage.tsx` — typed confirm for Re-scan, updated copy with quota math, pause/resume hint.
- `src/components/GameDetailModal.tsx` (or schedule card) — add commissioner-only "Refresh recap for this game" button hitting `youtube-recap-lookup?game_id=…`.
- `youtube-recap-lookup` — accept `game_id` param to scope the lookup to one row.

### Direct answer to "how do I get them populated?"
Use **POPULATE YOUTUBE RECAPS**. It only ever fills missing IDs — your existing recaps are safe. Run it once per day until `Remaining` reaches 0 (≈12 days at default quota). After this fix, even Re-scan can no longer wipe recaps that aren't immediately replaced.

---

## Part 2 — AI Coach onboarding: make the "personalised roster" promise real

The Step-3 card promises "Tell the coach your style and get a personalised roster," but the modal that opens is the in-season coach (Analyze / Captain / Transfers / Injuries / Explain) with a generic "Draft my squad with AI" button — no style inputs.

### New flow when AI Coach opens with an empty roster

Replace the current empty-roster banner with a **Style Preferences panel** before any draft fires:

```text
┌─ AI Coach · Personalise your draft ──────────────────────┐
│                                                           │
│  1.  Salary archetype                                     │
│      ◉ Stars & Scrubs  (2-3 max-salary studs + value)     │
│      ○ Balanced         (no player > $14M, even spread)   │
│      ○ Studs only       (top-5 average salary)            │
│                                                           │
│  2.  Experience tilt           [Rookies ── ●──── Vets]    │
│                                                           │
│  3.  Size tilt                 [Guards ──●───── Bigs]     │
│                                                           │
│  4.  Favourite teams (optional, max 3)                    │
│      [+ LAL]  [+ BOS]  [+ DEN]                            │
│                                                           │
│  5.  Risk appetite             [Safe ────●── Boom-or-bust]│
│                                                           │
│           [  Draft my personalised squad  ]               │
└───────────────────────────────────────────────────────────┘
```

### How preferences map to picks (reliable, deterministic)

Build the roster client-side using the existing `usePlayersQuery` data, scored by a weighted formula — no new model needed, so results are predictable:

```text
score(player) =
    fp_pg5
  + w_salary       * salaryArchetypeBonus(player, archetype)
  + w_experience   * (exp - midpoint)   * tilt
  + w_size         * (height - midpoint)* tilt
  + w_team         * (favouriteTeams.includes(player.team) ? 1 : 0)
  + w_risk         * stdev(player.fp_last10) * tilt
```

Then run the same greedy fill the existing optimiser uses (5 FC + 5 BC, ≤ $100M, max 2 per team). Captain = highest-score eligible starter.

If a constraint is unsatisfiable (e.g., "Studs only" + "$100M cap" doesn't fit 10 players), fall back to the closest legal lineup and surface a toast: *"Adjusted slightly to fit cap rules."*

### UI/UX polish
- Show a **live preview pill bar** at the bottom of the panel: estimated roster cost, projected FP, # captain candidates — updates as the user moves sliders.
- Animate the chosen archetype card with the existing accent glow used elsewhere in onboarding.
- "Re-roll with same style" button after the draft, in case the user wants a sibling lineup.

### Files
- `src/components/AICoachModal.tsx` — add `<StylePreferencesPanel/>` shown only when `isRosterEmpty`, replacing the current "NO ROSTER YET" banner.
- `src/components/ai-coach/StylePreferencesPanel.tsx` (new) — the panel above with sliders and archetype radios.
- `src/lib/personalised-draft.ts` (new) — pure scoring + greedy fill, ~120 LOC, fully unit-testable.
- `src/components/onboarding/DraftPicker.tsx` — no change to copy; the modal now delivers what the card promises.

### Why not just remove AI Coach?
Because the underlying data (`fp_pg5`, salary, height, exp, team, fp_last10) is already on every player and the greedy fill is the same one the manual draft path uses. It's deterministic, explainable, and works for both NBA and WNBA without any new backend. So we keep AI Coach and finally make it personalised.

---

### Out of scope for this round
- YouTube quota increase request (manual Google Cloud step you have to do).
- Caching the personalised draft in Supabase — kept client-side until you ask for it.
