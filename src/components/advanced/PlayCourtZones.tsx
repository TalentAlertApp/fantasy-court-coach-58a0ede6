import { useMemo } from "react";
import courtBg from "@/assets/court-bg.png";
import { AREA_VALUES, AreaValue, distanceBoundsFor, ActionType } from "@/lib/play-filter-config";

/**
 * Half-court overlay: 6 clickable area zones + concentric distance arcs.
 * Coordinate system: viewBox 0 0 400 320. Basket near top-center at (200, 30).
 */

const ZONE_PATHS: Record<AreaValue, string> = {
  // Restricted Area: small arc-bounded box directly under rim
  "Restricted Area": "M170,30 L170,75 A30,30 0 0 0 230,75 L230,30 Z",
  // Paint (key) minus restricted area
  "In The Paint (Non-RA)":
    "M150,30 L150,140 L250,140 L250,30 L230,30 L230,75 A30,30 0 0 1 170,75 L170,30 Z",
  // Mid-range: inside 3pt arc, outside paint (single big polygon)
  "Mid-Range":
    "M40,30 L40,90 A160,160 0 0 0 360,90 L360,30 L250,30 L250,140 L150,140 L150,30 Z",
  // Above the break 3 (top wedge outside arc)
  "Above the Break 3":
    "M40,30 L40,90 A160,160 0 0 1 360,90 L360,30 Z M40,30",
  // Left corner 3
  "Left Corner 3": "M0,30 L40,30 L40,160 L0,160 Z",
  // Right corner 3
  "Right Corner 3": "M360,30 L400,30 L400,160 L360,160 Z",
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

  // Concentric arcs from basket. Map feet → pixels: roughly 5px / ft (max 71ft fits within 360px radius).
  const arcs = useMemo(() => {
    if (!bounds) return [];
    const stepFt = 5;
    const feet: number[] = [];
    for (let f = bounds.min; f <= bounds.max; f += stepFt) feet.push(f);
    if (feet[feet.length - 1] !== bounds.max) feet.push(bounds.max);
    return feet;
  }, [bounds]);

  const ftToR = (ft: number) => ft * 5; // ~5px per foot
  const cx = 200;
  const cy = 30;

  return (
    <div className="relative w-full max-w-md aspect-[5/4] rounded-lg overflow-hidden border border-border bg-muted/30">
      <img src={courtBg} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-50 select-none" draggable={false} />
      <svg viewBox="0 0 400 320" className="absolute inset-0 w-full h-full">
        {/* Distance arc bands underlay */}
        {showDistance && arcs.map((ft, i) => {
          if (i === 0) return null;
          const inside = distanceMin != null && distanceMax != null && ft > distanceMin && ft <= distanceMax + 0.001;
          return (
            <circle
              key={ft}
              cx={cx}
              cy={cy}
              r={ftToR(ft)}
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
            d={`M ${cx - ftToR(distanceMax)} ${cy}
                A ${ftToR(distanceMax)} ${ftToR(distanceMax)} 0 0 0 ${cx + ftToR(distanceMax)} ${cy}
                L ${cx + ftToR(distanceMin)} ${cy}
                A ${ftToR(distanceMin)} ${ftToR(distanceMin)} 0 0 1 ${cx - ftToR(distanceMin)} ${cy}
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
              className="cursor-pointer transition-all hover:fill-opacity-25"
              onClick={() => onToggleArea(zone)}
            >
              <title>{zone}</title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}