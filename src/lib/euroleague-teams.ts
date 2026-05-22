/**
 * EuroLeague team catalog (2025-26 season).
 *
 * Shape matches LeagueTeam in useLeagueTeams so Teams / Filters / Schedule
 * pages can render EuroLeague the same way as NBA/WNBA without special-casing.
 * Conference & division are deliberately null — the competition uses a single
 * league table.
 *
 * Logos use the EuroLeague crest as a neutral fallback until per-club assets
 * are imported. Replacing `logo` per club is purely additive.
 */

import euroleagueLogo from "@/assets/euroleague-logo.png";

export interface EuroLeagueTeam {
  id: string;
  tricode: string;
  name: string;
  logo: string;
  primaryColor: string;
  venueName?: string;
}

export const EUROLEAGUE_TEAMS: EuroLeagueTeam[] = [
  // Tricodes MUST match the EuroLeague Google Sheet DB_Teams.TEAM_CODE column.
  // sport_teams, players, schedule_games, and player_game_logs are all keyed
  // by these codes; drifting from the sheet creates empty cards & zero data.
  { id: "el-efs", tricode: "EFS", name: "Anadolu Efes Istanbul",                logo: euroleagueLogo, primaryColor: "#003DA5", venueName: "Sinan Erdem Dome" },
  { id: "el-asm", tricode: "ASM", name: "AS Monaco",                            logo: euroleagueLogo, primaryColor: "#E30613", venueName: "Salle Gaston Medecin" },
  { id: "el-czv", tricode: "CZV", name: "Crvena Zvezda Meridianbet Belgrade",   logo: euroleagueLogo, primaryColor: "#E30613", venueName: "Aleksandar Nikolic Hall" },
  { id: "el-dub", tricode: "DUB", name: "Dubai Basketball",                     logo: euroleagueLogo, primaryColor: "#E30613", venueName: "Coca-Cola Arena" },
  { id: "el-ea7", tricode: "EA7", name: "EA7 Emporio Armani Milan",             logo: euroleagueLogo, primaryColor: "#E30613", venueName: "Mediolanum Forum" },
  { id: "el-bar", tricode: "BAR", name: "FC Barcelona",                         logo: euroleagueLogo, primaryColor: "#A50044", venueName: "Palau Blaugrana" },
  { id: "el-bay", tricode: "BAY", name: "FC Bayern Munich",                     logo: euroleagueLogo, primaryColor: "#DC052D", venueName: "BMW Park" },
  { id: "el-fbb", tricode: "FBB", name: "Fenerbahce Beko Istanbul",             logo: euroleagueLogo, primaryColor: "#FFED00", venueName: "Ulker Sports Arena" },
  { id: "el-hta", tricode: "HTA", name: "Hapoel IBI Tel Aviv",                  logo: euroleagueLogo, primaryColor: "#E30613", venueName: "Drive in Arena" },
  { id: "el-bkn", tricode: "BKN", name: "Kosner Baskonia Vitoria-Gasteiz",      logo: euroleagueLogo, primaryColor: "#003DA5", venueName: "Fernando Buesa Arena" },
  { id: "el-asv", tricode: "ASV", name: "LDLC ASVEL Villeurbanne",              logo: euroleagueLogo, primaryColor: "#1A1A1A", venueName: "LDLC Arena" },
  { id: "el-mta", tricode: "MTA", name: "Maccabi Rapyd Tel Aviv",               logo: euroleagueLogo, primaryColor: "#FFCC00", venueName: "Menora Mivtachim Arena" },
  { id: "el-oly", tricode: "OLY", name: "Olympiacos Piraeus",                   logo: euroleagueLogo, primaryColor: "#E30613", venueName: "Peace and Friendship Stadium" },
  { id: "el-pao", tricode: "PAO", name: "Panathinaikos AKTOR Athens",           logo: euroleagueLogo, primaryColor: "#007A33", venueName: "OAKA" },
  { id: "el-par", tricode: "PAR", name: "Paris Basketball",                     logo: euroleagueLogo, primaryColor: "#000000", venueName: "Adidas Arena" },
  { id: "el-pbb", tricode: "PBB", name: "Partizan Mozzart Bet Belgrade",        logo: euroleagueLogo, primaryColor: "#000000", venueName: "Stark Arena" },
  { id: "el-rmb", tricode: "RMB", name: "Real Madrid",                          logo: euroleagueLogo, primaryColor: "#FEBE10", venueName: "WiZink Center" },
  { id: "el-vbc", tricode: "VBC", name: "Valencia Basket",                      logo: euroleagueLogo, primaryColor: "#F37021", venueName: "Roig Arena" },
  { id: "el-vir", tricode: "VIR", name: "Virtus Bologna",                       logo: euroleagueLogo, primaryColor: "#000000", venueName: "Segafredo Arena" },
  { id: "el-zal", tricode: "ZAL", name: "Zalgiris Kaunas",                      logo: euroleagueLogo, primaryColor: "#1C7438", venueName: "Zalgirio Arena" },
];

export function getEuroLeagueTeamByTricode(tri: string): EuroLeagueTeam | undefined {
  if (!tri) return undefined;
  const t = tri.toUpperCase();
  return EUROLEAGUE_TEAMS.find((x) => x.tricode === t);
}
