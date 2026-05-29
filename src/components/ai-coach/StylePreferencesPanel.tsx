import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Loader2, UserRound, Wand2,
  DollarSign, GraduationCap, Ruler, Flame, Heart,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useLeague } from "@/contexts/LeagueContext";
import { getHoopsFantasyLogo } from "@/lib/hoopsfantasy-brand";
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
  const { league } = useLeague();
  const logoByTri = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) m.set(t.tricode, t.logo);
    return m;
  }, [teams]);
  const nameByTri = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) m.set(t.tricode, t.name);
    return m;
  }, [teams]);
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
    <TooltipProvider delayDuration={150}>
    <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-b from-card to-card/60 px-4 pt-3 pb-5 md:px-6 md:pt-4 md:pb-7 shadow-[0_30px_80px_-40px_hsl(var(--accent)/0.4)] space-y-5 md:space-y-6">
      {/* HoopsFantasy watermark — top right, surges on hover */}
      <img
        src={getHoopsFantasyLogo(league)}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-auto select-none absolute top-3 right-3 z-10 h-20 w-20 md:h-24 md:w-24 object-contain opacity-25 transition-all duration-300 ease-out hover:opacity-70 hover:scale-110 drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
      />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-accent" />
          <p className="font-heading uppercase tracking-[0.22em] text-sm font-bold">
            Tell the coach your style
          </p>
        </div>
        <p className="text-[11px] md:text-xs text-muted-foreground pl-7">
          Five quick choices. We'll build a legal lineup that matches your vibe.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 md:gap-7">
      <div className="space-y-4">
      {/* Archetype */}
      <Section icon={<DollarSign className="h-3.5 w-3.5 text-accent" />} label="Salary archetype">
        <div className="grid sm:grid-cols-3 gap-2">
          {ARCHETYPES.map((a) => {
            const active = archetype === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setArchetype(a.id)}
                className={`text-left rounded-xl border-2 p-2.5 transition-all hover:-translate-y-0.5 ${
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
      </Section>

      <Section icon={<GraduationCap className="h-3.5 w-3.5 text-accent" />} label="Experience">
        <TiltSlider left="Rookies" right="Vets" value={experienceTilt} onChange={setExperienceTilt} />
      </Section>
      <Section icon={<Ruler className="h-3.5 w-3.5 text-accent" />} label="Size">
        <TiltSlider left="Guards" right="Bigs" value={sizeTilt} onChange={setSizeTilt} />
      </Section>
      <Section icon={<Flame className="h-3.5 w-3.5 text-accent" />} label="Risk appetite">
        <TiltSlider left="Safe floor" right="Boom or bust" value={riskTilt} onChange={setRiskTilt} />
      </Section>
      </div>

      <div className="space-y-4">
      {/* Favourite teams — borderless badges */}
      <Section
        icon={<Heart className="h-3.5 w-3.5 text-accent" />}
        label={`Favourite teams · pick up to 3 (${favouriteTeams.length}/3)`}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {teams.map((t) => {
            const active = favouriteTeams.includes(t.tricode);
            return (
              <Tooltip key={t.tricode}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggleTeam(t.tricode)}
                    aria-label={t.name}
                    className={`group relative inline-flex items-center justify-center bg-transparent transition-all duration-200 ${
                      active
                        ? "scale-[1.30] drop-shadow-[0_0_12px_hsl(var(--accent)/0.7)]"
                        : "opacity-70 hover:opacity-100 hover:scale-[1.15] hover:drop-shadow-[0_0_8px_hsl(var(--accent)/0.5)]"
                    }`}
                  >
                    <img
                      src={t.logo}
                      alt={t.tricode}
                      className="h-8 w-8 object-contain"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{t.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </Section>

      {/* Live preview */}
      {preview && (
        <div className="rounded-xl border border-accent/40 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-3 space-y-2">
          <CaptainPreview captain={preview.captain} logoByTri={logoByTri} nameByTri={nameByTri} />
          <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-accent/20">
            <Stat label="Salary used" value={`$${preview.totalSalary.toFixed(1)}M`} />
            <Stat label="Roster" value={preview.legal ? "Legal ✓" : `${preview.starters.length + preview.bench.length}/10`} />
          </div>
        </div>
      )}
      </div>
      </div>

      <Button
        onClick={() => onDraft(prefs)}
        disabled={busy || !players.length}
        size="lg"
        className="w-full font-heading uppercase tracking-widest h-11 text-sm shadow-[0_8px_30px_-8px_hsl(var(--accent)/0.6)]"
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
    </TooltipProvider>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

function CaptainPreview({
  captain, logoByTri, nameByTri,
}: {
  captain: DraftPlayer | null;
  logoByTri: Map<string, string>;
  nameByTri: Map<string, string>;
}) {
  if (!captain) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-muted/50 animate-pulse" />
        <div>
          <p className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground">Captain</p>
          <p className="text-sm text-muted-foreground italic">Awaiting picks…</p>
        </div>
      </div>
    );
  }
  const tri = captain.core.team;
  const logo = logoByTri.get(tri);
  return (
    <div>
      <p className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5">Captain</p>
      <div className="flex items-center gap-3">
      {captain.core.photo ? (
        <img
          src={captain.core.photo}
          alt={captain.core.name}
          className="h-12 w-12 rounded-full object-cover object-top bg-background drop-shadow-[0_4px_12px_hsl(var(--accent)/0.4)] transition-transform hover:scale-110"
        />
      ) : (
        <div className="h-12 w-12 rounded-full bg-muted/50" />
      )}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <p className="font-heading text-sm font-bold truncate">{captain.core.name}</p>
        {logo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <img
                src={logo}
                alt={tri}
                className="h-6 w-6 object-contain shrink-0 transition-transform hover:scale-[1.20] hover:drop-shadow-[0_0_8px_hsl(var(--accent)/0.5)]"
              />
            </TooltipTrigger>
            <TooltipContent>{nameByTri.get(tri) ?? tri}</TooltipContent>
          </Tooltip>
        )}
      </div>
      </div>
    </div>
  );
}

function TiltSlider({
  left, right, value, onChange,
}: { left: string; right: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Slider
        min={-1}
        max={1}
        step={0.25}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
      />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
        <span>{left}</span>
        <span>{right}</span>
      </div>
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