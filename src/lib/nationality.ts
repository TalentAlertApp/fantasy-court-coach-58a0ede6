/**
 * Nationality helpers (NBA + WNBA + EuroLeague).
 * Country name → ISO-3166 alpha-2 → flag image (via flagcdn.com).
 *
 * Lookup is diacritic- and punctuation-insensitive ("Türkiye", "Turkiye",
 * "Côte d'Ivoire", "Cote d Ivoire" all resolve). Every ISO code can be
 * reached through multiple aliases so DB_Players spellings don't silently
 * miss the map.
 */

/** Normalize an arbitrary country string into the alias-table key. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[.'’`]/g, "")          // drop apostrophes / dots
    .replace(/[^a-z0-9]+/g, " ")     // collapse separators
    .trim();
}

/** Alias → ISO-3166 alpha-2. Keys MUST be pre-normalized via norm(). */
const COUNTRY_ISO: Record<string, string> = {
  // Americas
  "united states": "US", "usa": "US", "us": "US", "united states of america": "US",
  "canada": "CA",
  "mexico": "MX",
  "bahamas": "BS",
  "jamaica": "JM",
  "haiti": "HT",
  "dominican republic": "DO",
  "puerto rico": "PR",
  "saint lucia": "LC",
  "cuba": "CU",
  "nicaragua": "NI",
  "panama": "PA",
  "brazil": "BR",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "venezuela": "VE",
  "uruguay": "UY",

  // Europe
  "united kingdom": "GB", "great britain": "GB", "england": "GB", "uk": "GB",
  "ireland": "IE",
  "france": "FR",
  "spain": "ES",
  "portugal": "PT",
  "italy": "IT",
  "germany": "DE",
  "austria": "AT",
  "belgium": "BE",
  "netherlands": "NL", "the netherlands": "NL", "holland": "NL",
  "luxembourg": "LU",
  "switzerland": "CH",
  "denmark": "DK",
  "norway": "NO",
  "sweden": "SE",
  "finland": "FI",
  "iceland": "IS",
  "poland": "PL",
  "czech republic": "CZ", "czechia": "CZ",
  "slovakia": "SK", "slovak republic": "SK",
  "hungary": "HU",
  "romania": "RO",
  "bulgaria": "BG",
  "greece": "GR",
  "cyprus": "CY",
  "turkey": "TR", "turkiye": "TR", "republic of turkey": "TR", "republic of turkiye": "TR",
  "russia": "RU", "russian federation": "RU",
  "ukraine": "UA",
  "belarus": "BY",
  "estonia": "EE",
  "latvia": "LV",
  "lithuania": "LT",
  "serbia": "RS",
  "croatia": "HR",
  "slovenia": "SI",
  "bosnia and herzegovina": "BA", "bosnia herzegovina": "BA", "bosnia": "BA",
  "montenegro": "ME",
  "north macedonia": "MK", "macedonia": "MK", "fyrom": "MK",
  "kosovo": "XK",
  "albania": "AL",
  "armenia": "AM",
  "georgia": "GE",

  // Africa
  "cameroon": "CM",
  "nigeria": "NG",
  "senegal": "SN",
  "mali": "ML",
  "guinea": "GN",
  "ivory coast": "CI", "cote d ivoire": "CI", "cote divoire": "CI", "ivorian coast": "CI",
  "cape verde": "CV", "cabo verde": "CV",
  "angola": "AO",
  "ghana": "GH",
  "kenya": "KE",
  "south africa": "ZA",
  "south sudan": "SS",
  "sudan": "SD",
  "egypt": "EG",
  "tunisia": "TN",
  "algeria": "DZ",
  "morocco": "MA",
  "democratic republic of congo": "CD", "dr congo": "CD", "drc": "CD", "congo dr": "CD", "congo kinshasa": "CD",
  "republic of congo": "CG", "congo": "CG", "congo brazzaville": "CG",

  // Middle East & Asia & Oceania
  "israel": "IL",
  "iran": "IR",
  "lebanon": "LB",
  "china": "CN",
  "japan": "JP",
  "south korea": "KR", "republic of korea": "KR", "korea": "KR",
  "australia": "AU",
  "new zealand": "NZ",
};

/** Friendly display label. Restores diacritics for a few common spellings. */
const DISPLAY_LABEL: Record<string, string> = {
  "usa": "United States",
  "us": "United States",
  "turkiye": "Türkiye",
  "cote d ivoire": "Côte d'Ivoire",
  "cote divoire": "Côte d'Ivoire",
  "ivory coast": "Côte d'Ivoire",
  "cabo verde": "Cabo Verde",
  "cape verde": "Cabo Verde",
};

export function countryLabel(name: string | null | undefined): string | null {
  if (!name) return null;
  const raw = String(name).trim();
  if (!raw) return null;
  const k = norm(raw);
  return DISPLAY_LABEL[k] ?? raw;
}

export function isoCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = norm(String(name));
  const iso = COUNTRY_ISO[k];
  return iso ? iso.toLowerCase() : null;
}