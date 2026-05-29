import { useEffect, useState } from "react";
import { getHoopsFantasyLogo } from "@/lib/hoopsfantasy-brand";
import type { CompetitionCode } from "@/lib/competitions";
import { cn } from "@/lib/utils";

interface Props {
  /** Drives the splash — trigger it by passing the modal's open state. */
  open: boolean;
  league?: CompetitionCode | string | null;
  /** Total time the logo is held before it fades out (ms). */
  holdMs?: number;
}

/**
 * A brief, non-blocking branded moment: the large HoopsFantasy logo
 * fades + scales in over the modal surface when it opens, then fades out.
 * Purely decorative — never intercepts pointer events.
 */
export default function LogoSplash({ open, league, holdMs = 850 }: Props) {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");

  useEffect(() => {
    if (!open) {
      setPhase("hidden");
      return;
    }
    setPhase("in");
    const t1 = window.setTimeout(() => setPhase("out"), holdMs);
    const t2 = window.setTimeout(() => setPhase("hidden"), holdMs + 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, holdMs]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-[450ms] ease-out"
        style={{ opacity: phase === "in" ? 1 : 0 }}
      />
      <img
        src={getHoopsFantasyLogo(league)}
        alt=""
        draggable={false}
        className={cn(
          "relative h-40 w-40 md:h-52 md:w-52 object-contain select-none transition-all ease-out",
          phase === "in"
            ? "opacity-100 scale-100 duration-[500ms]"
            : "opacity-0 scale-110 duration-[450ms]",
        )}
        style={{
          filter: "drop-shadow(0 12px 50px hsl(var(--accent) / 0.35))",
          ...(phase === "in" ? { animationDelay: "0ms" } : {}),
        }}
      />
    </div>
  );
}