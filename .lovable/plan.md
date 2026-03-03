

## Plan: Add `docs/AI_SYSTEM_PROMPT.md`

### Single change

Create `docs/AI_SYSTEM_PROMPT.md` with the full immutable system prompt the user provided. This file will be the source of truth for all AI endpoint behavior (used by the edge functions for `/ai/suggest-transfers`, `/ai/pick-captain`, `/ai/explain-player`).

No other files change. The prompt will be consumed by AI edge functions when they are implemented — they will read this content and pass it as the `system` message to `gpt-4.1-mini`.

### File

- **`docs/AI_SYSTEM_PROMPT.md`** — verbatim content as provided, covering: Role, Non-negotiable Rules, Tools, Constraints, Endpoint-specific Output, Style, Missing Data handling, Safety.

