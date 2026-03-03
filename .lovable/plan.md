

## Plan: Full AI Coach (Prompt 3)

Implements 5 AI endpoints via a single `ai-coach` edge function, wires the AI Hub UI, and adds "Explain" to PlayerModal. Uses `OPENAI_API_KEY_NBA` (already configured) with `gpt-4.1-mini` and OpenAI's built-in web search tool.

---

### 1. Add Zod Schemas for 2 New AI Endpoints

**`src/lib/contracts.ts`** — append schemas for:

- **`AIAnalyzeRosterBodySchema`**: `{ gw, day, focus: "lineup"|"waiver"|"trade"|"balanced" }`
- **`AIAnalyzeRosterPayloadSchema`**: `{ summary_bullets[], strengths[], weaknesses[], quick_wins[{title, why[], risk_flags[], confidence}], recommended_actions[{type, note}], notes[] }`
- **`AIAnalyzeRosterResponseSchema`**: envelope wrapper

- **`AIInjuryMonitorBodySchema`**: `{ player_ids: number[], include_replacements: boolean, max_salary: number|null }`
- **`AIInjuryMonitorPayloadSchema`**: `{ items[{player_id, status, headline, impact, recommended_move:{action, replacement_targets[]}, risk_flags[]}], notes[] }`
- **`AIInjuryMonitorResponseSchema`**: envelope wrapper

---

### 2. Single Edge Function: `ai-coach`

**`supabase/functions/ai-coach/index.ts`** — handles all 5 AI actions via `action` field in request body.

Pattern:
1. Parse `action` from body (`suggest-transfers`, `pick-captain`, `explain-player`, `analyze-roster`, `injury-monitor`)
2. Fetch internal context: call the Supabase `players` table + `roster` table + `schedule_games` table directly using service role key
3. Build system prompt from `docs/AI_SYSTEM_PROMPT.md` content (embedded as string constant in the function)
4. Build developer message with the specific endpoint's JSON schema description and the internal data payload
5. Call OpenAI Responses API (`https://api.openai.com/v1/responses`):
   - model: `gpt-4.1-mini`
   - tools: `[{ type: "web_search_preview" }]` for real-time NBA data
   - instructions: system prompt
   - input: developer message + user context
6. Parse AI output as JSON
7. Validate against the appropriate Zod-like schema (manual validation in Deno since we can't import from `src/`)
8. If invalid: retry ONCE with corrective instruction
9. If still invalid: return `{ ok: false, error: { code: "AI_SCHEMA_INVALID", ... } }`
10. Return envelope response

**`supabase/config.toml`** — add `[functions.ai-coach]` with `verify_jwt = false`

---

### 3. Client API Fetchers

**`src/lib/api.ts`** — add 5 new functions:

- `aiSuggestTransfers(body)` → POST `ai-coach` with `action: "suggest-transfers"`
- `aiPickCaptain(body)` → POST `ai-coach` with `action: "pick-captain"`
- `aiExplainPlayer(body)` → POST `ai-coach` with `action: "explain-player"`
- `aiAnalyzeRoster(body)` → POST `ai-coach` with `action: "analyze-roster"`
- `aiInjuryMonitor(body)` → POST `ai-coach` with `action: "injury-monitor"`

All validate responses with corresponding Zod schemas from contracts.ts.

---

### 4. AI Hub Page (`/ai`)

**`src/pages/AIHubPage.tsx`** — replace shell with 5 interactive panels:

1. **Analyze My Roster** — button triggers `aiAnalyzeRoster`, renders summary bullets, strengths/weaknesses, quick wins with confidence badges, recommended actions
2. **Best Captain Today** — button triggers `aiPickCaptain`, shows captain recommendation + alternatives, "Apply Captain" button → calls `saveRoster`
3. **Suggest 3 Transfers** — button triggers `aiSuggestTransfers`, shows move cards with add/drop, reason bullets, deltas, risk flags. "Simulate" → "Commit" flow via transactions endpoints
4. **Scan Injuries** — button triggers `aiInjuryMonitor` with roster player IDs, shows status badges (OUT/Q/DTD/ACTIVE), impact level, replacement suggestions
5. **Explain Player** — search/select input, triggers `aiExplainPlayer`, shows summary, scoring factors, trend flags, recommendation

Each panel shows loading state, error handling, and renders confidence scores + risk flags.

**Apply flows (no auto-commit):**
- Captain → "Apply Captain" button → `saveRoster` with updated `captain_id`
- Transfers → "Simulate" → `simulateTransactions` → "Commit" → `commitTransaction`
- Lineup swaps → "Apply Lineup" → `saveRoster`

---

### 5. PlayerModal "Explain" Tab

**`src/components/PlayerModal.tsx`** — add an "AI Explain" tab:
- Button "Ask AI" triggers `aiExplainPlayer({ player_id })`
- Shows summary, scoring factors, trend flags, recommendation badge
- Loading spinner while AI responds

---

### 6. Implementation Order

1. Add 2 new Zod schemas to `contracts.ts`
2. Create `ai-coach` edge function with all 5 action handlers
3. Add to `config.toml`
4. Add 5 client fetchers to `api.ts`
5. Rewrite `AIHubPage.tsx` with interactive panels
6. Add "AI Explain" tab to `PlayerModal.tsx`
7. Deploy and test

~4 files modified, 1 new file created.

