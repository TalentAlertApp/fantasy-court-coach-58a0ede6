
UPDATE players SET salary = 8.5, jersey = 23 WHERE id = 1630174;

UPDATE schedule_games SET tipoff_utc = tipoff_utc - INTERVAL '1 hour' WHERE tipoff_utc IS NOT NULL;
