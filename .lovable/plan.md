

## Plan: Fix AI Coach Explain — autocomplete + wrong-player response

Two real bugs are at play. The dropdown bug from the previous round was **never actually applied** to the file, and there's a second backend bug that also needs to be fixed for "Explain" to return the right player.

### Bug 1 — Autocomplete never appears (frontend, not previously applied)

In `src/components/AICoachModal.tsx` the code today still says:
- `usePlayersQuery({ limit: 500 })` (should be 1000)
- `if (explainSearch.length < 3 || selectedExplainPlayer) return [];` (should be 1)

So typing "Paul" (4 chars) sometimes shows nothing because Paul George can sit outside the top‑500 fetch, and typing "Pa" (2 chars) shows nothing at all.

Fix:
- Bump `usePlayersQuery({ limit: 500 })` → `usePlayersQuery({ limit: 1000 })`.
- Lower the trigger from `< 3` to `< 1` so suggestions appear from the first character.
- Keep the existing diacritics-insensitive name + tricode + full team name match.
- Keep the existing Enter / button auto-pick of the top match.

### Bug 2 — Explain returns the wrong player (backend)

In `supabase/functions/ai-coach/index.ts`:
- `fetchContext` pulls only the top 200 players by `fp_pg5`.
- `buildPlayerSummary` then trims that to **the top 100** before sending to OpenAI.
- The `explain-player` developer message contains the `player_id` the user picked, but if that player isn't in the 100‑row summary, the model has no data row for them and hallucinates a description of someone else (the Kevin Durant output in the screenshot is exactly this failure — Paul George wasn't in the context window).

Fix in `ai-coach/index.ts`:
- For the `explain-player` action specifically, **always include the requested player** in the player summary sent to the model:
  - Read `params.player_id` from the request body.
  - If that id isn't already in the top‑100 slice, fetch that single player row from `players` and prepend it to the summary.
  - Also pass an explicit `target_player_id` field in the developer message so the model knows exactly which row to describe.
- Add a guard in the developer instructions for `explain-player`: "Describe ONLY the player whose `id` matches `target_player_id`. Do not substitute another player."
- As a small defense in depth, after parsing the model's JSON response for `explain-player`, if the model returned `player_id` and it doesn't match the requested id, return an `AI_PLAYER_MISMATCH` error so the UI shows a clear failure instead of a wrong-player answer.

### Bug 3 (small) — UX guardrail in the modal

In `AICoachModal.tsx`, after `handleExplain` resolves, also surface the resolved player's name in the result header (e.g. "Explanation for Paul George") so any future mismatch is immediately visible to the user.

### Files touched
- `src/components/AICoachModal.tsx` — apply the previously-missed limit/length changes; show the resolved player name above the explanation.
- `supabase/functions/ai-coach/index.ts` — for `explain-player`, ensure the targeted player is in the model context, add a guard line in the developer prompt, and validate the returned `player_id` matches the requested id.

### Verification after implementation
- Typing "P" in Explain shows a dropdown immediately.
- Typing "Paul" lists Paul George (and any other Paul) with team logos.
- Selecting Paul George and clicking Explain returns an explanation about **Paul George** (not Kevin Durant), with his name shown above the breakdown.
- Same check works for a clearly low-ranked player (e.g. "Queta") to confirm the top‑100 truncation no longer blocks Explain.
- Other tabs (Analyze / Captain / Transfers / Injuries) still work unchanged.

