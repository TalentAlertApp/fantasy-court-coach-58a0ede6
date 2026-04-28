/** Sub-filter mapping per Action Type for NBAPlayDB integration. */

export type ActionType =
  | "rebound" | "2pt" | "3pt" | "freethrow" | "block" | "steal"
  | "foul" | "turnover" | "violation" | "jumpball" | "ejection";

export const QUALIFIERS: Partial<Record<ActionType, string[]>> = {
  foul: ["2freethrow", "inpenalty", "1freethrow", "3freethrow"],
  "3pt": ["fromturnover", "fastbreak", "2ndchance"],
  "2pt": ["pointsinthepaint", "2ndchance", "fromturnover", "fastbreak", "defensivegoaltending"],
  freethrow: ["2ndchance", "fromturnover", "fastbreak"],
};

export const SUBTYPES: Partial<Record<ActionType, string[]>> = {
  foul: [
    "personal - shooting", "personal - loose ball", "personal - take", "personal - looseball",
    "technical - defensive-3-second", "offensive - off-the-ball", "personal", "offensive - charge",
    "personal - flagrant-type-1", "technical - defensive3second", "offensive", "personal - away-from-play",
    "personal - awayfromplay", "personal - flagranttype1", "offensive - offtheball", "personal -",
    "personal - flagrant-type-2", "technical - rim-hanging",
  ],
  rebound: ["defensive", "offensive", "defensive -", "offensive -"],
  "3pt": [
    "Jump Shot", "Jump Shot - running", "Jump Shot - pullup", "Jump Shot - running pullup",
    "Jump Shot - step back", "jumpshot - stepback", "jumpshot - running", "Jump Shot - turnaround",
    "Jump Shot - bank", "jumpshot -", "jumpshot - runningpullup",
  ],
  "2pt": [
    "Layup - driving", "Hook - turnaround", "Layup - cutting", "Hook - driving", "Layup - putback",
    "Layup - tip", "Jump Shot - floating", "Layup - running", "DUNK - cutting", "hook - turnaround",
    "Jump Shot - turnaround fadeaway", "DUNK - driving", "Layup - alley-oop", "Hook - turnaround bank",
    "DUNK - running", "Jump Shot - turnaround", "Jump Shot - driving floating", "Jump Shot - fadeaway",
    "Jump Shot - pullup", "jumpshot - turnaroundfadeaway", "layup - driving", "jumpshot - turnaround",
    "layup - tip", "Layup - driving finger roll", "Layup - reverse", "jumpshot - pullup",
    "jumpshot - stepback", "Jump Shot - turnaround bank", "Hook - bank",
  ],
  turnover: [
    "out-of-bounds - bad pass", "bad pass", "out-of-bounds - lost ball", "outofbounds - badpass",
    "out-of-bounds - step", "lost ball", "offensive foul", "badpass -", "outofbounds - lostball",
    "traveling",
  ],
  freethrow: ["1 of 2", "2 of 2", "1 of 1", "1 of 1 - technical", "1 of 2 - flagrant", "2 of 2 - flagrant"],
  jumpball: ["recovered - startperiod", "recovered - heldball", "recovered - challenge", "recovered - doubleviolation"],
};

export const SHOT_RESULT_ACTIONS: ActionType[] = ["3pt", "2pt"];
export const AFTER_TIMEOUT_ACTIONS: ActionType[] = ["foul", "3pt", "2pt", "turnover"];
export const BUZZER_BEATER_ACTIONS: ActionType[] = ["3pt", "2pt"];

export const AREA_ACTIONS: ActionType[] = ["foul", "rebound", "3pt", "2pt", "turnover", "block", "steal"];

export const AREA_VALUES = [
  "Restricted Area",
  "In The Paint (Non-RA)",
  "Mid-Range",
  "Above the Break 3",
  "Left Corner 3",
  "Right Corner 3",
] as const;
export type AreaValue = typeof AREA_VALUES[number];

export interface DistanceBounds { min: number; max: number; }
export const DISTANCE_BOUNDS: Partial<Record<ActionType, DistanceBounds>> = {
  "3pt": { min: 21, max: 71 },
  "2pt": { min: 0, max: 24 },
};

export interface SubFilterState {
  qualifiers: string[];
  subtype: string[];
  area: AreaValue[];
  shotresult: string[];
  isaftertimeout: boolean;
  isbuzzerbeater: boolean;
  shotdistancemin: number | null;
  shotdistancemax: number | null;
}

export const EMPTY_SUBFILTERS: SubFilterState = {
  qualifiers: [],
  subtype: [],
  area: [],
  shotresult: [],
  isaftertimeout: false,
  isbuzzerbeater: false,
  shotdistancemin: null,
  shotdistancemax: null,
};

/** Returns a pruned state where any value not applicable to the active action set is dropped. */
export function pruneSubFilters(state: SubFilterState, actions: ActionType[]): SubFilterState {
  const active = new Set(actions);
  const allowed = (kind: "qualifiers" | "subtype", list: string[]) => {
    const map = kind === "qualifiers" ? QUALIFIERS : SUBTYPES;
    const pool = new Set<string>();
    for (const a of actions) for (const v of map[a] ?? []) pool.add(v);
    return list.filter((v) => pool.has(v));
  };
  const next: SubFilterState = {
    qualifiers: allowed("qualifiers", state.qualifiers),
    subtype: allowed("subtype", state.subtype),
    area: AREA_ACTIONS.some((a) => active.has(a)) ? state.area : [],
    shotresult: SHOT_RESULT_ACTIONS.some((a) => active.has(a)) ? state.shotresult : [],
    isaftertimeout: AFTER_TIMEOUT_ACTIONS.some((a) => active.has(a)) ? state.isaftertimeout : false,
    isbuzzerbeater: BUZZER_BEATER_ACTIONS.some((a) => active.has(a)) ? state.isbuzzerbeater : false,
    shotdistancemin: state.shotdistancemin,
    shotdistancemax: state.shotdistancemax,
  };
  // distance only when 2pt/3pt selected
  if (!actions.some((a) => DISTANCE_BOUNDS[a])) {
    next.shotdistancemin = null;
    next.shotdistancemax = null;
  }
  return next;
}

/** Effective distance bounds across active actions (union). */
export function distanceBoundsFor(actions: ActionType[]): DistanceBounds | null {
  const bounds = actions.map((a) => DISTANCE_BOUNDS[a]).filter(Boolean) as DistanceBounds[];
  if (bounds.length === 0) return null;
  return {
    min: Math.min(...bounds.map((b) => b.min)),
    max: Math.max(...bounds.map((b) => b.max)),
  };
}