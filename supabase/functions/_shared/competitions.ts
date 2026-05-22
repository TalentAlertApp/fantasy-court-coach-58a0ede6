// Mirror of src/lib/competitions.ts for edge functions.
// Keep these in sync — both files describe the same registry.
export type CompetitionCode = "nba" | "wnba" | "euroleague";

export const KNOWN_COMPETITIONS: ReadonlyArray<CompetitionCode> = ["nba", "wnba", "euroleague"];

export function isKnownCompetition(code: unknown): code is CompetitionCode {
  return code === "nba" || code === "wnba" || code === "euroleague";
}

/** Strict lookup — throws on unknown codes. No silent fallback. */
export function assertCompetition(code: unknown): CompetitionCode {
  if (!isKnownCompetition(code)) {
    throw new Error(`Unknown competition code: ${String(code)}`);
  }
  return code;
}
