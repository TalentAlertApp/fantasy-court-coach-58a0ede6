/**
 * WNBA-only nationality helpers.
 * Country name → ISO-3166 alpha-2 → unicode flag emoji.
 */

const COUNTRY_ISO: Record<string, string> = {
  "united states": "US",
  "usa": "US",
  "united kingdom": "GB",
  "australia": "AU",
  "bahamas": "BS",
  "belgium": "BE",
  "bosnia and herzegovina": "BA",
  "brazil": "BR",
  "cameroon": "CM",
  "canada": "CA",
  "china": "CN",
  "czech republic": "CZ",
  "finland": "FI",
  "france": "FR",
  "germany": "DE",
  "greece": "GR",
  "hungary": "HU",
  "italy": "IT",
  "lithuania": "LT",
  "mali": "ML",
  "mexico": "MX",
  "netherlands": "NL",
  "new zealand": "NZ",
  "russia": "RU",
  "serbia": "RS",
  "slovenia": "SI",
  "south korea": "KR",
  "spain": "ES",
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