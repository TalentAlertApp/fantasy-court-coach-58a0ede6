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
const B = (n: string) => `https://cdn.wnba.com/logos/wnba/${n}/primary/L/logo.svg`;

export const WNBA_TEAMS: WnbaTeam[] = [
  { id: "1611661330", tricode: "ATL", name: "Atlanta Dream",          logo: B("1611661330"), primaryColor: "#E03A3E", conference: "Eastern", venueName: "Gateway Center Arena @ College Park", venueImage: "https://en.wikipedia.org/wiki/Gateway_Center_Arena#/media/File:Gateway_Center_Arena,_at_night.jpg", rosterUrl: "https://dream.wnba.com/roster" },
  { id: "1611661329", tricode: "CHI", name: "Chicago Sky",            logo: B("1611661329"), primaryColor: "#418FDE", conference: "Eastern", venueName: "Wintrust Arena", venueImage: "https://assets.simpleviewinc.com/simpleview/image/upload/c_fit,w_1800,h_800/crm/chicago/WA-for-Choose_DC799F3E-5056-A36F-23BE4EEDDB33626A_511f805b-5056-a36f-23cb5f77d5b0e9cd.jpg", rosterUrl: "https://sky.wnba.com/roster" },
  { id: "1611661323", tricode: "CON", name: "Connecticut Sun",        logo: B("1611661323"), primaryColor: "#E03A3E", conference: "Eastern", venueName: "Mohegan Sun Arena", venueImage: "https://ctvisit.com/sites/default/files/styles/hero_1600x900/public/media/2024-02/MicrosoftTeams-image%20%2833%29.png?itok=RJ7ywnU1", rosterUrl: "https://sun.wnba.com/roster" },
  { id: "1611661325", tricode: "IND", name: "Indiana Fever",          logo: B("1611661325"), primaryColor: "#E03A3E", conference: "Eastern", venueName: "Gainbridge Fieldhouse", venueImage: "https://www.gainbridgefieldhouse.com/assets/img/Gainbidge-Rendering-Penn-1180x500-c9091e512d.jpg", rosterUrl: "https://fever.wnba.com/roster" },
  { id: "1611661313", tricode: "NYL", name: "New York Liberty",       logo: B("1611661313"), primaryColor: "#6ECEB2", conference: "Eastern", venueName: "Barclays Center", venueImage: "https://www.crainscleveland.com/resizer/v2/H4KLMRKIJ62DNNCVVUIJMWE4GY.jpg?smart=true&auth=7c326468806c6703758ad8f92a2b596323d5efefcd8e9cab3a031c65eceaa19a&width=2000&height=1124", rosterUrl: "https://liberty.wnba.com/roster" },
  { id: "1611661332", tricode: "TOR", name: "Toronto Tempo",          logo: B("1611661332"), primaryColor: "#A6192E", conference: "Eastern", venueName: "Coca-Cola Coliseum", venueImage: "https://media.licdn.com/dms/image/v2/D4E22AQHOkOmH784Rtw/feedshare-shrink_800/B4EZ2OYy7HGQAc-/0/1776210358720?e=2147483647&v=beta&t=LENpjOSywiZY86lD7gG1HTv298TR1RMrUIoqrWTxq84", rosterUrl: "https://tempo.wnba.com/roster" },
  { id: "1611661322", tricode: "WAS", name: "Washington Mystics",     logo: B("1611661322"), primaryColor: "#0C2340", conference: "Eastern", venueName: "Capital One Arena", venueImage: "https://wjla.com/resources/media/608f7808-ae45-4ebf-9902-52e144fe68d7-jumbo16x9_AP23173708702103.jpg?1687472004729", rosterUrl: "https://mystics.wnba.com/roster" },
  { id: "1611661321", tricode: "DAL", name: "Dallas Wings",           logo: B("1611661321"), primaryColor: "#003F87", conference: "Western", venueName: "College Park Center", venueImage: "https://assets.simpleviewinc.com/sv-arlington/image/fetch/c_limit,q_75,w_1200/https://assets.simpleviewinc.com/simpleview/image/upload/crm/arlington/College-Park-Center-Night-shot_cropped-855x4300_5a8fbeaf-0886-4196-0eac6b974d7062b8.jpg", rosterUrl: "https://wings.wnba.com/roster" },
  { id: "1611661331", tricode: "GSV", name: "Golden State Valkyries", logo: B("1611661331"), primaryColor: "#5B2D81", conference: "Western", venueName: "Chase Center", venueImage: "https://dailymcplay.com/wp-content/uploads/2025/05/gsv-preseason.jpg", rosterUrl: "https://valkyries.wnba.com/roster" },
  { id: "1611661319", tricode: "LVA", name: "Las Vegas Aces",         logo: B("1611661319"), primaryColor: "#000000", conference: "Western", venueName: "Michelob Ultra Arena", venueImage: "https://s3.us-east-1.amazonaws.com/vnda-cockpit/www-streetopia-me/2021/02/19/602fff724ba9daces02.jpg", rosterUrl: "https://aces.wnba.com/roster" },
  { id: "1611661320", tricode: "LAS", name: "Los Angeles Sparks",     logo: B("1611661320"), primaryColor: "#552583", conference: "Western", venueName: "Crypto.com Arena", venueImage: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Crypto.com_Arena_exterior_2023.jpg", rosterUrl: "https://sparks.wnba.com/roster" },
  { id: "1611661324", tricode: "MIN", name: "Minnesota Lynx",         logo: B("1611661324"), primaryColor: "#236192", conference: "Western", venueName: "Target Center", venueImage: "https://www.minneapolis.org/imager/cmsimages/465601/Hero-Image-Target-Center-Exterior_91852798b59be8b28fc00edfe4aec23a.jpg", rosterUrl: "https://lynx.wnba.com/roster" },
  { id: "1611661317", tricode: "PHX", name: "Phoenix Mercury",        logo: B("1611661317"), primaryColor: "#E56020", conference: "Western", venueName: "Footprint Center", venueImage: "https://upload.wikimedia.org/wikipedia/commons/5/54/Footprint_Center_2022.jpg", rosterUrl: "https://mercury.wnba.com/roster" },
  { id: "1611661327", tricode: "POR", name: "Portland Fire",          logo: B("1611661327"), primaryColor: "#E03A3E", conference: "Western", venueName: "Moda Center", venueImage: "https://ktvl.com/resources/media2/16x9/1280/986/0x67/90/1380418b-c189-4dd1-8f7d-e5e66c6f11cb-ModaCenterBenhamcaptioned.jpg", rosterUrl: "https://fire.wnba.com/roster" },
  { id: "1611661328", tricode: "SEA", name: "Seattle Storm",          logo: B("1611661328"), primaryColor: "#2C5234", conference: "Western", venueName: "Climate Pledge Arena", venueImage: "https://images.seattletimes.com/wp-content/uploads/2022/04/173549.jpg?d=2040x1360", rosterUrl: "https://storm.wnba.com/roster" },
];

export function getWnbaTeamByTricode(tri: string): WnbaTeam | undefined {
  if (!tri) return undefined;
  const t = tri.toUpperCase();
  return WNBA_TEAMS.find((x) => x.tricode === t);
}

export function getWnbaTeamLogo(tri: string): string | undefined {
  return getWnbaTeamByTricode(tri)?.logo;
}