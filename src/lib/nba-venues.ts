export interface VenueMeta {
  name: string;
  image: string;
}

// Home arena name + Wikimedia-hosted exterior/interior photo for each NBA team.
// Images use Wikimedia Commons URLs (CC-licensed, hot-link friendly).
export const NBA_VENUES: Record<string, VenueMeta> = {
  ATL: { name: "State Farm Arena", image: "https://cdn.nba.com/manage/2024/08/state-farm-arena.jpeg" },
  BOS: { name: "TD Garden", image: "https://cdn.nba.com/manage/2024/08/td-garden-1536x576.jpg" },
  BKN: { name: "Barclays Center", image: "https://cdn.nba.com/manage/2024/08/barclays-center.jpg" },
  CHA: { name: "Spectrum Center", image: "https://cdn.nba.com/manage/2024/08/spectrum-center.jpg" },
  CHI: { name: "United Center", image: "https://cdn.nba.com/manage/2024/08/united-center.png" },
  CLE: { name: "Rocket Arena", image: "https://cdn.nba.com/manage/2024/08/rocket-mortgage-fieldhouse-wide.jpeg" },
  DAL: { name: "American Airlines Center", image: "https://cdn.nba.com/manage/2024/08/american-airlines-center.png" },
  DEN: { name: "Ball Arena", image: "https://cdn.nba.com/manage/2024/08/ball-arena-1536x658.jpg" },
  DET: { name: "Little Caesars Arena", image: "https://cdn.nba.com/manage/2024/08/little-caesars-arena-1536x863.jpeg" },
  GSW: { name: "Chase Center", image: "https://cdn.nba.com/manage/2024/08/chase-center.jpg" },
  HOU: { name: "Toyota Center", image: "https://cdn.nba.com/manage/2024/08/toyota-center-wide.jpeg" },
  IND: { name: "Gainbridge Fieldhouse", image: "https://cdn.nba.com/manage/2024/08/gainbridge-fieldhouse.jpg" },
  LAC: { name: "Intuit Dome", image: "https://cdn.nba.com/manage/2024/08/intuit-dome.jpeg" },
  LAL: { name: "Crypto.com Arena", image: "https://cdn.nba.com/manage/2024/08/crypto-com-arena-front-1536x907.jpg" },
  MEM: { name: "FedExForum", image: "https://cdn.nba.com/manage/2024/08/fedex-forum.jpg" },
  MIA: { name: "Kaseya Center", image: "https://cdn.nba.com/manage/2024/08/kaseya-center.jpg" },
  MIL: { name: "Fiserv Forum", image: "https://cdn.nba.com/manage/2024/08/fiserv-forum-1536x865.jpg" },
  MIN: { name: "Target Center", image: "https://cdn.nba.com/manage/2024/08/target-center-wide.jpg" },
  NOP: { name: "Smoothie King Center", image: "https://cdn.nba.com/manage/2024/08/smoothie-king-center-v2-1536x823.jpg" },
  NYK: { name: "Madison Square Garden", image: "https://cdn.nba.com/manage/2024/08/madison-square-garden.jpeg" },
  OKC: { name: "Paycom Center", image: "https://cdn.nba.com/manage/2024/08/paycom-center.jpg" },
  ORL: { name: "Kia Center", image: "https://cdn.nba.com/manage/2024/08/kia-center.jpg" },
  PHI: { name: "Wells Fargo Center", image: "https://cdn.nba.com/manage/2024/08/wells-fargo-center-sixers-1536x707.jpeg" },
  PHX: { name: "Footprint Center", image: "https://cdn.nba.com/manage/2024/08/footprint-center-wide.jpeg" },
  POR: { name: "Moda Center", image: "https://cdn.nba.com/manage/2024/08/moda-center-1536x487.jpg" },
  SAC: { name: "Golden 1 Center", image: "https://cdn.nba.com/manage/2024/08/golden1-center-wide-1536x632.jpeg" },
  SAS: { name: "Frost Bank Center", image: "https://cdn.nba.com/manage/2024/08/frost-bank-center.png" },
  TOR: { name: "Scotiabank Arena", image: "https://cdn.nba.com/manage/2024/08/scotiabank-arena-v2.jpeg" },
  UTA: { name: "Delta Center", image: "https://cdn.nba.com/manage/2024/08/delta-center-wide.jpeg" },
  WAS: { name: "Capital One Arena", image: "https://cdn.nba.com/manage/2024/08/capital-1-arena-wide-1536x685.jpg" },
};

export function getVenue(tricode: string): VenueMeta | null {
  if (!tricode) return null;
  return NBA_VENUES[tricode.toUpperCase()] ?? null;
}