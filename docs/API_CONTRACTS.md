# API Contracts — NBA Fantasy Manager

> **This file is the source of truth.** Do not edit without updating `src/lib/contracts.ts` in lockstep.
>
> Placeholder — the user will paste the full spec here.

## Global Rules

1. Every `/api/v1/*` route **must** `Schema.parse(response)` before returning.
2. Every client fetch **must** `Schema.parse(json)` before rendering.
3. Missing fields must be `null`, never `undefined`.
4. AI endpoints must return **JSON only** and must validate with Zod; retry once if invalid.
5. Envelope: `{ ok: true, data: T }` or `{ ok: false, data: null, error: { code, message, details } }`.

## Scoring Rules

| Stat | Points |
|------|--------|
| PTS  | 1      |
| REB  | 1      |
| AST  | 2      |
| STL  | 3      |
| BLK  | 3      |

## Endpoints

| Method | Path | Request | Response Schema |
|--------|------|---------|-----------------|
| GET | `/api/v1/health` | — | `HealthResponseSchema` |
| GET | `/api/v1/players` | query params | `PlayersListResponseSchema` |
| GET | `/api/v1/players/{id}` | — | `PlayerDetailResponseSchema` |
| GET | `/api/v1/last-game` | — | `LastGameBulkResponseSchema` |
| GET | `/api/v1/roster/current` | — | `RosterCurrentResponseSchema` |
| POST | `/api/v1/roster/save` | `RosterSaveBodySchema` | `RosterSaveResponseSchema` |
| POST | `/api/v1/roster/auto-pick` | `RosterAutoPickBodySchema` | `RosterAutoPickResponseSchema` |
| POST | `/api/v1/transactions/simulate` | `TransactionsSimulateBodySchema` | `TransactionsSimulateResponseSchema` |
| POST | `/api/v1/transactions/commit` | — | `TransactionsCommitResponseSchema` |
| GET | `/api/v1/schedule` | — | `ScheduleResponseSchema` |
| GET | `/api/v1/schedule/impact` | — | `ScheduleImpactResponseSchema` |
| POST | `/api/v1/ai/suggest-transfers` | `AISuggestTransfersBodySchema` | `AISuggestTransfersResponseSchema` |
| POST | `/api/v1/ai/pick-captain` | `AIPickCaptainBodySchema` | `AIPickCaptainResponseSchema` |
| POST | `/api/v1/ai/explain-player` | `AIExplainPlayerBodySchema` | `AIExplainPlayerResponseSchema` |
