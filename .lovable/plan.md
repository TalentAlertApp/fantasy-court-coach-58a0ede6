

## Three fixes — roster shows all 10, login routing for users with existing teams, email greeting on hero

### 1. Roster pane shows only 8 of 10 players (`/transactions`)

**Root cause.** `PlayersPage` calls `usePlayersQuery({ sort: "fp5", order: "desc", limit: 500 })`. The roster pane is built by hydrating each roster `player_id` against this `allPlayers` list:

```ts
const hydrate = (id) => allPlayers.find((p) => p.core.id === id);
```

When a roster contains deep-bench players whose FP5 ranks them outside the top 500 (e.g. **H. González — 0.9 FP5**, **T. III — 0.7 FP5** in the user's roster), `find()` returns `undefined`, the row is filtered out, and the pane silently renders 8 instead of 10. The header still shows `10/10` because that uses the raw `rosterIdList`, not the hydrated list.

This will keep happening for any low-FP5 / new / G-League player on a user's roster. The fix is to **guarantee every roster player is in the hydration source**, regardless of the league-wide query's sort or limit.

**Fix in `src/pages/PlayersPage.tsx`:**
- Add a second query, `usePlayersQuery({ sort: "salary", order: "asc", limit: 2000 })`, named `allPlayersFull` — used **only** for hydration of roster, IN/OUT, and validation pools.
  - 2000 is the max the edge fn allows; covers the entire NBA player pool comfortably.
  - Sort/order doesn't matter for a hydration map; any stable fetch works.
- Build a `Map<id, PlayerListItem>` from `allPlayersFull.items` and rewrite `hydrate()`, `rosterPlayers`, `outPlayersFull`, `inPlayersFull`, `rosterPlayersFull`, and `validationPool` to read from that map instead of the limited `allPlayers` list.
- Keep `allPlayers` (the existing 500-row, FP5-sorted list) as the **table data source**, since the table only ever displays top-500 by FP5.
- Defensive: if `hydrate` still misses (truly absent player record), fall back to a stub built from the roster row itself (`name = "—"`, `team = ""`, `salary = 0`) so the pane never silently drops a roster slot. Better: log a `console.warn` so we can spot truly orphaned ids.

After this fix, the pane will always render `rosterIdList.length` rows, matching the `10/10` header.

### 2. Login flow: users with existing teams should land on the team picker, not onboarding

**Root cause.** Two routing predicates disagree on what counts as "the user owns a team":

| File | "Owned" definition |
|---|---|
| `useFirstRunGate.ts` (line 15) | `t.owner_id && t.owner_id === user.id` — STRICT |
| `TeamPickerPage.tsx` (line 15) | `t.owner_id === user.id \|\| !t.owner_id` — INCLUDES legacy |
| `RequireAuth.tsx` (line 68) | `t.owner_id === user.id \|\| !t.owner_id` — INCLUDES legacy |
| `teams` edge fn | Returns rows where `owner_id IS NULL OR owner_id = user.id` |

A user whose teams pre-date the multi-user migration has rows with `owner_id = NULL`. `useFirstRunGate` says "0 owned → onboard", so RequireAuth sends them to `/welcome`. But the moment they create their first owned team, all the legacy null-owner teams pop back into the TeamSwitcher (because the picker uses the inclusive definition). That's exactly what the user described.

**Fix.** Make a single shared "owned teams" definition and use it everywhere. The inclusive definition (legacy + owned) is correct for this single-tenant league — legacy teams effectively belong to the user once they've signed in.

- In `src/hooks/useFirstRunGate.ts`, change the filter to:
  ```ts
  const ownedTeams = ready
    ? teams.filter((t: any) => t.owner_id === user!.id || !t.owner_id)
    : [];
  ```
  (i.e. mirror the picker / RequireAuth definition).
- Result: a returning user with 1+ legacy teams skips `/welcome` entirely. RequireAuth then evaluates the multi-team picker rule (line 60-72), and:
  - 1 owned team → drops them straight into `/` (TeamPicker auto-bypasses with 1 team).
  - 2+ owned teams → sends them to `/welcome/pick-team` to choose.
- New users with 0 teams (legacy or owned) still hit `shouldOnboard === true` and land on `/welcome`. Onboarding behaviour unchanged.

No edge-fn changes needed — `teams` already returns the correct shape.

### 3. Show the email "username" on the onboarding hero

The onboarding hero already has the email available (`OnboardingPage` passes `email={user?.email}` to `OnboardingHero`), but it's only used in a tooltip on the sign-out icon. Display it as a visible greeting.

**Fix in `src/components/onboarding/OnboardingHero.tsx`:**
- Derive `alias = email?.split("@")[0]` (the local part of the email, e.g. `alertadetalento` from `alertadetalento@gmail.com`).
- Render it in the top bar, between the NBA logo and the sign-out icon, as a subtle pill:
  ```tsx
  {alias && (
    <span className="text-[11px] uppercase tracking-[0.25em] text-foreground/60">
      Hi, <span className="text-foreground/90 font-bold normal-case tracking-normal">{alias}</span>
    </span>
  )}
  ```
- Keep the existing sign-out tooltip (still includes the full email).
- Hero already passes the email; no signature changes required.

### Files touched

1. `src/pages/PlayersPage.tsx` — add second `usePlayersQuery` call (limit 2000) for hydration; build an id→player map; rewire `hydrate`, `rosterPlayers`, `outPlayersFull`, `inPlayersFull`, `rosterPlayersFull`, `validationPool` to use it. Leave the table's `allPlayers` (limit 500, FP5-sorted) untouched.
2. `src/hooks/useFirstRunGate.ts` — broaden `ownedTeams` to include legacy null-owner teams (one-line filter change).
3. `src/components/onboarding/OnboardingHero.tsx` — render the email alias as a visible greeting in the top bar.

### Out of scope

- Backfilling `owner_id` on legacy team rows in the DB (the inclusive predicate already handles it cleanly; an SQL backfill is a separate cleanup).
- Removing the FP5-sorted top-500 cap on the table itself (the table is paginated and showing top-500 by FP5 is the intended behaviour).
- Changing the welcome-back hero copy or routing.

