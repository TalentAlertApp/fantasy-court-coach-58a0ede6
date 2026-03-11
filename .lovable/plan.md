

## Fix Build Errors in Edge Functions

The build is failing due to TypeScript strictness issues in several edge functions. These are not Supabase connection problems — the project is properly wired. The errors are:

1. **`resolve-team.ts`** — `data.id` and `data.name` are typed as `unknown`. Fix: cast `data` to `any`.
2. **`game-boxscore/index.ts`** — `e` is `unknown` in catch block. Fix: `(e as Error).message`.
3. **`import-game-data/index.ts`** — Same `e` is `unknown` issue.
4. **Multiple functions** — `SupabaseClient` type mismatch when passing `sb` to `resolveTeam`. Fix: change the parameter type in `resolveTeam` to `any`.

### Changes

| File | Fix |
|------|-----|
| `supabase/functions/_shared/resolve-team.ts` | Change `sb` param type to `any`, cast `data` |
| `supabase/functions/game-boxscore/index.ts` | `(e as Error).message` |
| `supabase/functions/import-game-data/index.ts` | `(e as Error).message` |

