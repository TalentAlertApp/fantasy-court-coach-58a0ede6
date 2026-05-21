# Plan

## 1) Onboarding Step 3 — Back navigation

**Current bug:** `handleDraftBack` in `src/pages/OnboardingPage.tsx` always returns to Step 1 ("name"). User expects to return to Step 2 ("Choose League").

**Scenarios & target behavior:**

| Entry path | Back from Step 3 goes to |
|---|---|
| Normal onboarding (Hero → Name → League → Draft) | **Step 2 — Choose League** |
| Pre-selected league (from LeaguesPage; Step 2 was skipped) | **Step 1 — Name** |
| "New Team" CTA from multi-team picker (`/welcome/pick-team`) | `/welcome/pick-team` (already correct) |

**Side-effect to handle:** the team is created at the Step 2 → Step 3 transition (`submitTeam`). Going back to Step 2 (or Step 1) leaves an orphan empty team. We'll DELETE the just-created team on back so the user can freely re-pick league/name without polluting `teams` or hitting the multi-team picker logic.

**Edits:**
- `src/pages/OnboardingPage.tsx` → rewrite `handleDraftBack`:
  - if `ownedCount >= 2` (came from picker) → keep current behavior (navigate to `/welcome/pick-team`, no delete — that team pre-existed if owned≥2 only when picker route was used; we'll still delete the just-created `createdTeamId` to be safe, since the picker only routes here after a new-team click).
  - else if `preselectedLeagueId` → delete created team, `setStep("name")`.
  - else → delete created team, `setStep("league")` (restores `pendingName` & `pendingMainSport` which are still in state).
  - After delete: invalidate `["teams"]`, clear `createdTeamId/Name`, clear persisted onboarding `teamId`.

## 2) GW transfer cap error on AI Coach draft (WNBA + NBA)

**Root cause:** `supabase/functions/roster-save/index.ts` currently treats a save as "initial draft" only when `oldIdSet.size < 10`. But if the user already saved any roster in Step 3 (e.g. ran Auto-Draft, then switched to AI Coach, or re-generated AI Coach picks), the team already has 10 roster rows → `isInitialDraft=false` → the AI Coach's full 9–10 player replacement trips `GW_CAP_REACHED`. This affects both leagues identically.

**Fix:** redefine "initial draft" as "team has no committed transactions yet". A roster save without any prior `transactions` row is still part of the drafting phase, regardless of how many roster rows currently exist.

**Edit:** `supabase/functions/roster-save/index.ts`
- Before the budget/cap check, query `transactions` count for this `team_id` once:
  ```ts
  const { count: txnCountBefore } = await sb
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team_id);
  const isInitialDraft = (oldIdSet.size < 10) || ((txnCountBefore ?? 0) === 0);
  ```
- Use the same `isInitialDraft` for both the budget-delta guard and the transaction logging block (already structured that way).
- No frontend changes — same fix covers NBA and WNBA since the function is league-agnostic.

**Why this is safe:** once the team commits its first real transfer (post-onboarding), `transactions` has ≥1 row → normal cap rules apply from then on. During Step 3, no transactions exist yet, so any number of redraft iterations are allowed.

## Files changed
- `src/pages/OnboardingPage.tsx`
- `supabase/functions/roster-save/index.ts`
