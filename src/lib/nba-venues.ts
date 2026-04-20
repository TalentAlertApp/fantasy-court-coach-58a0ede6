export interface VenueMeta {
  name: string;
  image: string;
}

// Home arena name + Wikimedia-hosted exterior/interior photo for each NBA team.
// Images use Wikimedia Commons URLs (CC-licensed, hot-link friendly).
export const NBA_VENUES: Record<string, VenueMeta> = {
  ATL: { name: "State Farm Arena", image: "https://cdn.nba.com/manage/2024/08/state-farm-arena.jpeg" },
  BOS: { name: "TD Garden", image: "https://cdn.nba.com/manage/2024/08/td-garden-1536x576.jpg" },
  BKN: { name: "Barclays Center", image: "https://cdn.nba.com/manage/2024/08/barclays-center-1536x576.jpg" },
  CHA: { name: "Spectrum Center", image: "https://cdn.nba.com/manage/2024/08/spectrum-center-1536x576.jpg" },
  CHI: { name: "United Center", image: "https://cdn.nba.com/manage/2024/08/united-center-1536x576.jpg" },
  CLE: { name: "Rocket Arena", image: "https://cdn.nba.com/manage/2024/08/rocket-mortgage-fieldhouse-1536x576.jpg" },
  DAL: { name: "American Airlines Center", image: "https://cdn.nba.com/manage/2024/08/american-airlines-center-1536x576.jpg" },
  DEN: { name: "Ball Arena", image: "https://cdn.nba.com/manage/2024/08/ball-arena-1536x576.jpg" },
  DET: { name: "Little Caesars Arena", image: "https://cdn.nba.com/manage/2024/08/little-caesars-arena-1536x576.jpg" },
  GSW: { name: "Chase Center", image: "https://cdn.nba.com/manage/2024/08/chase-center-1536x576.jpg" },
  HOU: { name: "Toyota Center", image: "https://cdn.nba.com/manage/2024/08/toyota-center-1536x576.jpg" },
  IND: { name: "Gainbridge Fieldhouse", image: "https://cdn.nba.com/manage/2024/08/gainbridge-fieldhouse-1536x576.jpg" },
  LAC: { name: "Intuit Dome", image: "https://cdn.nba.com/manage/2024/08/intuit-dome-1536x576.jpg" },
  LAL: { name: "Crypto.com Arena", image: "https://cdn.nba.com/manage/2024/08/crypto-com-arena-1536x576.jpg" },
  MEM: { name: "FedExForum", image: "https://cdn.nba.com/manage/2024/08/fedexforum-1536x576.jpg" },
  MIA: { name: "Kaseya Center", image: "https://cdn.nba.com/manage/2024/08/kaseya-center-1536x576.jpg" },
  MIL: { name: "Fiserv Forum", image: "https://cdn.nba.com/manage/2024/08/fiserv-forum-1536x576.jpg" },
  MIN: { name: "Target Center", image: "https://cdn.nba.com/manage/2024/08/target-center-1536x576.jpg" },
  NOP: { name: "Smoothie King Center", image: "https://cdn.nba.com/manage/2024/08/smoothie-king-center-1536x576.jpg" },
  NYK: { name: "Madison Square Garden", image: "https://cdn.nba.com/manage/2024/08/madison-square-garden-1536x576.jpg" },
  OKC: { name: "Paycom Center", image: "https://cdn.nba.com/manage/2024/08/paycom-center-1536x576.jpg" },
  ORL: { name: "Kia Center", image: "https://cdn.nba.com/manage/2024/08/kia-center-1536x576.jpg" },
  PHI: { name: "Wells Fargo Center", image: "https://cdn.nba.com/manage/2024/08/wells-fargo-center-1536x576.jpg" },
  PHX: { name: "Footprint Center", image: "https://cdn.nba.com/manage/2024/08/footprint-center-1536x576.jpg" },
  POR: { name: "Moda Center", image: "https://cdn.nba.com/manage/2024/08/moda-center-1536x576.jpg" },
  SAC: { name: "Golden 1 Center", image: "https://cdn.nba.com/manage/2024/08/golden-1-center-1536x576.jpg" },
  SAS: { name: "Frost Bank Center", image: "https://cdn.nba.com/manage/2024/08/frost-bank-center-1536x576.jpg" },
  TOR: { name: "Scotiabank Arena", image: "https://cdn.nba.com/manage/2024/08/scotiabank-arena-1536x576.jpg" },
  UTA: { name: "Delta Center", image: "https://cdn.nba.com/manage/2024/08/delta-center-1536x576.jpg" },
  WAS: { name: "Capital One Arena", image: "https://cdn.nba.com/manage/2024/08/capital-one-arena-1536x576.jpg" },
};

export function getVenue(tricode: string): VenueMeta | null {
  if (!tricode) return null;
  return NBA_VENUES[tricode.toUpperCase()] ?? null;
}