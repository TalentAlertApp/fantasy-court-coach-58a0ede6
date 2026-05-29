import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import euroleagueLogo from "@/assets/euroleague-logo.png";
import { HOOPSFANTASY_NAME } from "@/lib/hoopsfantasy-brand";

/**
 * Canonical brand bundle for onboarding surfaces: the three league logos
 * followed by the HOOPSFANTASY wordmark. Single source of truth so every
 * onboarding page renders identical order, size, and spacing.
 */
export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src={wnbaLogo} alt="WNBA" className="h-9 w-auto object-contain" />
      <img src={nbaLogo} alt="NBA" className="h-9 w-auto object-contain" />
      <img src={euroleagueLogo} alt="EuroLeague" className="h-9 w-auto object-contain" />
      <span className="text-xs font-heading uppercase tracking-[0.3em] text-foreground/70">
        {HOOPSFANTASY_NAME}
      </span>
    </div>
  );
}