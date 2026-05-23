import { cn } from "@/lib/utils";
import { FANTASY_COMPETITIONS, type CompetitionCode } from "@/lib/competitions";

type League = CompetitionCode;
type Size = "md" | "lg";

const FULL_NAME: Record<League, string> = {
  nba: "National Basketball Association",
  wnba: "Women's National Basketball Association",
  euroleague: "Turkish Airlines EuroLeague",
};

interface Props {
  value: League;
  onChange: (v: League) => void;
  size?: Size;
  disabled?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export default function LeaguePickerCards({
  value, onChange, size = "md", disabled, showSubtitle, className,
}: Props) {
  const big = size === "lg";
  const cardCls = big ? "min-h-44 md:min-h-52 py-4" : "min-h-32 py-3";
  const logoCls = big ? "h-24 w-24 md:h-28 md:w-28" : "h-16 w-16";
  const nameCls = big ? "text-lg md:text-xl tracking-[0.15em]" : "text-sm tracking-[0.2em]";

  const gridCols = FANTASY_COMPETITIONS.length >= 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={cn("grid gap-4", gridCols, className)}>
      {FANTASY_COMPETITIONS.map((comp) => {
        const c = comp.code;
        const m = { name: comp.label, full: FULL_NAME[c], logo: comp.logo, tint: comp.tint, scale: comp.logoScale ?? 1 };
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            disabled={disabled}
            aria-pressed={active}
            aria-label={`Select ${m.name}`}
            className={cn(
              "group relative overflow-hidden rounded-2xl border transition-all duration-300",
              "flex flex-col items-center justify-center gap-3 p-4",
              cardCls,
              active
                ? "border-accent bg-accent/5 shadow-[0_0_40px_-10px_hsl(var(--accent))] scale-[1.02]"
                : "border-foreground/15 bg-foreground/5 hover:border-accent/60 hover:bg-foreground/10 hover:-translate-y-0.5",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {/* gradient backdrop */}
            <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", m.tint)} aria-hidden />
            {/* watermark logo */}
            <img
              src={m.logo}
              alt=""
              aria-hidden
              className={cn(
                "pointer-events-none absolute -right-6 -bottom-6 object-contain blur-[1px]",
                big ? "h-40 w-40" : "h-28 w-28",
                active ? "opacity-[0.18]" : "opacity-[0.10]",
              )}
            />
            {/* active halo */}
            {active && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-accent/40 animate-pulse" aria-hidden />
            )}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <img
                src={m.logo}
                alt={m.name}
                style={m.scale !== 1 ? { transform: `scale(${m.scale})` } : undefined}
                className={cn(
                  logoCls,
                  "object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-transform duration-300",
                  active ? "scale-105" : "group-hover:scale-105",
                )}
              />
              <span className={cn("font-heading font-black uppercase text-center leading-tight max-w-full px-1", nameCls, active ? "text-foreground" : "text-foreground/80")}>
                {m.name}
              </span>
              {showSubtitle && (
                <span className="text-[10px] uppercase tracking-[0.15em] leading-relaxed text-foreground/50 text-center max-w-[22ch] hyphens-none">
                  {m.full}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}