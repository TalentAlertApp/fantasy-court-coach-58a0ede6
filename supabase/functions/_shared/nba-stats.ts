/**
 * NBA Stats API client for Supabase Edge Functions.
 * Calls stats.nba.com JSON endpoints with anti-403 headers.
 */

const NBA_BASE = "https://stats.nba.com/stats";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

export interface NbaRow {
  [key: string]: string | number | null;
}

export interface NbaResultSet {
  name: string;
  headers: string[];
  rows: NbaRow[];
}

/**
 * Fetch from stats.nba.com with retries and rate limiting.
 */
export async function nbaFetch(
  endpoint: string,
  params: Record<string, string>
): Promise<NbaResultSet[]> {
  const url = new URL(`${NBA_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const REQUEST_TIMEOUT_MS = 12000;
  const MAX_ATTEMPTS = 2;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      // exponential backoff
      await sleep(1000 * Math.pow(2, attempt));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        headers: HEADERS,
        signal: controller.signal,
      });

      if (res.status === 403) {
        throw new NbaBlockedError(
          `NBA API returned 403 for ${endpoint}. The server may be blocking automated requests.`
        );
      }

      if (res.status === 429) {
        lastError = new NbaBlockedError(`NBA API rate limited (429) for ${endpoint}`);
        continue;
      }

      if (!res.ok) {
        lastError = new Error(`NBA API ${res.status}: ${await res.text()}`);
        continue;
      }

      const json = await res.json();
      return parseNbaResponse(json);
    } catch (e) {
      if (e instanceof NbaBlockedError) throw e;

      // Timeout/abort -> treat as blocked/unavailable so caller can fall back to Sheet.
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new NbaBlockedError(`NBA API timeout after ${REQUEST_TIMEOUT_MS}ms for ${endpoint}`);
      }

      lastError = e instanceof Error ? e : new Error(String(e));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError instanceof NbaBlockedError) throw lastError;
  throw lastError ?? new Error("nbaFetch failed");
}

export class NbaBlockedError extends Error {
  code = "NBA_BLOCKED";
}

function parseNbaResponse(json: any): NbaResultSet[] {
  const resultSets = json.resultSets ?? json.resultSet ?? [];
  const sets = Array.isArray(resultSets) ? resultSets : [resultSets];
  return sets.map((rs: any) => {
    const headers: string[] = rs.headers ?? [];
    const rowSet: any[][] = rs.rowSet ?? [];
    const rows = rowSet.map((row) => {
      const obj: NbaRow = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? null;
      });
      return obj;
    });
    return { name: rs.name ?? "", headers, rows };
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Compute fantasy points: PTS + REB + 2*AST + 3*STL + 3*BLK
 */
export function computeFP(pts: number, reb: number, ast: number, stl: number, blk: number): number {
  return pts + reb + 2 * ast + 3 * stl + 3 * blk;
}

/**
 * Get current NBA season string like "2025-26"
 */
export function currentSeason(): string {
  const now = new Date();
  let year = now.getFullYear();
  // NBA season starts in October; if before October, use previous year
  if (now.getMonth() < 9) year -= 1;
  const next = (year + 1) % 100;
  return `${year}-${String(next).padStart(2, "0")}`;
}

/**
 * Parse matchup string to extract opponent and home/away.
 * e.g. "BOS @ DET" => { opp: "DET", home_away: "A" }
 * e.g. "BOS vs. DET" => { opp: "DET", home_away: "H" }
 */
export function parseMatchup(matchup: string): { opp: string; home_away: "H" | "A" } {
  if (matchup.includes("@")) {
    const parts = matchup.split("@").map((s) => s.trim());
    return { opp: parts[1], home_away: "A" };
  }
  // "vs." or "vs"
  const parts = matchup.split(/vs\.?/i).map((s) => s.trim());
  return { opp: parts[1], home_away: "H" };
}

/**
 * Build NBA game URL from matchup and game_id.
 * e.g. "BOS @ DET", "0022500123" => "https://www.nba.com/game/bos-vs-det-0022500123"
 */
export function buildGameUrl(matchup: string, gameId: string): string {
  const { home_away } = parseMatchup(matchup);
  const parts = matchup.split(/[@]|vs\.?/i).map((s) => s.trim().toLowerCase());
  let slug: string;
  if (home_away === "A") {
    // "AWAY @ HOME" => "away-vs-home"
    slug = `${parts[0]}-vs-${parts[1]}`;
  } else {
    // "HOME vs. AWAY" => "home-vs-away"  
    slug = `${parts[0]}-vs-${parts[1]}`;
  }
  slug = slug.replace(/\s+/g, "");
  return `https://www.nba.com/game/${slug}-${gameId}`;
}
