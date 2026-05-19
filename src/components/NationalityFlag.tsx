import { flagEmoji, countryLabel } from "@/lib/nationality";

interface Props {
  country: string | null | undefined;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  xs: "w-4 h-4 text-[10px]",
  sm: "w-5 h-5 text-xs",
  md: "w-6 h-6 text-sm",
};

/** Round flag badge backed by unicode regional-indicator emojis. */
export default function NationalityFlag({ country, size = "sm", showLabel = false, className = "" }: Props) {
  const flag = flagEmoji(country);
  const label = countryLabel(country);
  if (!flag && !label) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={label ?? undefined}>
      {flag && (
        <span
          aria-label={label ?? undefined}
          className={`inline-flex items-center justify-center rounded-full bg-foreground/10 border border-foreground/15 leading-none ${SIZES[size]}`}
        >
          {flag}
        </span>
      )}
      {showLabel && label && <span className="text-xs">{label}</span>}
    </span>
  );
}