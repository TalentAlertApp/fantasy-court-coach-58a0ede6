# Two targeted fixes

## 1) Teams don't appear after signing in on a fresh browser (until hard refresh)

### Root cause
`TeamContext` runs `useQuery({ queryKey: ["teams"], queryFn: fetchTeams })` **on mount, unconditionally**, with no `enabled` gate and no `user.id` in the key. On a fresh browser:

1. `AuthProvider` mounts with `loading: true`, no session yet.
2. `TeamContext` immediately fires `fetchTeams()`. `supabase.auth.getSession()` returns `null` → request goes out without a `Authorization` bearer → `teams` edge function sees no caller → returns empty list (or 401 swallowed by `safeParse`).
3. The empty result is cached under key `["teams"]` for `staleTime: 60_000`.
4. `onAuthStateChange` fires `SIGNED_IN`, `user` populates — **but nothing invalidates `["teams"]`**, so React Query happily serves the cached empty list. The "Add your team" dropdown stays empty, `selectedTeamId` gets wiped by the auto-correct effect, no team is selectable.
5. Hard refresh fixes it because the session is restored synchronously before the first `fetchTeams()` call on the new page load.

### Fix (two small, defensive changes)

**A. `src/contexts/AuthContext.tsx`** — when auth flips to a signed-in state, blow away any cached server data that depends on the caller's identity.

- Pull in `useQueryClient` from `@tanstack/react-query`.
- Track the previous `user.id` in a ref. Inside `onAuthStateChange`, if the new `user.id` is different from the previous one (including `null → id`), call `queryClient.invalidateQueries()` (broad, since most queries are user-scoped).
- Also call it once after the initial `getSession()` resolves if it returned a session that the first render missed.

**B. `src/contexts/TeamContext.tsx`** — make the teams query strictly correct so it can't cache an unauthenticated empty list:

- Import `useAuth`.
- Change the query to:
  ```ts
  useQuery({
    queryKey: ["teams", user?.id ?? "anon"],
    queryFn: fetchTeams,
    enabled: !!user && !authLoading,
    staleTime: 60_000,
    retry: 3,
  })
  ```
- This guarantees:
  - No request fires before auth is ready.
  - A different user (or transition from anon → signed-in) uses a different cache slot and forces a fresh fetch.
- Downstream `isReady`/auto-correct logic is unchanged.

No edge-function or DB changes.

---

## 2) Scoring › League › Standings table still leaves empty space at the bottom

### Root cause
`src/pages/ScoringPage.tsx` wraps its content in:

```
<div className="px-6 py-5 ... flex flex-col h-[calc(100vh-3.5rem)] min-h-0">
```

But the outer `.page-scroll` (in `src/index.css`) is already `flex-1 overflow-y-auto px-6 py-5`. Two problems:

- `h-[calc(100vh-3.5rem)]` is a guess about the header height that doesn't include `.page-scroll`'s own `py-5` (2.5rem) or any other chrome — so the inner column is shorter than the actual available space.
- Double padding (page-scroll's `px-6 py-5` + ScoringPage's `px-6 py-5`) also costs vertical room.

### Fix (`src/pages/ScoringPage.tsx` only)

Replace the viewport-calc with a flex chain that consumes whatever the parent gives us:

- Outer wrapper: `className="space-y-5 max-w-[1400px] mx-auto flex flex-col h-full min-h-0"` (drop `px-6 py-5` since `.page-scroll` already pads, drop the `h-[calc(...)]`).
- Leave the existing `Tabs` / `TabsContent` / standings container classes as-is (`flex-1 min-h-0 flex flex-col` on the LEAGUE tab and `overflow-auto flex-1 min-h-0` on the table scroller).

Because `.page-scroll` is already `flex-1 flex-column overflow-y-auto` inside `.main-content` (`flex-1 flex flex-col overflow-hidden`), `h-full` on the page resolves to the real available height, and the standings table will stretch all the way to the bottom of the viewport on every screen size.

No other pages are touched.
