-- Backfill YouTube recap IDs for 13 NBA games (manual lookup from official NBA channel)
UPDATE public.schedule_games SET youtube_recap_id = v.yt FROM (VALUES
  ('22500242','gXOoBwtRspY'),
  ('22500239','WMK9ZXccrQ8'),
  ('22500240','0plB3_SpzSI'),
  ('22500238','AnC3bD93VL4'),
  ('22500236','unEn-50K-Bo'),
  ('22500237','qGJJVD3Ty1g'),
  ('22500235','g-vBVhWzDf4'),
  ('22500234','isjgI-qvpo8'),
  ('22500229','ybLHKu0s0BE'),
  ('22500230','Esc_LUMc9j0'),
  ('22500228','0H74F7Z7iN0'),
  ('22500222','rAPMlyV0rzE'),
  ('22500175','b37w1dUlSMw')
) AS v(gid, yt)
WHERE schedule_games.game_id = v.gid
  AND schedule_games.league_id = 'c4f2eb76-9ac4-4988-b402-5827aa41861b';
