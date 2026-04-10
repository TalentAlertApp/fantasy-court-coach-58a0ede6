

## Plan: Import Game Data for GW1 (Days 1-5) + Add GW25 Schedule (Days 4-6)

### Two tasks

**Task 1: Import the attached TSV (GW1 days 1-5)**
The commissioner page already supports TSV game data import. You just need to:
- Go to `/commissioner`
- Turn **OFF** the "Full replace" toggle (so existing GW2-25 data is preserved)
- Upload the attached `NBA_fantasy_API_-_1.1-1.5.tsv` file

No code changes needed for this.

**Task 2: Insert GW25 Days 4, 5, 6 schedule games from screenshots**
These games don't exist in the database yet. I'll insert them via a script that calls the Supabase client directly. Based on the screenshots:

- **Day 4** (Apr 10, 2026) — 6 games, times are Lisbon local. Some have scores (FINAL), some are scheduled:
  - MIA @ TOR (26-32, FINAL), CHI @ WAS (34-26, FINAL), IND @ BKN (4-3, appears in-progress/FINAL), BOS @ NYK (0-0, FINAL)
  - PHI @ HOU (01:00, SCHEDULED), LAL @ GSW (03:00, SCHEDULED)

- **Day 5** (Apr 11, 2026) — 15 games, all SCHEDULED (times in Lisbon timezone)

- **Day 6** (Apr 12-13, 2026) — 15 games, all SCHEDULED

Game IDs will continue sequentially from 22501165.

### Implementation
Write and execute a script that upserts ~36 `schedule_games` rows for GW25 days 4-6 with correct tipoff times (converted from Lisbon local to UTC — Lisbon is UTC+1 in April due to WEST), game IDs, team abbreviations, scores where applicable, and correct statuses.

### Files changed
| File | Action |
|------|--------|
| Script (one-off) | Insert GW25 day 4/5/6 schedule_games via Supabase |

No permanent code changes needed — just a data insertion script and the manual TSV upload.

