

## Plan: Multi-Team Support (Prompt 4)

Adds a `teams` table, scopes roster/transactions/AI to a selected team, and adds a team switcher to the header. Backward-compatible: all endpoints default to "My Team" when no team_id is provided.

---

### 1. Database Migration

Create 2 new tables and alter 2 existing ones:

**`teams`** — `id` uuid PK (default gen_random_uuid()), `name` text NOT NULL, `description` text nullable, `created_at` timestamptz, `updated_at` timestamptz. RLS enabled with permissive ALL policy.

**`team_settings`** — `team_id` uuid PK FK→teams.id ON DELETE CASCADE, `salary_cap` numeric nullable, `starter_fc_min` int nullable, `starter_bc_min` int nullable, `created_at` timestamptz, `updated_at` timestamptz. RLS permissive ALL.

**`roster`** — ADD `team_id` uuid column (nullable initially for migration, then set NOT NULL). FK→teams.id ON DELETE CASCADE.

**`transactions`** — ADD `team_id` uuid column (same pattern).

**Migration data steps:**
1. Insert default team `("My Team", null)`
2. Update all existing `roster` rows to use that team_id
3. Update all existing `transactions` rows to use that team_id
4. ALTER columns to NOT NULL

---

### 2. Zod Contract Updates (`src/lib/contracts.ts`)

Add schemas:
- `TeamSchema` — `{ id, name, description, created_at, updated_at }`
- `TeamListPayloadSchema` — `{ items: Team[], default_team_id: string }`
- `TeamListResponseSchema` — envelope wrapper
- `TeamCreateBodySchema` — `{ name, description? }`
- `TeamCreatePayloadSchema` — `{ team: Team }`
- `TeamCreateResponseSchema` — envelope wrapper

Extend `RosterSnapshotSchema` with optional `team_id` and `team_name` (use `.extend()` to avoid breaking existing validations — make them optional so existing stub responses still pass).

---

### 3. New Edge Function: `teams`

**`supabase/functions/teams/index.ts`** — CRUD for teams:
- `GET` → list all teams + identify default (earliest created)
- `POST` → create team, return new team object
- `PATCH` → update team name/description (team_id from query param)
- `DELETE` → delete team (team_id from query param)

All return strict envelope JSON.

**`supabase/config.toml`** — add `[functions.teams]` with `verify_jwt = false`.

---

### 4. Update Existing Edge Functions for Team Scoping

Functions to update: `roster-current`, `roster-save`, `roster-auto-pick`, `transactions-simulate`, `transactions-commit`, `ai-coach`.

**Pattern:** Extract `team_id` from query param `?team_id=X`, else from `X-Team-Id` header, else resolve default team (first team by `created_at`).

**`roster-current`** — Query `roster` table WHERE `team_id = resolved_team_id`. Build snapshot from actual DB rows. Include `team_id` and `team_name` in response.

**`roster-save`** — Accept `team_id` in body (optional) or resolve from query/header. Upsert roster rows for that team.

**Other stubs** (`roster-auto-pick`, `transactions-simulate`, `transactions-commit`) — Pass team_id through, return stub data with team_id included.

**`ai-coach`** — Resolve team_id, fetch roster WHERE team_id matches, pass team context to AI.

---

### 5. Client API Layer (`src/lib/api.ts`)

Add fetchers:
- `fetchTeams()` → GET `teams`
- `createTeam(body)` → POST `teams`
- `updateTeam(id, body)` → PATCH `teams?team_id=X`
- `deleteTeam(id)` → DELETE `teams?team_id=X`

Update all team-aware fetchers to accept optional `teamId` param and append `?team_id=X` to the URL:
- `fetchRosterCurrent(teamId?)`
- `saveRoster(body, teamId?)`
- `autoPickRoster(body, teamId?)`
- `simulateTransactions(body, teamId?)`
- `commitTransaction(body, teamId?)`
- All 5 `ai*` functions accept optional `teamId`

---

### 6. React Query Hook: `useTeamsQuery`

**`src/hooks/useTeamsQuery.ts`** — wraps `fetchTeams()` with useQuery.

---

### 7. Team Context Provider

**`src/contexts/TeamContext.tsx`** — React context providing:
- `teams[]`, `selectedTeamId`, `setSelectedTeamId(id)`, `defaultTeamId`
- On mount: fetch teams, restore from `localStorage("nba_selected_team_id")`, fallback to default
- On change: persist to localStorage, invalidate roster/transactions queries

---

### 8. Team Switcher UI

**`src/components/TeamSwitcher.tsx`** — Dropdown in header showing team names + "New Team" action. Selecting a team updates context.

**`src/components/layout/AppLayout.tsx`** — Add TeamSwitcher to the header bar.

---

### 9. Update Pages to Use Team Context

**`src/hooks/useRosterQuery.ts`** — Include `selectedTeamId` in queryKey and pass to `fetchRosterCurrent(teamId)`.

**Pages** (`RosterPage`, `TransactionsPage`, `StatsPage`, `AIHubPage`) — Read `selectedTeamId` from context, pass to API calls, show team name in headers.

---

### 10. Implementation Order

1. Database migration (teams + team_settings + alter roster/transactions)
2. Zod schemas in contracts.ts
3. `teams` edge function + config.toml
4. Update `roster-current` to be team-aware (real DB query instead of stub)
5. Update other edge functions for team_id resolution
6. Client API fetchers
7. TeamContext provider + useTeamsQuery hook
8. TeamSwitcher component + AppLayout integration
9. Update pages to use team context
10. Deploy and test

~10 files modified, ~4 new files created.

