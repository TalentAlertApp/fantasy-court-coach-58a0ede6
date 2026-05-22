/**
 * Runtime registry of EuroLeague team metadata fetched from `sport_teams`.
 *
 * Populated by `useLeagueTeams` once Supabase responds. Consumed by sync
 * helpers like `getTeamLogo` that cannot await a query but still need the
 * latest synced logo / venue / display name.
 *
 * Keys: team_code (UPPERCASE) AND lowercased full name (for resilience when
 * data sources mislabel teams).
 */
export interface EuroLeagueTeamRecord {
  team_code: string;
  name: string;
  short_name?: string | null;
  city?: string | null;
  country?: string | null;
  venue_name?: string | null;
  venue_image_url?: string | null;
  logo_url?: string | null;
  roster_url?: string | null;
}

const _byCode = new Map<string, EuroLeagueTeamRecord>();
const _byName = new Map<string, EuroLeagueTeamRecord>();

export function registerEuroLeagueTeams(rows: EuroLeagueTeamRecord[]) {
  for (const r of rows) {
    if (r.team_code) _byCode.set(r.team_code.toUpperCase(), r);
    if (r.name) _byName.set(r.name.toLowerCase(), r);
    if (r.short_name) _byName.set(r.short_name.toLowerCase(), r);
  }
}

export function getEuroLeagueTeamRecord(key: string | null | undefined): EuroLeagueTeamRecord | undefined {
  if (!key) return undefined;
  return _byCode.get(key.toUpperCase()) ?? _byName.get(key.toLowerCase());
}

export function listEuroLeagueTeamRecords(): EuroLeagueTeamRecord[] {
  return Array.from(_byCode.values());
}
