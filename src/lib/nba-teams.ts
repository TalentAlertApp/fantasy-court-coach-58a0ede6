export interface NbaTeam {
  id: string;
  name: string;
  tricode: string;
  logo: string;
}

export const NBA_TEAMS: NbaTeam[] = [
  { id: "1610612737", name: "Atlanta Hawks",          tricode: "ATL", logo: "https://cdn.nba.com/logos/nba/1610612737/global/L/logo.svg" },
  { id: "1610612738", name: "Boston Celtics",         tricode: "BOS", logo: "https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg" },
  { id: "1610612751", name: "Brooklyn Nets",          tricode: "BKN", logo: "https://cdn.nba.com/logos/nba/1610612751/global/L/logo.svg" },
  { id: "1610612766", name: "Charlotte Hornets",      tricode: "CHA", logo: "https://cdn.nba.com/logos/nba/1610612766/global/L/logo.svg" },
  { id: "1610612741", name: "Chicago Bulls",          tricode: "CHI", logo: "https://cdn.nba.com/logos/nba/1610612741/global/L/logo.svg" },
  { id: "1610612739", name: "Cleveland Cavaliers",    tricode: "CLE", logo: "https://cdn.nba.com/logos/nba/1610612739/global/L/logo.svg" },
  { id: "1610612742", name: "Dallas Mavericks",       tricode: "DAL", logo: "https://cdn.nba.com/logos/nba/1610612742/global/L/logo.svg" },
  { id: "1610612743", name: "Denver Nuggets",         tricode: "DEN", logo: "https://cdn.nba.com/logos/nba/1610612743/global/L/logo.svg" },
  { id: "1610612765", name: "Detroit Pistons",        tricode: "DET", logo: "https://cdn.nba.com/logos/nba/1610612765/global/L/logo.svg" },
  { id: "1610612744", name: "Golden State Warriors",  tricode: "GSW", logo: "https://cdn.nba.com/logos/nba/1610612744/global/L/logo.svg" },
  { id: "1610612745", name: "Houston Rockets",        tricode: "HOU", logo: "https://cdn.nba.com/logos/nba/1610612745/global/L/logo.svg" },
  { id: "1610612754", name: "Indiana Pacers",         tricode: "IND", logo: "https://cdn.nba.com/logos/nba/1610612754/global/L/logo.svg" },
  { id: "1610612746", name: "LA Clippers",            tricode: "LAC", logo: "https://cdn.nba.com/logos/nba/1610612746/global/L/logo.svg" },
  { id: "1610612747", name: "Los Angeles Lakers",     tricode: "LAL", logo: "https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg" },
  { id: "1610612763", name: "Memphis Grizzlies",      tricode: "MEM", logo: "https://cdn.nba.com/logos/nba/1610612763/global/L/logo.svg" },
  { id: "1610612748", name: "Miami Heat",             tricode: "MIA", logo: "https://cdn.nba.com/logos/nba/1610612748/global/L/logo.svg" },
  { id: "1610612749", name: "Milwaukee Bucks",        tricode: "MIL", logo: "https://cdn.nba.com/logos/nba/1610612749/global/L/logo.svg" },
  { id: "1610612750", name: "Minnesota Timberwolves", tricode: "MIN", logo: "https://cdn.nba.com/logos/nba/1610612750/global/L/logo.svg" },
  { id: "1610612740", name: "New Orleans Pelicans",   tricode: "NOP", logo: "https://cdn.nba.com/logos/nba/1610612740/global/L/logo.svg" },
  { id: "1610612752", name: "New York Knicks",        tricode: "NYK", logo: "https://cdn.nba.com/logos/nba/1610612752/global/L/logo.svg" },
  { id: "1610612760", name: "Oklahoma City Thunder",  tricode: "OKC", logo: "https://cdn.nba.com/logos/nba/1610612760/global/L/logo.svg" },
  { id: "1610612753", name: "Orlando Magic",          tricode: "ORL", logo: "https://cdn.nba.com/logos/nba/1610612753/global/L/logo.svg" },
  { id: "1610612755", name: "Philadelphia 76ers",     tricode: "PHI", logo: "https://cdn.nba.com/logos/nba/1610612755/global/L/logo.svg" },
  { id: "1610612756", name: "Phoenix Suns",           tricode: "PHX", logo: "https://cdn.nba.com/logos/nba/1610612756/global/L/logo.svg" },
  { id: "1610612757", name: "Portland Trail Blazers", tricode: "POR", logo: "https://cdn.nba.com/logos/nba/1610612757/global/L/logo.svg" },
  { id: "1610612758", name: "Sacramento Kings",       tricode: "SAC", logo: "https://cdn.nba.com/logos/nba/1610612758/global/L/logo.svg" },
  { id: "1610612759", name: "San Antonio Spurs",      tricode: "SAS", logo: "https://cdn.nba.com/logos/nba/1610612759/global/L/logo.svg" },
  { id: "1610612761", name: "Toronto Raptors",        tricode: "TOR", logo: "https://cdn.nba.com/logos/nba/1610612761/global/L/logo.svg" },
  { id: "1610612762", name: "Utah Jazz",              tricode: "UTA", logo: "https://cdn.nba.com/logos/nba/1610612762/global/L/logo.svg" },
  { id: "1610612764", name: "Washington Wizards",     tricode: "WAS", logo: "https://cdn.nba.com/logos/nba/1610612764/global/L/logo.svg" },
];

const NAME_TO_TRICODE: Record<string, string> = {
  "atlanta": "ATL", "boston": "BOS", "brooklyn": "BKN", "charlotte": "CHA",
  "chicago": "CHI", "cleveland": "CLE", "dallas": "DAL", "denver": "DEN",
  "detroit": "DET", "golden state": "GSW", "houston": "HOU", "indiana": "IND",
  "la clippers": "LAC", "la lakers": "LAL", "los angeles lakers": "LAL",
  "los angeles clippers": "LAC", "memphis": "MEM", "miami": "MIA",
  "milwaukee": "MIL", "minnesota": "MIN", "new orleans": "NOP",
  "new york": "NYK", "oklahoma": "OKC", "oklahoma city": "OKC",
  "orlando": "ORL", "philadelphia": "PHI", "phoenix": "PHX",
  "portland": "POR", "sacramento": "SAC", "san antonio": "SAS",
  "toronto": "TOR", "utah": "UTA", "washington": "WAS",
};

/** Look up a team by tricode (e.g. "LAL") — case-insensitive */
export function getTeamByTricode(tricode: string): NbaTeam | undefined {
  return NBA_TEAMS.find((t) => t.tricode.toUpperCase() === tricode.toUpperCase());
}

/** Get team logo URL by tricode or city/short name (e.g. "LAL", "Dallas", "LA Lakers") */
export function getTeamLogo(teamStr: string): string | undefined {
  // Try tricode first
  const byTricode = getTeamByTricode(teamStr);
  if (byTricode) return byTricode.logo;
  // Try name lookup
  const tricode = NAME_TO_TRICODE[teamStr.toLowerCase()];
  if (tricode) return getTeamByTricode(tricode)?.logo;
  // Try partial match against full team names
  const lower = teamStr.toLowerCase();
  const match = NBA_TEAMS.find((t) => t.name.toLowerCase().includes(lower));
  return match?.logo;
}
