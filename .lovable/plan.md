## 1. Outstanding Game — add NBA/WNBA league watermark

**File:** `src/components/court-show/CourtShowSlide.tsx`

Extend the slide-chrome watermark logic (around line 1163) so the `outstanding` kind uses the league logo, exactly like `recap`:

```ts
const useLeagueWatermark =
  slide.payload.kind === "recap" || slide.payload.kind === "outstanding";
```

Result: the same NBA/WNBA league logo currently behind Recap slides is rendered behind the Outstanding Game slide (oversized, blurred, `opacity-[0.10]`, top-right) — sitting behind the YouTube recap container without affecting the iframe (already `relative z-[1]` on header/content).

No other Outstanding slide layout changes.

## 2. Ballers.IQ — close the remaining NBA→WNBA leak

The current `court-show-intelligence` validator drops cards that mention **off-slate tricodes** (e.g. `POR`, `TOR`) and **foreign player names** (e.g. "Anthony Edwards"). It still misses cards like:

> "STABLE ROTATIONS FOR TRAIL BLAZERS AND RAPTORS — … Portland and Toronto …"

because the body uses **city / nickname strings** (`Portland`, `Toronto`, `Trail Blazers`, `Raptors`, `Bulls`, `Timberwolves`) instead of tricodes or two-word player names. The card field `team: "POR"` *would* trip the existing tricode check, but for stale cache rows the regen loop can still surface similar copy.

### Fix (file: `supabase/functions/court-show-intelligence/index.ts`)

**a) Build a foreign-team-name blocklist.** Hardcode the NBA and WNBA full team rosters as `{ city, nickname, fullName }`. Compute:
- `foreignTeamTerms` = all city + nickname + fullName strings belonging to the *other* league that are NOT also valid for the current league's slate teams.
- Example for a WNBA slate: includes `"Portland"`, `"Toronto"`, `"Trail Blazers"`, `"Raptors"`, `"Bulls"`, `"Timberwolves"`, `"Anthony Edwards"`-style names are already covered separately.

**b) Add `containsForeignTeamTerm(text)`** — case-insensitive substring scan over headline+body.

**c) Wire into both checks:**
- **Post-AI validator:** drop the card if `containsForeignTeamTerm` matches.
- **Cache pollution check:** if any cached card matches, set `offSlate = true` so the row is regenerated.

**d) Strengthen the prompt** with one extra hard rule:
> "Never reference any team by city, nickname, or full name that is not in `slateTeams`. Use only the tricodes listed in `slateTeams`."

**e) Inject `slateTeamNames`** (city + nickname per slate team) into the user payload so the model has the allowed vocabulary explicitly.

**f) One-shot cache flush:** bump an internal `VALIDATOR_VERSION` constant and store it on the cached row; on read, if the stored version is missing or older than current, treat the row as stale and regenerate. This guarantees existing polluted WNBA rows (which pre-date this fix) are rebuilt on next view without needing a manual `force`.

### Deploy
Redeploy `court-show-intelligence` after the edit.

### Scope guardrails
- No DB schema changes.
- No changes to other slides, layouts, or to Captain Radar / Salary Shake-Up / Health Watch behaviour.
- Frontend change limited to a single boolean expression.
