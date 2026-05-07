import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Bot, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import {
  buildPersonalisedRoster,
  type DraftPlayer,
  type DraftPreferences,
  type SalaryArchetype,
} from "@/lib/personalised-draft";

interface Props {
  players: DraftPlayer[];
  busy: boolean;
  onDraft: (prefs: DraftPreferences) => void;
}

const ARCHETYPES: { id: SalaryArchetype; title: string; sub: string }[] = [
  { id: "stars_scrubs", title: "Stars & Scrubs", sub: "2-3 max-salary studs + cheap value plays" },
  { id: "balanced",     title: "Balanced",        sub: "Even salaries, no single player above ~$14M" },
  { id: "studs_only",   title: "Studs Only",      sub: "Pack the top of the salary sheet" },
];

export default function StylePreferencesPanel({ players, busy, onDraft }: Props) {
  const { teams } = useLeagueTeams();
  const [archetype, setArchetype] = useState<SalaryArchetype>("balanced");
  const [experienceTilt, setExperienceTilt] = useState(0);
  const [sizeTilt, setSizeTilt] = useState(0);
  const [riskTilt, setRiskTilt] = useState(0);
  const [favouriteTeams, setFavouriteTeams] = useState<string[]>([]);

  const prefs: DraftPreferences = {
    archetype, experienceTilt, sizeTilt, riskTilt, favouriteTeams,
  };

  const preview = useMemo(() => {
    if (!players.length) return null;
    return buildPersonalisedRoster(players, prefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, archetype, experienceTilt, sizeTilt, riskTilt, favouriteTeams.join(",")]);

  const toggleTeam = (tri: string) => {
    setFavouriteTeams((prev) =>
      prev.includes(tri) ? prev.filter((t) => t !== tri) : prev.length >= 3 ? prev : [...prev, tri],
    );
  };

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="font-heading uppercase tracking-[0.18em] text-xs font-bold">
          Tell the coach your style
        </p>
      </div>

      {/* Archetype */}
      <div className="space-y-2">
        <p className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">
          Salary archetype
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          {ARCHETYPES.map((a) => {
            const active = archetype === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setArchetype(a.id)}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  active
                    ? "border-accent bg-accent/10 shadow-[0_0_30px_-12px_hsl(var(--accent))]"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <p className="font-heading uppercase text-[11px] tracking-wider">{a.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{a.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <TiltSlider label="Experience" left="Rookies" right="Vets" value={experienceTilt} onChange={setExperienceTilt} />
      <TiltSlider label="Size" left="Guards" right="Bigs" value={sizeTilt} onChange={setSizeTilt} />
      <TiltSlider label="Risk appetite" left="Safe floor" right="Boom or bust" value={riskTilt} onChange={setRiskTilt} />

      {/* Favourite teams */}
      <div className="space-y-2">
        <p className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">
          Favourite teams · pick up to 3 ({favouriteTeams.length}/3)
        </p>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
          {teams.map((t) => {
            const active = favouriteTeams.includes(t.tricode);
            return (
              <button
                key={t.tricode}
                type="button"
                onClick={() => toggleTeam(t.tricode)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                  active
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {t.tricode}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="rounded-xl border-2 border-dashed border-accent/30 bg-accent/[0.04] p-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Salary used" value={`$${preview.totalSalary.toFixed(1)}M`} />
          <Stat label="Captain" value={preview.captain?.core.name.split(" ").slice(-1)[0] ?? "—"} />
          <Stat label="Roster" value={preview.legal ? "Legal ✓" : `${preview.starters.length + preview.bench.length}/10`} />
        </div>
      )}

      <Button
        onClick={() => onDraft(prefs)}
        disabled={busy || !players.length}
        size="lg"
        className="w-full font-heading uppercase tracking-widest"
      >
        {busy ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Drafting…</>
        ) : (
          <><Wand2 className="h-4 w-4 mr-2" /> Draft my personalised squad</>
        )}
      </Button>
      {preview && preview.warnings.length > 0 && (
        <p className="text-[10px] text-amber-600 text-center">
          {preview.warnings[0]} We'll save the closest legal lineup.
        </p>
      )}
    </div>
  );
}

function TiltSlider({
  label, left, right, value, onChange,
}: { label: string; left: string; right: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{left} ↔ {right}</p>
      </div>
      <Slider
        min={-1}
        max={1}
        step={0.25}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-heading text-sm font-bold">{value}</p>
    </div>
  );
}