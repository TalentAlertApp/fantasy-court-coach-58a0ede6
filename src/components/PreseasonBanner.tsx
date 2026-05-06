import { useLeague } from "@/contexts/LeagueContext";
import { useIsPreseason } from "@/hooks/useIsPreseason";
import { Info } from "lucide-react";

/**
 * Sticky banner shown only in WNBA mode while no game logs exist yet.
 * Tells the user the app is in pre-season state so empty stats and
 * disabled projections don't look broken.
 */
export default function PreseasonBanner() {
  const { isWnba } = useLeague();
  const { data: preseason } = useIsPreseason();
  if (!isWnba || !preseason) return null;
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-200 flex items-center gap-2">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>WNBA 2026 — Pre-season mode.</strong>{" "}
        Player stats, projections and value scores are unavailable until game data is imported.
        Schedule, rosters and salaries are live.
      </span>
    </div>
  );
}