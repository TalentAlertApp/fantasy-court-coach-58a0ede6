/**
 * Nationality helpers (NBA + WNBA).
 * Country name → ISO-3166 alpha-2 → flag image (via flagcdn.com).
 */

const COUNTRY_ISO: Record<string, string> = {
  "united states": "US",
  "usa": "US",
  "united kingdom": "GB",
  "australia": "AU",
  "austria": "AT",
  "bahamas": "BS",
  "belgium": "BE",
  "bosnia and herzegovina": "BA",
  "brazil": "BR",
  "cameroon": "CM",
  "canada": "CA",
  "china": "CN",
  "croatia": "HR",
  "czech republic": "CZ",
  "democratic republic of congo": "CD",
  "drc": "CD",
  "dominican republic": "DO",
  "finland": "FI",
  "france": "FR",
  "georgia": "GE",
  "germany": "DE",
  "greece": "GR",
  "guinea": "GN",
  "haiti": "HT",
  "hungary": "HU",
  "israel": "IL",
  "italy": "IT",
  "jamaica": "JM",
  "japan": "JP",
  "latvia": "LV",
  "lithuania": "LT",
  "mali": "ML",
  "mexico": "MX",
  "montenegro": "ME",
  "netherlands": "NL",
  "new zealand": "NZ",
  "nicaragua": "NI",
  "nigeria": "NG",
  "poland": "PL",
  "portugal": "PT",
  "puerto rico": "PR",
  "russia": "RU",
  "saint lucia": "LC",
  "senegal": "SN",
  "serbia": "RS",
  "slovenia": "SI",
  "south korea": "KR",
  "south sudan": "SS",
  "spain": "ES",
  "sweden": "SE",
  "switzerland": "CH",
  "turkey": "TR",
  "ukraine": "UA",
};

export function countryLabel(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = String(name).trim().toLowerCase();
  if (!k) return null;
  if (k === "usa") return "United States";
  // Title-case-ish: rely on input as already correctly cased
  return String(name).trim();
}

export function isoCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const iso = COUNTRY_ISO[String(name).trim().toLowerCase()];
  return iso ? iso.toLowerCase() : null;
}