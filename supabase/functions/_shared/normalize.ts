/**
 * Transform raw Google Sheet rows into contract-shaped objects.
 * Handles European decimals, date normalization, OPP parsing.
 */

// deno-lint-ignore-file no-explicit-any

/** Parse European decimal: "22,5" → 22.5, "22" → 22, "" → 0 */
export function euNum(val: string | undefined | null): number {
  if (!val || val.trim() === "" || val === "-") return 0;
  return Number(val.replace(",", ".")) || 0;
}

export function euInt(val: string | undefined | null): number {
  return Math.round(euNum(val));
}

/** "None" or empty → null */
function nullable(val: string | undefined | null): string | null {
  if (!val || val.trim() === "" || val === "None" || val === "none") return null;
  return val;
}

/** D/M/YYYY → YYYY-MM-DD */
function normDate(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // D/M/YYYY or DD/MM/YYYY
  const parts = val.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** Parse OPP field: "@LAL" → { opp: "LAL", home_away: "A" }, "BOS" → { opp: "BOS", home_away: "H" } */
function parseOpp(val: string | undefined | null): { opp: string | null; home_away: "H" | "A" | null } {
  if (!val || val.trim() === "") return { opp: null, home_away: null };
  const trimmed = val.trim();
  if (trimmed.startsWith("@")) {
    return { opp: trimmed.slice(1), home_away: "A" };
  }
  return { opp: trimmed, home_away: "H" };
}

/** Parse result field to extract W/L result string */
function parseResult(aPts: number, hPts: number, homeAway: "H" | "A" | null): string | null {
  if (aPts === 0 && hPts === 0) return null;
  if (homeAway === "H") return hPts > aPts ? "W" : "L";
  if (homeAway === "A") return aPts > hPts ? "W" : "L";
  return null;
}

export interface PlayerListItem {
  core: {
    id: number;
    name: string;
    team: string;
    fc_bc: "FC" | "BC";
    photo: string | null;
    salary: number;
    jersey: number;
    pos: string | null;
    height: string | null;
    weight: number;
    age: number;
    dob: string | null;
    exp: number;
    college: string | null;
  };
  season: {
    gp: number;
    mpg: number;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    fp: number;
  };
  last5: {
    mpg5: number;
    pts5: number;
    reb5: number;
    ast5: number;
    stl5: number;
    blk5: number;
    fp5: number;
  };
  lastGame: {
    date: string | null;
    opp: string | null;
    home_away: "H" | "A" | null;
    result: string | null;
    a_pts: number;
    h_pts: number;
    mp: number;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    fp: number;
    nba_game_url: string | null;
  };
  computed: {
    value: number;
    value5: number;
    stocks: number;
    stocks5: number;
    delta_mpg: number;
    delta_fp: number;
  };
  flags: {
    injury: "OUT" | "Q" | "DTD" | null;
    note: string | null;
  };
}

/**
 * Convert a raw sheet row (columns A-AV, 0-indexed) into a PlayerListItem.
 * Column mapping from plan.md section 6.
 */
export function rowToPlayer(row: string[]): PlayerListItem {
  const col = (i: number) => row[i] ?? "";

  const salary = euNum(col(5));
  const fpT = euNum(col(21));   // V: FP_PG_T
  const valueT = euNum(col(23)); // X: Value_T
  const fp5 = euNum(col(31));   // AF: FP_PG5
  const value5 = euNum(col(33)); // AH: Value5

  const mpg = euNum(col(15));
  const mpg5 = euNum(col(25));
  const stl = euNum(col(20));
  const blk = euNum(col(19));
  const stl5 = euNum(col(30));
  const blk5 = euNum(col(29));

  const { opp, home_away } = parseOpp(col(35)); // AJ: OPP
  const aPts = euInt(col(36)); // AK
  const hPts = euInt(col(37)); // AL

  const fcBc = col(4).trim().toUpperCase();

  return {
    core: {
      id: euInt(col(0)),
      name: col(2),
      team: col(3),
      fc_bc: (fcBc === "FC" || fcBc === "BC" ? fcBc : "FC") as "FC" | "BC",
      photo: nullable(col(1)),
      salary,
      jersey: euInt(col(6)),
      pos: nullable(col(13)),
      height: nullable(col(9)),
      weight: euInt(col(8)),
      age: euInt(col(10)),
      dob: normDate(col(11)),
      exp: euInt(col(12)),
      college: nullable(col(7)),
    },
    season: {
      gp: euInt(col(14)),
      mpg,
      pts: euNum(col(16)),
      reb: euNum(col(18)),
      ast: euNum(col(17)),
      stl,
      blk,
      fp: fpT,
    },
    last5: {
      mpg5,
      pts5: euNum(col(26)),
      reb5: euNum(col(28)),
      ast5: euNum(col(27)),
      stl5,
      blk5,
      fp5,
    },
    lastGame: {
      date: normDate(col(34)), // AI: LAST_GAME
      opp,
      home_away,
      result: parseResult(aPts, hPts, home_away),
      a_pts: aPts,
      h_pts: hPts,
      mp: euInt(col(38)),  // AM: MIN
      pts: euInt(col(39)), // AN: P
      reb: euInt(col(41)), // AP: R
      ast: euInt(col(40)), // AO: A
      stl: euInt(col(43)), // AR: S
      blk: euInt(col(42)), // AQ: B
      fp: euNum(col(45)),  // AT: FP_L
      nba_game_url: nullable(col(44)), // AS: LINK
    },
    computed: {
      value: valueT,
      value5,
      stocks: stl + blk,
      stocks5: stl5 + blk5,
      delta_mpg: mpg5 - mpg,
      delta_fp: fp5 - fpT,
    },
    flags: {
      injury: null, // Not in current sheet columns
      note: null,
    },
  };
}
