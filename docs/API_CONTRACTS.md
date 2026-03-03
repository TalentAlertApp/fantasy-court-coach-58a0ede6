# NBA Fantasy Manager (Private)

Version: 1.0

Status: IMMUTABLE CONTRACT

Audience: Backend, Edge Functions, Frontend, AI Layer

> **This file is the source of truth.** Do not edit without updating `src/lib/contracts.ts` in lockstep.

---------------------------------------------------------------------

## SECTION 1 — CORE PRINCIPLES

### 1.1 Single User Application

This is a private, single-user NBA Fantasy Manager.

No multi-tenant logic required.

### 1.2 Data Sources

**Current Mode (MVP):**

- Data originates from an external Python pipeline.
- Pipeline writes to a private Google Sheet.
- The web app must read via server-side proxy (Edge Function).
- The browser must never access Google APIs directly.

**Future Mode:**

- Pipeline will write directly to Supabase.
- Frontend must not change.
- Controlled by:

```
DATA_SOURCE_MODE = "sheet" | "supabase"
```

Default: `"sheet"`

---------------------------------------------------------------------

## SECTION 2 — GLOBAL RULES (NON-NEGOTIABLE)

### 2.1 Fantasy Scoring Rule (GLOBAL CONSTANT)

```
FP = PTS*1 + REB*1 + AST*2 + STL*3 + BLK*3
```

This rule must be used consistently in:

- Backend calculations
- Optimizer logic
- AI reasoning
- UI displays

### 2.2 Positions

Players only have:

```
"FC" | "BC"
```

All player objects must include:

```
fc_bc: "FC" | "BC"
```

### 2.3 Numeric Policy

All numeric values must be JSON numbers.

Correct:
```json
"salary": 18.5
```

Incorrect:
```json
"salary": "18.5"
```

Applies to: Salary, FP, Value, Stats, Projections, Deltas.

### 2.4 Null Policy

If data is missing:

- Return `null`
- Do NOT omit keys
- Do NOT return empty strings

Correct:
```json
"injury": null
```

### 2.5 Date Formats

| Type     | Format                       |
|----------|------------------------------|
| Date     | `YYYY-MM-DD`                 |
| Datetime | `YYYY-MM-DDTHH:mm:ssZ`      |

### 2.6 Envelope Policy (ALL ENDPOINTS)

Every endpoint must return one of:

**SUCCESS:**
```json
{
  "ok": true,
  "data": { }
}
```

**ERROR:**
```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": "Optional extra info or null"
  }
}
```

No exceptions.

### 2.7 Zod Enforcement

- **Backend:** Every `/api/v1/*` route must validate output using Zod before returning JSON.
- **Client:** Every fetch must validate response using Zod before rendering.

---------------------------------------------------------------------

## SECTION 3 — SHARED DATA TYPES

### 3.1 PlayerCore

```json
{
  "id": 0,
  "name": "string",
  "team": "string",
  "fc_bc": "FC",
  "photo": "string|null",
  "salary": 0,
  "jersey": 0,
  "pos": "string|null",
  "height": "string|null",
  "weight": 0,
  "age": 0,
  "dob": "YYYY-MM-DD|null",
  "exp": 0,
  "college": "string|null"
}
```

### 3.2 PlayerSeason

```json
{
  "gp": 0,
  "mpg": 0,
  "pts": 0,
  "reb": 0,
  "ast": 0,
  "stl": 0,
  "blk": 0,
  "fp": 0
}
```

### 3.3 PlayerLast5

```json
{
  "mpg5": 0,
  "pts5": 0,
  "reb5": 0,
  "ast5": 0,
  "stl5": 0,
  "blk5": 0,
  "fp5": 0
}
```

### 3.4 PlayerLastGame

```json
{
  "date": "YYYY-MM-DD|null",
  "opp": "string|null",
  "home_away": "H|A|null",
  "result": "string|null",
  "a_pts": 0,
  "h_pts": 0,
  "mp": 0,
  "pts": 0,
  "reb": 0,
  "ast": 0,
  "stl": 0,
  "blk": 0,
  "fp": 0,
  "nba_game_url": "string|null"
}
```

### 3.5 PlayerComputed

```json
{
  "value": 0,
  "value5": 0,
  "stocks": 0,
  "stocks5": 0,
  "delta_mpg": 0,
  "delta_fp": 0
}
```

### 3.6 PlayerFlags

```json
{
  "injury": "OUT|Q|DTD|null",
  "note": "string|null"
}
```

### 3.7 PlayerListItem

```json
{
  "core": { },
  "season": { },
  "last5": { },
  "lastGame": { },
  "computed": { },
  "flags": { }
}
```

### 3.8 RosterSnapshot

