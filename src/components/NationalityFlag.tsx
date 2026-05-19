import { isoCode, countryLabel } from "@/lib/nationality";

interface Props {
  country: string | null | undefined;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
};

/** Round flag badge backed by flagcdn.com SVG/PNG images. */
export default function NationalityFlag({ country, size = "sm", showLabel = false, className = "" }: Props) {
  const iso = isoCode(country);
  const label = countryLabel(country);
  if (!iso && !label) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={label ?? undefined}>
      {iso && (
        <img
          src={`https://flagcdn.com/w40/${iso}.png`}
          srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
          alt={label ?? iso.toUpperCase()}
          title={label ?? undefined}
          loading="lazy"
          className={`inline-block rounded-full object-cover ring-1 ring-foreground/15 ${SIZES[size]}`}
        />
      )}
      {showLabel && label && <span className="text-xs">{label}</span>}
    </span>
  );
}