## Daily Court Show — three targeted fixes

### A. Ballers.IQ shows NBA players on a WNBA scheduled day

**Diagnosis.** `supabase/functions/court-show-intelligence/index.ts` only feeds the AI a list of games + (for played days) `topPerformers`. On a **scheduled** WNBA day there are no top performers, so the model freelances using its training data and pulls in NBA stars (e.g. "Doncic · DAL", "Haliburton · IND"). The existing pollution check is by tricode only, and DAL/IND/WAS/PHX/CHI etc. exist in **both** leagues, so the leak slips through.

**Fix (server-side, `court-show-intelligence`).**
1. Before calling the AI, fetch a per-team **roster shortlist** for the league: top ~6 players per team in `players` filtered by `league_id` and the tricodes of today's games (sorted by recent FP / salary). Pass them in the payload as `rosters: [{ team, players: [{ id, name }] }]`.
2. Tighten the system prompt: "Every player you reference MUST appear in the provided `rosters` array. Use ONLY their exact names and the team tricode that owns them. Never invent or recall players from training data."
3. Add a **post-AI roster validator**: drop / regenerate any card whose `player_name` is not in the provided roster pool. If validation still leaves <4 cards, fall back to the deterministic generic cards (already in place).
4. Strengthen the cache-pollution check: instead of only flagging tricodes, also re-fetch and confirm every referenced `player_name` exists in the league's `players` table; if not, treat the cache row as polluted and regenerate (`force=true` path).

### B. Salary Shake-Up slide

**(i) Match Best Value Plays card style.** Reuse the existing `PodiumGrid` component (already used for Performances + Value Plays).
- Map each `SalaryShakeupRow` to a `PodiumItem`:
  - `statHeadline` = `"+$4.0M"` / `"−$4.2M"` Δ (colored amber for #1 via accent)
  - `stats` = `[["WAS", "$X.XM"], ["Δ", "±$Y.Y"], ["NOW", "$Z.ZM"]]`
  - `label` = `"Season Δ"` or `"Last Gameday"`
  - `accent` = `"emerald"` if highest delta is positive, otherwise `"amber"` (we'll add a small per-card tint via existing accent prop; keep #1 elevated like Best Value Plays).
- Delete the bespoke 3-card grid (lines ~1505–1556) and replace with `<PodiumGrid items={…} onPlayerClick={…} />`.

**(ii) Team-logo watermark (top-right).**
- Pick the player with the **highest positive** `delta` from `slide.payload.data.top` (fallback: largest absolute delta if all are negative — but spec says positive, so render watermark only when at least one positive exists).
- Render that team's logo (resolved via league-aware lookup: NBA → `getTeamLogo`, WNBA → `getWnbaTeamLogo`) as an absolutely-positioned `top-4 right-4` image, ~`h-40 w-40`, `opacity-10`, `mix-blend-luminosity`, pointer-events-none — same treatment as the existing Health Watch watermark.

### C. Health Watch slide watermark

- Swap the current `Shield` watermark (line 764–767) for the lucide `Bandage` icon (same icon used by `HealthStatusIcon` and rendered next to each injured player in the Roster Sidebar and Injury Report).
- Keep size/position/tint identical (`right-4 bottom-2 h-48 w-48 text-red-500/10`).
- Add the matching `import { Bandage } from "lucide-react"` and remove the `Shield` import only if unused elsewhere in the file (it's still used inside `HealthWatchSlide`'s "Your Roster" header — keep it for that, just don't use it for the watermark).

### Technical notes

- **Files edited (frontend):** `src/components/court-show/CourtShowSlide.tsx` (Salary Shake-Up rewrite + watermark, Health Watch watermark swap). League-aware logo helper: small local switch using `leagueCode` prop already received by `CourtShowSlide` plus `getWnbaTeamLogo` from `@/lib/wnba-teams`.
- **Files edited (backend):** `supabase/functions/court-show-intelligence/index.ts` (roster shortlist payload, stricter prompt, post-AI validator, stronger cache-pollution check). Bump cache invalidation by setting `force=true` for any row whose cards reference unknown players.
- **No DB migrations needed.**
- **No new dependencies.**

### Out of scope

- Re-styling the Best Value Plays slide itself.
- Changing the Ballers.IQ cache TTL or scheduling.
- Touching the Roster Sidebar / Injury Report icons.
