/**
 * WNBA team metadata. Independent of NBA team list.
 * Tricodes: ATL, CHI, CON, IND, NYL, TOR, WAS, DAL, GSV, LVA, LAS, MIN, PHX, POR, SEA
 */

export interface WnbaTeam {
  id: string;
  name: string;
  tricode: string;
  logo: string;
  primaryColor: string;
  conference: "Eastern" | "Western";
  venueName: string;
  venueImage?: string;
  rosterUrl?: string;
}

const W = (n: string) => `https://cdn.wnba.com/logos/wnba/${n}/global/L/logo.svg`;

export const WNBA_TEAMS: WnbaTeam[] = [
  { id: "1611661330", tricode: "ATL", name: "Atlanta Dream",        logo: W("1611661330"), primaryColor: "#E03A3E", conference: "Eastern", venueName: "Gateway Center Arena" },
  { id: "1611661329", tricode: "CHI", name: "Chicago Sky",          logo: W("1611661329"), primaryColor: "#418FDE", conference: "Eastern", venueName: "Wintrust Arena" },
  { id: "1611661323", tricode: "CON", name: "Connecticut Sun",      logo: W("1611661323"), primaryColor: "#E03A3E", conference: "Eastern", venueName: "Mohegan Sun Arena" },
  { id: "1611661325", tricode: "IND", name: "Indiana Fever",        logo: W("1611661325"), primaryColor: "#E03A3E", conference: "Eastern", venueName: "Gainbridge Fieldhouse" },
  { id: "1611661313", tricode: "NYL", name: "New York Liberty",     logo: W("1611661313"), primaryColor: "#6ECEB2", conference: "Eastern", venueName: "Barclays Center" },
  { id: "1611661332", tricode: "TOR", name: "Toronto Tempo",        logo: W("1611661332"), primaryColor: "#A6192E", conference: "Eastern", venueName: "Coca-Cola Coliseum" },
  { id: "1611661322", tricode: "WAS", name: "Washington Mystics",   logo: W("1611661322"), primaryColor: "#0C2340", conference: "Eastern", venueName: "CareFirst Arena" },
  { id: "1611661321", tricode: "DAL", name: "Dallas Wings",         logo: W("1611661321"), primaryColor: "#003F87", conference: "Western", venueName: "College Park Center" },
  { id: "1611661331", tricode: "GSV", name: "Golden State Valkyries", logo: W("1611661331"), primaryColor: "#5B2D81", conference: "Western", venueName: "Chase Center" },
  { id: "1611661319", tricode: "LVA", name: "Las Vegas Aces",       logo: W("1611661319"), primaryColor: "#000000", conference: "Western", venueName: "Michelob ULTRA Arena" },
  { id: "1611661320", tricode: "LAS", name: "Los Angeles Sparks",   logo: W("1611661320"), primaryColor: "#552583", conference: "Western", venueName: "Crypto.com Arena" },
  { id: "1611661324", tricode: "MIN", name: "Minnesota Lynx",       logo: W("1611661324"), primaryColor: "#236192", conference: "Western", venueName: "Target Center" },
  { id: "1611661317", tricode: "PHX", name: "Phoenix Mercury",      logo: W("1611661317"), primaryColor: "#E56020", conference: "Western", venueName: "PHX Arena" },
  { id: "1611661328", tricode: "POR", name: "Portland Fire",        logo: W("1611661328"), primaryColor: "#E03A3E", conference: "Western", venueName: "Moda Center" },
  { id: "1611661328", tricode: "SEA", name: "Seattle Storm",        logo: W("1611661328"), primaryColor: "#2C5234", conference: "Western", venueName: "Climate Pledge Arena" },
];

export function getWnbaTeamByTricode(tri: string): WnbaTeam | undefined {
  if (!tri) return undefined;
  const t = tri.toUpperCase();
  return WNBA_TEAMS.find((x) => x.tricode === t);
}

export function getWnbaTeamLogo(tri: string): string | undefined {
  return getWnbaTeamByTricode(tri)?.logo;
}