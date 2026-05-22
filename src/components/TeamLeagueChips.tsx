import { useFantasyLeagues, MAIN_LEAGUE_NBA_ID, MAIN_LEAGUE_WNBA_ID } from "@/hooks/useFantasyLeagues";

const MAIN_IDS = new Set<string>([MAIN_LEAGUE_NBA_ID, MAIN_LEAGUE_WNBA_ID]);

interface Props {
  leagueIds: string[];
  /** Primary league id — rendered first and visually emphasized. */
  primaryId?: string | null;
  size?: "xs" | "sm";
  className?: string;
  /** Max chips to show before collapsing into a "+N" pill. */
  max?: number;
}

/**
 * Compact row of pills naming each fantasy league a team participates in.
 * Reads names from useFantasyLeagues (already cached). Falls back to the raw
 * id if a league is unknown to the caller (e.g. private league they can't see).
 */
export default function TeamLeagueChips({
  leagueIds,
  primaryId,
  size = "xs",
  className = "",
  max = 4,
}: Props) {
  const { data: leagues } = useFantasyLeagues();
  const byId = new Map<string, { name: string; sport: "nba" | "wnba" | "euroleague" }>();
  for (const l of leagues ?? []) byId.set(l.id, { name: l.name, sport: l.sport });

  const ordered = [...leagueIds].sort((a, b) => {
    if (primaryId) {
      if (a === primaryId) return -1;
      if (b === primaryId) return 1;
    }
    return 0;
  });

  const shown = ordered.slice(0, max);
  const overflow = ordered.length - shown.length;

  const padding = size === "xs" ? "px-1.5 py-[1px] text-[9px]" : "px-2 py-0.5 text-[10px]";

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {shown.map((id) => {
        const meta = byId.get(id);
        const isMain = MAIN_IDS.has(id);
        const label = isMain
          ? `Main · ${id === MAIN_LEAGUE_WNBA_ID ? "WNBA" : "NBA"}`
          : (meta?.name ?? "League");
        const tone = isMain
          ? "bg-accent/15 text-accent border-accent/30"
          : "bg-foreground/[0.06] text-foreground/70 border-foreground/15";
        return (
          <span
            key={id}
            title={meta?.name ?? label}
            className={`inline-flex items-center max-w-[140px] truncate rounded-full border uppercase tracking-[0.18em] font-heading ${padding} ${tone}`}
          >
            <span className="truncate">{label}</span>
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className={`inline-flex items-center rounded-full border border-foreground/15 bg-foreground/[0.04] text-foreground/60 uppercase tracking-[0.18em] font-heading ${padding}`}
          title={`${overflow} more league${overflow === 1 ? "" : "s"}`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}