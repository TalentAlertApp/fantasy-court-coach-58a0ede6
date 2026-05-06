import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";

type Size = "xs" | "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

/**
 * Renders the official NBA / WNBA logo as a small badge.
 * Replaces text chips like "NBA" / "WNBA" while preserving accessibility.
 */
export default function LeagueLogoBadge({
  league,
  size = "sm",
  withLabel = false,
  className = "",
}: {
  league?: "nba" | "wnba" | string | null;
  size?: Size;
  withLabel?: boolean;
  className?: string;
}) {
  const code = (league ?? "nba").toString().toLowerCase() === "wnba" ? "wnba" : "nba";
  const src = code === "wnba" ? wnbaLogo : nbaLogo;
  const label = code.toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-1 align-middle ${className}`}
      title={label}
      aria-label={`League: ${label}`}
    >
      <img
        src={src}
        alt={label}
        loading="lazy"
        width={20}
        height={20}
        className={`${SIZE_CLASS[size]} object-contain shrink-0`}
      />
      {withLabel && (
        <span className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
    </span>
  );
}