```json
{
  "gw": 0,
  "day": 0,
  "deadline_utc": "YYYY-MM-DDTHH:mm:ssZ|null",
  "starters": [0,0,0,0,0],
  "bench": [0,0,0,0,0],
  "captain_id": 0,
  "bank_remaining": 0,
  "free_transfers_remaining": 0,
  "constraints": {
    "salary_cap": 0,
    "starters_count": 5,
    "bench_count": 5,
    "starter_fc_min": 2,
    "starter_bc_min": 2
  },
  "updated_at": "YYYY-MM-DDTHH:mm:ssZ|null"
}
```

### 3.9 ScheduleGame

```json
{
  "game_id": "string",
  "gw": 0,
  "day": 0,
  "tipoff_utc": "YYYY-MM-DDTHH:mm:ssZ|null",
  "away_team": "string",
  "home_team": "string",
  "away_pts": 0,
  "home_pts": 0,
  "status": "SCHEDULED|FINAL",
  "nba_game_url": "string|null"
}
```

---------------------------------------------------------------------

## SECTION 4 — ENDPOINT CONTRACTS

Base path: `/api/v1/`

### 4.1 GET /health

```json
{
  "ok": true,
  "data": {
    "data_source_mode": "sheet|supabase",
    "server_time_utc": "YYYY-MM-DDTHH:mm:ssZ",
    "scoring_rules": { "pts":1, "reb":1, "ast":2, "stl":3, "blk":3 }
  }
}
```

### 4.2 GET /players

```json
{
  "ok": true,
  "data": {
    "meta": {
      "count": 0,
      "limit": 50,
      "offset": 0,
      "sort": "value5",
      "order": "desc"
    },
    "items": [ "PlayerListItem" ]
  }
}
```

### 4.3 GET /players/{id}

```json
{
  "ok": true,
  "data": {
    "player": "PlayerListItem",
    "history": [],
    "upcoming": []
  }
}
```

Arrays must exist even if empty.

### 4.4 GET /roster/current

```json
{
  "ok": true,
  "data": {
    "roster": "RosterSnapshot"
  }
}
```

### 4.5 POST /roster/save

Body:
```json
{
  "gw": 0,
  "day": 0,
  "starters": [5, "ids"],
  "bench": [5, "ids"],
  "captain_id": 0
}
```

### 4.6 POST /roster/auto-pick

Body:
```json
{
  "gw": 0,
  "day": 0,
  "strategy": "value5|fp5"
}
```

### 4.7 POST /transactions/simulate

Body:
```json
{
  "gw": 0,
  "day": 0,
  "adds": [],
  "drops": []
}
```

### 4.8 POST /transactions/commit

Returns updated roster + transaction record.

### 4.9 GET /schedule

```json
{
  "ok": true,
  "data": {
    "gw": 0,
    "day": 0,
    "games": [ "ScheduleGame" ]
  }
}
```

### 4.10 GET /schedule/impact

```json
{
  "ok": true,
  "data": {
    "games": [
      {
        "game": "ScheduleGame",
        "my_players": [
          { "id": 0, "name": "string", "team": "string", "proj_fp": 0 }
        ]
      }
    ]
  }
}
```

---------------------------------------------------------------------

## SECTION 5 — AI ENDPOINTS (STRICT JSON ONLY)

### 5.1 Requirements

- Use secret: `OPENAI_API_KEY_NBA`
- Model: `gpt-4.1-mini`
- Must enable web search tool
- Must return JSON only (no markdown, no prose)
- Must validate with Zod before returning
- Retry once if invalid JSON
- Never auto-commit roster changes

### 5.2 POST /ai/suggest-transfers

```json
{
  "ok": true,
  "data": {
    "moves": [
      {
        "add": 0,
        "drop": 0,
        "reason_bullets": [],
        "expected_delta": {
          "proj_fp5": 0,
          "proj_stocks5": 0,
          "proj_ast5": 0
        },
        "risk_flags": [],
        "confidence": 0
      }
    ],
    "notes": []
  }
}
```

### 5.3 POST /ai/pick-captain

```json
{
  "ok": true,
  "data": {
    "captain_id": 0,
    "alternatives": [],
    "reason_bullets": [],
    "confidence": 0
  }
}
```

### 5.4 POST /ai/explain-player

```json
{
  "ok": true,
  "data": {
    "summary": "string",
    "why_it_scores": [],
    "trend_flags": [],
    "recommendation": {
      "action": "add|hold|drop",
      "rationale": "string"
    }
  }
}
```

---------------------------------------------------------------------

## SECTION 6 — DEFINITION OF DONE

A feature is complete only if:

- All endpoints validate against Zod schemas.
- All numeric fields are numbers.
- No key is missing (use `null`).
- AI endpoints return strict JSON only.
- Secrets are never exposed to client.
- Google Sheet access is server-side only.
- Frontend does not depend on data source mode.

---------------------------------------------------------------------

**END OF CONTRACT**
