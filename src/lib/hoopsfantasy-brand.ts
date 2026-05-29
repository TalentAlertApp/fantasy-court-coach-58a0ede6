import type { CompetitionCode } from "@/lib/competitions";
import hfLogoWnba from "@/assets/hf-logo-wnba.png";
import hfLogoNba from "@/assets/hf-logo-nba.png";
import hfLogoBlackGold from "@/assets/hf-logo-black-gold.png";
import hfLogoEuroleague from "@/assets/hf-logo-euroleague.png";

export const HOOPSFANTASY_NAME = "HoopsFantasy";
export const HOOPSFANTASY_MANAGER_NAME = "HoopsFantasy Manager";

type HoopsFantasyLogoVariant = "league" | "blackGold";

const HF_LOGOS = {
  wnba: hfLogoWnba,
  nba: hfLogoNba,
  euroleague: hfLogoEuroleague,
  blackGold: hfLogoBlackGold,
} as const;

const HF_PUBLIC_LOGOS = {
  wnba: "/hf-logo-wnba.png",
  nba: "/hf-logo-nba.png",
  euroleague: "/hf-logo-euroleague.png",
  blackGold: "/hf-logo-black-gold.png",
} as const;

function normalizeLeague(code?: CompetitionCode | string | null): CompetitionCode {
  if (code === "wnba" || code === "euroleague") return code;
  return "nba";
}

export function getHoopsFantasyLogo(
  code?: CompetitionCode | string | null,
  variant: HoopsFantasyLogoVariant = "league",
): string {
  if (variant === "blackGold") return HF_LOGOS.blackGold;
  const league = normalizeLeague(code);
  return HF_LOGOS[league];
}

export function getHoopsFantasyPublicLogo(
  code?: CompetitionCode | string | null,
  variant: HoopsFantasyLogoVariant = "league",
): string {
  if (variant === "blackGold") return HF_PUBLIC_LOGOS.blackGold;
  const league = normalizeLeague(code);
  return HF_PUBLIC_LOGOS[league];
}

export function getHoopsFantasyFaviconPool(): string[] {
  return [
    HF_PUBLIC_LOGOS.wnba,
    HF_PUBLIC_LOGOS.nba,
    HF_PUBLIC_LOGOS.blackGold,
    HF_PUBLIC_LOGOS.euroleague,
  ];
}