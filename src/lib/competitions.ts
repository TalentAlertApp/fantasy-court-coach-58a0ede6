import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import euroleagueLogo from "@/assets/euroleague-logo.png";

/**
 * Competition registry — the single source of truth for which basketball
 * leagues this app supports and what behaviour each one unlocks.
 *
 * Adding a new competition should mean editing this file (plus a teams
 * catalog + a DB row in public.leagues). Everything downstream — selectors,
 * standings, advanced gating, edge-function validation — branches off this
 * registry instead of hardcoded "nba" | "wnba" literals.
 */

export type CompetitionCode = "nba" | "wnba" | "euroleague";

export type StandingsMode =
  | "conference_division"
  | "conference_only"
  | "single_table";

export interface Competition {
  code: CompetitionCode;
  label: string;
  shortLabel: string;
  season: string;
  /** Imported logo asset — use this when the logo is rendered inside the app bundle. */
  logo: string;
  /** Public-folder fallback path — handy for static contexts (emails, og images). */
  publicLogo: string;
  standingsMode: StandingsMode;
  hasAdvancedPlaySearch: boolean;
  hasConferences: boolean;
  hasDivisions: boolean;
  fantasyEnabled: boolean;
  /** Stable UUID of the matching row in public.leagues (kind='sport'). */
  sportLeagueId: string;
  /** Stable UUID of the canonical "Main League" fantasy row for this sport. */
  mainFantasyLeagueId: string;
  /** Subtle brand tint used by selector cards (Tailwind gradient stops). */
  tint: string;
}

export const COMPETITIONS: Record<CompetitionCode, Competition> = {
  nba: {
    code: "nba",
    label: "NBA",
    shortLabel: "NBA",
    season: "2025-26",
    logo: nbaLogo,
    publicLogo: "/leagues/nba.svg",
    standingsMode: "conference_division",
    hasAdvancedPlaySearch: true,
    hasConferences: true,
    hasDivisions: true,
    fantasyEnabled: true,
    sportLeagueId: "c4f2eb76-9ac4-4988-b402-5827aa41861b",
    mainFantasyLeagueId: "00000000-0000-0000-0000-000000000010",
    tint: "from-[#1d428a]/30 via-[#1d428a]/10 to-transparent",
  },
  wnba: {
    code: "wnba",
    label: "WNBA",
    shortLabel: "WNBA",
    season: "2025-26",
    logo: wnbaLogo,
    publicLogo: "/leagues/wnba.svg",
    standingsMode: "conference_only",
    hasAdvancedPlaySearch: true,
    hasConferences: true,
    hasDivisions: false,
    fantasyEnabled: true,
    sportLeagueId: "d9825d6d-67bf-417d-aca6-1b4481eb14b5",
    mainFantasyLeagueId: "00000000-0000-0000-0000-000000000020",
    tint: "from-[#ff6b00]/30 via-[#ff6b00]/10 to-transparent",
  },
  euroleague: {
    code: "euroleague",
    label: "EuroLeague",
    shortLabel: "EL",
    season: "2025-26",
    logo: euroleagueLogo,
    publicLogo: "/leagues/euroleague.svg",
    standingsMode: "single_table",
    hasAdvancedPlaySearch: false,
    hasConferences: false,
    hasDivisions: false,
    fantasyEnabled: true,
    sportLeagueId: "00000000-0000-0000-0000-000000000003",
    mainFantasyLeagueId: "00000000-0000-0000-0000-000000000030",
    tint: "from-[#fa5500]/30 via-[#fa5500]/10 to-transparent",
  },
};

export const ALL_COMPETITIONS: Competition[] = [
  COMPETITIONS.nba,
  COMPETITIONS.wnba,
  COMPETITIONS.euroleague,
];

export const FANTASY_COMPETITIONS: Competition[] = ALL_COMPETITIONS.filter(
  (c) => c.fantasyEnabled,
);

/** Type guard — true iff `code` is a known competition. */
export function isKnownCompetition(code: unknown): code is CompetitionCode {
  return code === "nba" || code === "wnba" || code === "euroleague";
}

/**
 * Strict lookup. Throws on unknown codes — never silently falls back to NBA.
 * Use this everywhere registry data is consumed.
 */
export function getCompetition(code: string | null | undefined): Competition {
  if (!isKnownCompetition(code)) {
    throw new Error(`Unknown competition code: ${String(code)}`);
  }
  return COMPETITIONS[code];
}

/** Non-throwing variant — returns null on unknown codes. */
export function tryGetCompetition(
  code: string | null | undefined,
): Competition | null {
  return isKnownCompetition(code) ? COMPETITIONS[code] : null;
}

/** Default competition for first-run users / unauthenticated previews. */
export const DEFAULT_COMPETITION: CompetitionCode = "nba";

/**
 * Resolve the bundled logo asset for a league code. Falls back to the NBA
 * logo for unknown codes so that legacy callers never render a broken image,
 * but new code should pass a validated CompetitionCode.
 */
export function getLeagueLogo(code: string | null | undefined): string {
  const comp = tryGetCompetition(code);
  return (comp ?? COMPETITIONS.nba).logo;
}
