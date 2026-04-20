export interface VenueMeta {
  name: string;
  image: string;
}

// Home arena name + Wikimedia-hosted exterior/interior photo for each NBA team.
// Images use Wikimedia Commons URLs (CC-licensed, hot-link friendly).
export const NBA_VENUES: Record<string, VenueMeta> = {
  ATL: { name: "State Farm Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/State_Farm_Arena_logo.svg/1200px-State_Farm_Arena_logo.svg.png" },
  BOS: { name: "TD Garden", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/TD_Garden_%28Boston%29.jpg/1200px-TD_Garden_%28Boston%29.jpg" },
  BKN: { name: "Barclays Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Barclays_Center_%28September_2019%29.jpg/1200px-Barclays_Center_%28September_2019%29.jpg" },
  CHA: { name: "Spectrum Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Spectrum_Center_Charlotte_North_Carolina.jpg/1200px-Spectrum_Center_Charlotte_North_Carolina.jpg" },
  CHI: { name: "United Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/United_Center_2019.jpg/1200px-United_Center_2019.jpg" },
  CLE: { name: "Rocket Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Rocket_Mortgage_FieldHouse_July_2019.jpg/1200px-Rocket_Mortgage_FieldHouse_July_2019.jpg" },
  DAL: { name: "American Airlines Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/American_Airlines_Center_December_2015.jpg/1200px-American_Airlines_Center_December_2015.jpg" },
  DEN: { name: "Ball Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Ball_Arena_2020.jpg/1200px-Ball_Arena_2020.jpg" },
  DET: { name: "Little Caesars Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Little_Caesars_Arena_Detroit_MI.jpg/1200px-Little_Caesars_Arena_Detroit_MI.jpg" },
  GSW: { name: "Chase Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Chase_Center_July_2019.jpg/1200px-Chase_Center_July_2019.jpg" },
  HOU: { name: "Toyota Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Toyota_Center_Houston%2C_Texas.jpg/1200px-Toyota_Center_Houston%2C_Texas.jpg" },
  IND: { name: "Gainbridge Fieldhouse", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Gainbridge_Fieldhouse_in_2022.jpg/1200px-Gainbridge_Fieldhouse_in_2022.jpg" },
  LAC: { name: "Intuit Dome", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Intuit_Dome_2024.jpg/1200px-Intuit_Dome_2024.jpg" },
  LAL: { name: "Crypto.com Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Crypto.com_Arena_LA.jpg/1200px-Crypto.com_Arena_LA.jpg" },
  MEM: { name: "FedExForum", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/FedExForum_in_Memphis_Tennessee.jpg/1200px-FedExForum_in_Memphis_Tennessee.jpg" },
  MIA: { name: "Kaseya Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Kaseya_Center_2023.jpg/1200px-Kaseya_Center_2023.jpg" },
  MIL: { name: "Fiserv Forum", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Fiserv_Forum_Milwaukee_2018.jpg/1200px-Fiserv_Forum_Milwaukee_2018.jpg" },
  MIN: { name: "Target Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Target_Center_2018.jpg/1200px-Target_Center_2018.jpg" },
  NOP: { name: "Smoothie King Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Smoothie_King_Center_2014.jpg/1200px-Smoothie_King_Center_2014.jpg" },
  NYK: { name: "Madison Square Garden", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Madison_Square_Garden_%28March_2024%29.jpg/1200px-Madison_Square_Garden_%28March_2024%29.jpg" },
  OKC: { name: "Paycom Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Paycom_Center_OKC.jpg/1200px-Paycom_Center_OKC.jpg" },
  ORL: { name: "Kia Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Amway_Center_2017.jpg/1200px-Amway_Center_2017.jpg" },
  PHI: { name: "Wells Fargo Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Wells_Fargo_Center_Philadelphia_2019.jpg/1200px-Wells_Fargo_Center_Philadelphia_2019.jpg" },
  PHX: { name: "Footprint Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Footprint_Center_Phoenix_2022.jpg/1200px-Footprint_Center_Phoenix_2022.jpg" },
  POR: { name: "Moda Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Moda_Center_Portland_2018.jpg/1200px-Moda_Center_Portland_2018.jpg" },
  SAC: { name: "Golden 1 Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Golden_1_Center_2017.jpg/1200px-Golden_1_Center_2017.jpg" },
  SAS: { name: "Frost Bank Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Frost_Bank_Center_San_Antonio_2023.jpg/1200px-Frost_Bank_Center_San_Antonio_2023.jpg" },
  TOR: { name: "Scotiabank Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Scotiabank_Arena_Toronto_2019.jpg/1200px-Scotiabank_Arena_Toronto_2019.jpg" },
  UTA: { name: "Delta Center", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Delta_Center_Salt_Lake_City_2024.jpg/1200px-Delta_Center_Salt_Lake_City_2024.jpg" },
  WAS: { name: "Capital One Arena", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Capital_One_Arena_2018.jpg/1200px-Capital_One_Arena_2018.jpg" },
};

export function getVenue(tricode: string): VenueMeta | null {
  if (!tricode) return null;
  return NBA_VENUES[tricode.toUpperCase()] ?? null;
}