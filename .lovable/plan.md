

## Fix Player Database Import: TSV Support + New URL Field

### Problem
The Commissioner page currently expects CSV files, but the actual player database is in TSV (tab-separated) format. It also has a new `URL` column (NBA.com player page) and a `$` (salary) column that needs to be imported. The existing player data should be fully replaced on each import.

### Changes

**1. Database migration — add `nba_url` column to `players` table**
```sql
ALTER TABLE players ADD COLUMN nba_url text;
```

**2. Update `CommissionerPage.tsx`**
- Change file accept from `.csv` to `.tsv,.csv,.txt`
- Replace CSV parser with TSV parser (split on `\t` instead of comma)
- Map the new columns: `URL` → `nba_url`, `$` → `salary`
- Parse salary format `"22,0"` → `22.0` (comma as decimal separator)
- Update UI labels to say "TSV" instead of "CSV"
- Always send `replace: true` to wipe old data

**3. Update `import-players/index.ts` edge function**
- Accept `nba_url` and `salary` fields from the payload
- Include `salary` and `nba_url` in the upsert row
- Before upserting, delete ALL existing players (full wipe), then insert fresh
- This makes the TSV the single source of truth

### Data mapping (TSV columns → DB columns)
| TSV Header | DB Column | Notes |
|------------|-----------|-------|
| URL | nba_url | NBA.com player page |
| ID | id | Integer PK |
| PHOTO | photo | CDN headshot URL |
| NAME | name | |
| TEAM | team | 3-letter abbr |
| FC_BC | fc_bc | FC or BC |
| $ | salary | "22,0" → 22.0 |
| # | jersey | Integer |
| COLLEGE | college | "None" → null |
| WEIGHT | weight | Integer |
| HEIGHT | height | e.g. 6'11" |
| AGE | age | Integer (also calc from DOB) |
| DOB | dob | Various date formats |
| EXP | exp | Integer |
| POS | pos | e.g. C, PF, PG |

### Files changed
| File | Action |
|------|--------|
| Migration | Add `nba_url` text column to `players` |
| `src/pages/CommissionerPage.tsx` | TSV parsing, new fields, updated UI |
| `supabase/functions/import-players/index.ts` | Handle `nba_url` + `salary`, full wipe mode |

