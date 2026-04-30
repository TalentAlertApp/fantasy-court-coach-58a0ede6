import { useMemo } from "react";
import courtBg from "@/assets/court-bg.png";
import { AREA_VALUES, AreaValue, distanceBoundsFor, ActionType } from "@/lib/play-filter-config";

/**
 * Half-court overlay: 6 clickable area zones + concentric distance arcs.
 * Coordinate system: viewBox 0 0 600 320. Basket near top-center at (300, 30).
 * Widened from 400 to 600 (×1.5 horizontal scale) so the court matches the
 * full-width distance slider beneath it. Vertical metrics (height, arc radii)
 * are unchanged so the visual height of the court stays the same.
 */

const ZONE_PATHS: Record<AreaValue, string> = {
  // Restricted Area: small arc-bounded box directly under rim
  "Restricted Area": "M255,30 L255,75 A45,45 0 0 0 345,75 L345,30 Z",
  // Paint (key) minus restricted area
  "In The Paint (Non-RA)":
    "M225,30 L225,140 L375,140 L375,30 L345,30 L345,75 A45,45 0 0 1 255,75 L255,30 Z",
  // Mid-range: inside 3pt arc, outside paint
  "Mid-Range":
    "M60,30 L60,90 A240,160 0 0 0 540,90 L540,30 L375,30 L375,140 L225,140 L225,30 Z",
  // Above the break 3 (top wedge outside arc)
  "Above the Break 3":
    "M60,30 L60,90 A240,160 0 0 1 540,90 L540,30 Z M60,30",
  // Left corner 3
  "Left Corner 3": "M0,30 L60,30 L60,160 L0,160 Z",
  // Right corner 3
  "Right Corner 3": "M540,30 L600,30 L600,160 L540,160 Z",
};

interface Props {
  selectedAreas: AreaValue[];
  onToggleArea: (a: AreaValue) => void;
  /** Distance range (in feet) — only for shooting actions. */
  distanceMin?: number | null;
  distanceMax?: number | null;
  actions: ActionType[];
}

export default function PlayCourtZones({ selectedAreas, onToggleArea, distanceMin, distanceMax, actions }: Props) {
  const bounds = distanceBoundsFor(actions);
  const showDistance = bounds !== null;
  const hasSelection = selectedAreas.length > 0;

  // Concentric arcs from basket. Map feet → pixels: ~5px/ft vertical, ~7.5px/ft horizontal.
  const arcs = useMemo(() => {
    if (!bounds) return [];
    const stepFt = 5;
    const feet: number[] = [];
    for (let f = bounds.min; f <= bounds.max; f += stepFt) feet.push(f);
    if (feet[feet.length - 1] !== bounds.max) feet.push(bounds.max);
    return feet;
  }, [bounds]);

  const ftToRy = (ft: number) => ft * 5; // ~5px per foot vertical
  const ftToRx = (ft: number) => ft * 7.5; // ~7.5px per foot horizontal (1.5× to match new width)
  const cx = 300;
  const cy = 30;

  return (
    <div className="space-y-1.5">
    <div className="relative w-full aspect-[15/8] rounded-lg overflow-hidden border border-border bg-muted/30 group">
      <img src={courtBg} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-50 select-none" draggable={false} />
      {/* Hint chip — fades out once user has made a selection */}
      <div
        className={`pointer-events-none absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md border border-[hsl(var(--nba-yellow))]/40 bg-background/80 backdrop-blur-sm px-2 py-0.5 text-[9px] font-heading uppercase tracking-wider text-[hsl(var(--nba-yellow))] shadow-sm transition-opacity ${hasSelection ? "opacity-0" : "opacity-100"}`}
      >
        Tap zones to filter
      </div>
      <svg viewBox="0 0 600 320" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {/* Distance arc bands underlay */}
        {showDistance && arcs.map((ft, i) => {
          if (i === 0) return null;
          const inside = distanceMin != null && distanceMax != null && ft > distanceMin && ft <= distanceMax + 0.001;
          return (
            <ellipse
              key={ft}
              cx={cx}
              cy={cy}
              rx={ftToRx(ft)}
              ry={ftToRy(ft)}
              fill="none"
              stroke="hsl(var(--nba-yellow))"
              strokeOpacity={inside ? 0.55 : 0.12}
              strokeWidth={inside ? 1.5 : 0.75}
            />
          );
        })}
        {/* Highlighted distance band overlay */}
        {showDistance && distanceMin != null && distanceMax != null && distanceMax > distanceMin && (
          <path
            d={`M ${cx - ftToRx(distanceMax)} ${cy}
                A ${ftToRx(distanceMax)} ${ftToRy(distanceMax)} 0 0 0 ${cx + ftToRx(distanceMax)} ${cy}
                L ${cx + ftToRx(distanceMin)} ${cy}
                A ${ftToRx(distanceMin)} ${ftToRy(distanceMin)} 0 0 1 ${cx - ftToRx(distanceMin)} ${cy}
                Z`}
            fill="hsl(var(--nba-yellow))"
            fillOpacity={0.10}
          />
        )}

        {/* Area zones */}
        {AREA_VALUES.map((zone) => {
          const selected = selectedAreas.includes(zone);
          return (
            <path
              key={zone}
              d={ZONE_PATHS[zone]}
              fill="hsl(var(--nba-yellow))"
              fillOpacity={selected ? 0.45 : 0}
              stroke="hsl(var(--nba-yellow))"
              strokeOpacity={selected ? 0.9 : 0.25}
              strokeWidth={selected ? 1.5 : 0.75}
              className={`cursor-pointer transition-all hover:fill-opacity-25 ${!hasSelection ? "court-zone-pulse" : ""}`}
              onClick={() => onToggleArea(zone)}
            >
              <title>{zone}</title>
            </path>
          );
        })}
      </svg>
    </div>
    <p className="text-[10px] text-muted-foreground text-center">
      Click a zone on the court to filter by area. {showDistance && "Yellow rings show shot distance."}
    </p>
    </div>
  );
}