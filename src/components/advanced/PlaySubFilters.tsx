import { useMemo, useState } from "react";
import {
  ActionType, SubFilterState, QUALIFIERS, SUBTYPES, AREA_ACTIONS, AREA_VALUES, AreaValue,
  SHOT_RESULT_ACTIONS, AFTER_TIMEOUT_ACTIONS, BUZZER_BEATER_ACTIONS, distanceBoundsFor,
} from "@/lib/play-filter-config";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import PlayCourtZones from "./PlayCourtZones";

interface Props {
  actions: ActionType[];
  value: SubFilterState;
  onChange: (next: SubFilterState) => void;
}

function unionList(actions: ActionType[], map: Partial<Record<ActionType, string[]>>): string[] {
  const set = new Set<string>();
  for (const a of actions) for (const v of map[a] ?? []) set.add(v);
  return Array.from(set);
}

function ChipGroup({
  label, options, selected, onToggle,
}: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;
  const visible = expanded || options.length <= 5 ? options : options.slice(0, 5);
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(
                "px-2 py-1 rounded-md border text-[11px] font-medium transition-colors",
                on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {opt}
            </button>
          );
        })}
        {options.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="px-2 py-1 rounded-md border border-dashed border-border text-[11px] font-medium text-muted-foreground hover:bg-muted"
          >
            {expanded ? "Show less" : `Show more (+${options.length - 5})`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PlaySubFilters({ actions, value, onChange }: Props) {
  if (actions.length === 0) return null;

  const qualifierOpts = useMemo(() => unionList(actions, QUALIFIERS), [actions]);
  const subtypeOpts = useMemo(() => unionList(actions, SUBTYPES), [actions]);
  const showShotResult = actions.some((a) => SHOT_RESULT_ACTIONS.includes(a));
  const showAfterTimeout = actions.some((a) => AFTER_TIMEOUT_ACTIONS.includes(a));
  const showBuzzer = actions.some((a) => BUZZER_BEATER_ACTIONS.includes(a));
  const showArea = actions.some((a) => AREA_ACTIONS.includes(a));
  const distBounds = distanceBoundsFor(actions);

  const toggle = <T extends string>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const update = (patch: Partial<SubFilterState>) => onChange({ ...value, ...patch });

  // Initialize distance defaults when first showing
  const minVal = value.shotdistancemin ?? distBounds?.min ?? 0;
  const maxVal = value.shotdistancemax ?? distBounds?.max ?? 0;

  const hasAnyFilter =
    qualifierOpts.length > 0 || subtypeOpts.length > 0 || showShotResult ||
    showAfterTimeout || showBuzzer || showArea || distBounds !== null;

  if (!hasAnyFilter) return null;

  return (
    <div className="border border-border rounded-lg bg-muted/20 p-3 space-y-3">
      <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
        Refine plays
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <ChipGroup
            label="Qualifiers"
            options={qualifierOpts}
            selected={value.qualifiers}
            onToggle={(v) => update({ qualifiers: toggle(value.qualifiers, v) })}
          />
          <ChipGroup
            label="Subtype"
            options={subtypeOpts}
            selected={value.subtype}
            onToggle={(v) => update({ subtype: toggle(value.subtype, v) })}
          />
          {showShotResult && (
            <ChipGroup
              label="Shot Result"
              options={["Made", "Missed"]}
              selected={value.shotresult}
              onToggle={(v) => update({ shotresult: toggle(value.shotresult, v) })}
            />
          )}
          <div className="flex flex-wrap gap-4">
            {showAfterTimeout && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={value.isaftertimeout}
                  onCheckedChange={(v) => update({ isaftertimeout: v })}
                  id="isaftertimeout"
                />
                <Label htmlFor="isaftertimeout" className="text-[11px] font-heading uppercase tracking-wider cursor-pointer">
                  After Timeout
                </Label>
              </div>
            )}
            {showBuzzer && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={value.isbuzzerbeater}
                  onCheckedChange={(v) => update({ isbuzzerbeater: v })}
                  id="isbuzzerbeater"
                />
                <Label htmlFor="isbuzzerbeater" className="text-[11px] font-heading uppercase tracking-wider cursor-pointer">
                  Buzzer Beater
                </Label>
              </div>
            )}
          </div>
        </div>

        {showArea && (
          <div className="space-y-2">
            <Label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
              Court Area {distBounds && `· ${minVal} ft – ${maxVal} ft`}
            </Label>
            <PlayCourtZones
              selectedAreas={value.area}
              onToggleArea={(a: AreaValue) => update({ area: toggle(value.area, a) })}
              distanceMin={distBounds ? minVal : null}
              distanceMax={distBounds ? maxVal : null}
              actions={actions}
            />
            {distBounds && (
              <div className="space-y-1.5 pt-1">
                <Slider
                  min={distBounds.min}
                  max={distBounds.max}
                  step={1}
                  value={[minVal, maxVal]}
                  onValueChange={([lo, hi]) => update({ shotdistancemin: lo, shotdistancemax: hi })}
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{distBounds.min} ft</span>
                  <span className="text-foreground font-bold">{minVal} – {maxVal} ft</span>
                  <span>{distBounds.max} ft</span>
                </div>
              </div>
            )}
            {value.area.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {value.area.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => update({ area: value.area.filter((x) => x !== a) })}
                    className="px-1.5 py-0.5 rounded bg-[hsl(var(--nba-yellow))]/15 text-[10px] font-medium border border-[hsl(var(--nba-yellow))]/40 hover:bg-[hsl(var(--nba-yellow))]/25"
                  >
                    {a} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}