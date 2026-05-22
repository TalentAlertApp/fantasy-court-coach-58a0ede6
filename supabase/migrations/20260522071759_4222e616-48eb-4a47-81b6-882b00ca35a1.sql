UPDATE public.players p
SET nationality = v.nat
FROM (VALUES
(1631116,'USA'),(203552,'USA'),(1627746,'Haiti'),(1630649,'USA'),(1631211,'USA'),(1642400,'Netherlands'),(1642530,'Japan'),(1642468,'USA'),(1641761,'USA'),(1630165,'France'),(1641778,'USA'),(1631466,'USA'),(1642967,'USA'),(1642882,'USA'),(1641807,'Nicaragua'),(1643158,'Dominican Republic'),(1643052,'USA'),(1631223,'USA'),(1641771,'USA'),(1642951,'USA'),(1631174,'USA'),(1643016,'USA'),(1630610,'USA'),(201959,'USA'),(1641869,'USA'),(1630209,'Turkey'),(1643257,'USA'),(1642362,'USA'),(1642389,'USA'),(1631457,'USA'),(1642504,'USA'),(1631113,'USA'),(1628365,'USA'),(1629610,'USA'),(1630846,'France'),(1642380,'France'),(1641727,'USA'),(1631351,'USA'),(1643253,'USA'),(1630286,'USA'),(1642490,'USA')
) AS v(pid, nat),
public.leagues l
WHERE p.id = v.pid
  AND p.league_id = l.id
  AND l.code = 'nba';