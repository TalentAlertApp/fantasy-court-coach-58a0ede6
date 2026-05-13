import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateLeague, type CreateLeagueInput } from "@/hooks/useCreateLeague";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";
import { cn } from "@/lib/utils";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";

type StatKey = "pts" | "reb" | "ast" | "stl" | "blk" | "to";
type Preset = "classic" | "guards_boost" | "bigs_boost" | "custom";

const PRESETS: Record<Exclude<Preset, "custom">, Record<StatKey, number>> = {
  classic:      { pts: 1, reb: 1, ast: 2, stl: 3, blk: 3, to: 0 },
  guards_boost: { pts: 1, reb: 1, ast: 3, stl: 4, blk: 2, to: 0 },
  bigs_boost:   { pts: 1, reb: 2, ast: 1, stl: 2, blk: 4, to: 0 },
};

const TOTAL_STEPS = 7;

export default function CreateLeaguePage() {
  const navigate = useNavigate();
  const { createLeague, isLoading, error } = useCreateLeague();
  const { setSelectedLeagueId } = useFantasyLeague();

  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "invite_only" | "public">("private");

  // Step 2
  const [sport, setSport] = useState<"nba" | "wnba">("nba");

  // Step 3
  const [preset, setPreset] = useState<Preset>("classic");
  const [weights, setWeights] = useState<Record<StatKey, number>>({ ...PRESETS.classic });
  const [toEnabled, setToEnabled] = useState(false);
  const [captainMultiplier, setCaptainMultiplier] = useState(2);

  // Step 4
  const [budgetCapEnabled, setBudgetCapEnabled] = useState(true);
  const [budgetCap, setBudgetCap] = useState(100);
  const [benchCount, setBenchCount] = useState(5);
  const [maxPerTeamEnabled, setMaxPerTeamEnabled] = useState(true);
  const [maxPerTeam, setMaxPerTeam] = useState(2);

  // Step 5
  const [deadlineType, setDeadlineType] = useState<"first_game_of_day" | "per_player_game_lock">("first_game_of_day");

  // Step 6
  const [captainEnabled, setCaptainEnabled] = useState(true);
  const [chipCaptainMult, setChipCaptainMult] = useState(2);
  const [wildcardEnabled, setWildcardEnabled] = useState(true);
  const [wildcardCount, setWildcardCount] = useState<1 | 2>(1);
  const [allStarEnabled, setAllStarEnabled] = useState(false);
  const [allStarCount, setAllStarCount] = useState<1 | 2>(1);
  const [allStarMultiplier, setAllStarMultiplier] = useState(2);
  const [transferCap, setTransferCap] = useState(2);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      setWeights({ ...PRESETS[p] });
      setToEnabled(false);
    }
  }

  function setWeight(k: StatKey, v: number) {
    setWeights((w) => ({ ...w, [k]: v }));
    setPreset("custom");
  }

  const formulaPreview = useMemo(() => {
    const order: StatKey[] = ["pts", "reb", "ast", "stl", "blk"];
    const parts = order
      .filter((k) => Number(weights[k]) !== 0)
      .map((k) => `${k.toUpperCase()}×${weights[k]}`);
    if (toEnabled && weights.to !== 0) parts.push(`TO×${weights.to}`);
    return `FP = ${parts.join(" + ") || "—"} + Captain ×${captainMultiplier}`;
  }, [weights, toEnabled, captainMultiplier]);

  const nameError = name.length > 0 && (name.length < 3 || name.length > 40);
  const canNext = (() => {
    if (step === 1) return name.length >= 3 && name.length <= 40;
    return true;
  })();

  async function handleSubmit() {
    const input: CreateLeagueInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      sport,
      visibility,
      scoring: {
        preset,
        weights: {
          pts: weights.pts,
          reb: weights.reb,
          ast: weights.ast,
          stl: weights.stl,
          blk: weights.blk,
          ...(toEnabled ? { to: weights.to } : {}),
        },
        captain_multiplier: captainMultiplier,
      },
      roster: {
        budget_cap: budgetCapEnabled ? budgetCap : null,
        bench_count: benchCount,
        max_players_per_team: maxPerTeamEnabled ? maxPerTeam : null,
      },
      deadline_type: deadlineType,
      chips: {
        captain_enabled: captainEnabled,
        captain_multiplier: chipCaptainMult,
        wildcard_enabled: wildcardEnabled,
        wildcard_count: wildcardCount,
        all_star_enabled: allStarEnabled,
        all_star_count: allStarCount,
        all_star_multiplier: allStarMultiplier,
      },
      transfer_cap: transferCap,
    };

    try {
      const res = await createLeague(input);
      setSelectedLeagueId(res.league_id);
      toast.success(`League created! Share your invite code: ${res.join_code}`);
      navigate("/leagues");
    } catch {
      // error state handled by hook
    }
  }

  return (
    <div className="px-6 py-5 max-w-[960px] mx-auto space-y-5">
      {/* Premium header — onboarding-style: dark gradient card, accent chip, inline step pills */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/95 to-card px-6 py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0, transparent 40%), radial-gradient(circle at 80% 80%, hsl(var(--accent)) 0, transparent 45%)",
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link to="/leagues" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-heading text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-3 w-3" /> Back to leagues
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[9px] font-heading uppercase tracking-[0.22em] text-accent mb-2">
              Ballers.IQ · League Builder
            </div>
            <h1 className="text-3xl font-heading uppercase tracking-wider font-bold leading-none">Create League</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.18em] font-heading mt-1.5">
              Step {step} of {TOTAL_STEPS}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <div
                  key={n}
                  className={cn(
                    "h-8 w-8 rounded-full text-xs font-heading font-bold inline-flex items-center justify-center border transition shadow-sm",
                    active && "bg-primary text-primary-foreground border-primary scale-110 shadow-lg shadow-primary/30",
                    done && !active && "bg-primary/20 text-primary border-primary/40",
                    !active && !done && "bg-muted/40 text-muted-foreground border-border",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-5">
            <SectionHeader title="Basics" subtitle="Name your league and choose visibility" />
            <div className="space-y-2">
              <Label htmlFor="ln">League name</Label>
              <Input id="ln" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="My Hoops League" />
              <div className={cn("text-xs", nameError ? "text-destructive" : "text-muted-foreground")}>
                {name.length}/40 — must be 3-40 characters
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ld">Description (optional)</Label>
              <Textarea id="ld" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["private", "invite_only", "public"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      visibility === v ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:bg-muted/30",
                    )}
                  >
                    <div className="text-sm font-semibold capitalize">{v.replace("_", " ")}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {v === "private" && "Only invited people can join."}
                      {v === "invite_only" && "Visible but join requires the code."}
                      {v === "public" && "Anyone can find and join."}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <SectionHeader title="Player pool" subtitle="Pick which league's players you'll draft" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: "nba" as const, name: "NBA", full: "National Basketball Association", count: "450+ players", logo: nbaLogo },
                { key: "wnba" as const, name: "WNBA", full: "Women's National Basketball Association", count: "140+ players", logo: wnbaLogo },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSport(opt.key)}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-6 text-left transition group",
                    sport === opt.key
                      ? "border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-card shadow-[0_0_0_1px_hsl(var(--primary)/0.6),0_8px_30px_-10px_hsl(var(--primary)/0.4)]"
                      : "border-border bg-gradient-to-br from-card via-card/90 to-card hover:border-primary/40",
                  )}
                >
                  <img
                    src={opt.logo}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute -right-6 -bottom-6 h-36 w-auto opacity-[0.12] rotate-12 select-none group-hover:opacity-[0.2] transition-opacity"
                  />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3">
                      <img src={opt.logo} alt={opt.name} className="h-10 w-10 object-contain" />
                      <div className="text-3xl font-heading font-bold tracking-wider">{opt.name}</div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">{opt.full}</div>
                    <div className="inline-flex items-center mt-4 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
                      {opt.count}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Cannot be changed after the league starts.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <SectionHeader title="Scoring formula" subtitle="Pick a preset or fully customize" />
            <div className="flex flex-wrap gap-2">
              {(["classic", "guards_boost", "bigs_boost", "custom"] as Preset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition",
                    preset === p
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/20 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.replace("_", " ")}
                </button>
              ))}
            </div>
            {/* 7 fields in 3 rows: 3-col grid of compact stat cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {(["pts", "reb", "ast", "stl", "blk"] as StatKey[]).map((k) => (
                <div key={k} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
                  <div className="text-xs font-heading font-bold uppercase tracking-wider w-8 text-muted-foreground">{k}</div>
                  <Input
                    type="number"
                    step={0.5}
                    min={0}
                    max={10}
                    value={weights[k]}
                    onChange={(e) => setWeight(k, Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
                <div className="text-xs font-heading font-bold uppercase tracking-wider w-8 text-muted-foreground">TO</div>
                <Switch checked={toEnabled} onCheckedChange={(v) => { setToEnabled(v); if (!v) setWeight("to", 0); else if (weights.to === 0) setWeight("to", -1); }} />
                <Input
                  type="number"
                  step={0.5}
                  min={-5}
                  max={0}
                  disabled={!toEnabled}
                  value={weights.to}
                  onChange={(e) => setWeight("to", Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 col-span-1">
                <div className="text-xs font-heading font-bold uppercase tracking-wider text-amber-400">CAPT</div>
                <Input
                  type="number"
                  step={0.5}
                  min={1}
                  max={3}
                  value={captainMultiplier}
                  onChange={(e) => setCaptainMultiplier(Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <span className="text-[10px] text-muted-foreground">×</span>
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-mono">
              {formulaPreview}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <SectionHeader title="Roster rules" subtitle="Budget, bench size, and team caps" />
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Budget cap</Label>
                <Switch checked={budgetCapEnabled} onCheckedChange={setBudgetCapEnabled} />
              </div>
              {budgetCapEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input type="number" min={1} value={budgetCap} onChange={(e) => setBudgetCap(Number(e.target.value))} className="w-32" />
                  <span className="text-xs text-muted-foreground">million</span>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <Label>Bench size</Label>
              <Input type="number" min={3} max={8} value={benchCount} onChange={(e) => setBenchCount(Number(e.target.value))} className="w-24" />
              <p className="text-xs text-muted-foreground">Total roster = 5 starters + bench</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Max players from same NBA/WNBA team</Label>
                <Switch checked={maxPerTeamEnabled} onCheckedChange={setMaxPerTeamEnabled} />
              </div>
              {maxPerTeamEnabled && (
                <Input type="number" min={1} max={5} value={maxPerTeam} onChange={(e) => setMaxPerTeam(Number(e.target.value))} className="w-24" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">All settings can be changed later while the league is in Draft.</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <SectionHeader title="Lineup deadline" subtitle="When does each game day's lineup lock?" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: "first_game_of_day" as const, title: "First game of the day", desc: "Lineup locks when the first game tips off.", best: "Casual leagues, set-and-forget." },
                { key: "per_player_game_lock" as const, title: "Per-player game lock", desc: "Each player locks at their own game start.", best: "Competitive leagues, active managers." },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDeadlineType(opt.key)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    deadlineType === opt.key ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:bg-muted/30",
                  )}
                >
                  <div className="text-sm font-semibold">{opt.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                  <div className="text-xs text-primary mt-2">Best for: {opt.best}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              "First game of the day" makes management simple — set your lineup once before tip-off. "Per-player game lock"
              lets you swap bench players between games on the same day, rewarding active managers.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <SectionHeader title="Chips & transfers" subtitle="Power-ups and transfer budget" />
            <ChipRow
              label="Captain — one player scores double every game day"
              enabled={captainEnabled}
              onToggle={setCaptainEnabled}
            >
              <Label className="text-xs text-muted-foreground">Multiplier</Label>
              <Input type="number" step={0.5} min={1} max={3} value={chipCaptainMult} onChange={(e) => setChipCaptainMult(Number(e.target.value))} className="w-20" />
            </ChipRow>
            <ChipRow
              label="Wildcard — make unlimited transfers in one game week"
              enabled={wildcardEnabled}
              onToggle={setWildcardEnabled}
            >
              <Label className="text-xs text-muted-foreground">Per season</Label>
              <select
                className="rounded-md border border-border bg-background h-9 px-2 text-sm"
                value={wildcardCount}
                onChange={(e) => setWildcardCount(Number(e.target.value) as 1 | 2)}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </ChipRow>
            <ChipRow
              label="All-Star — boost one player for a full game week"
              enabled={allStarEnabled}
              onToggle={setAllStarEnabled}
            >
              <Label className="text-xs text-muted-foreground">Count</Label>
              <select
                className="rounded-md border border-border bg-background h-9 px-2 text-sm"
                value={allStarCount}
                onChange={(e) => setAllStarCount(Number(e.target.value) as 1 | 2)}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
              <Label className="text-xs text-muted-foreground">Multiplier</Label>
              <Input type="number" step={0.5} min={1} max={5} value={allStarMultiplier} onChange={(e) => setAllStarMultiplier(Number(e.target.value))} className="w-20" />
            </ChipRow>
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <Label>Free transfers per game week</Label>
              <Input type="number" min={1} max={5} value={transferCap} onChange={(e) => setTransferCap(Number(e.target.value))} className="w-24" />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-5">
            <SectionHeader title="Review & create" subtitle="One last look before going live" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SummaryCard title="Identity" tone="primary">
                <SummaryRow k="Name" v={name} />
                <SummaryRow k="Sport" v={sport.toUpperCase()} />
                <SummaryRow k="Visibility" v={visibility.replace("_", " ")} />
              </SummaryCard>
              <SummaryCard title="Scoring" tone="accent">
                <SummaryRow k="Preset" v={preset.replace("_", " ")} />
                <SummaryRow k="Formula" v={formulaPreview} mono />
              </SummaryCard>
              <SummaryCard title="Roster" tone="default">
                <SummaryRow k="Budget cap" v={budgetCapEnabled ? `$${budgetCap}M` : "Off"} />
                <SummaryRow k="Bench size" v={String(benchCount)} />
                <SummaryRow k="Max per real team" v={maxPerTeamEnabled ? String(maxPerTeam) : "Off"} />
              </SummaryCard>
              <SummaryCard title="Deadlines & chips" tone="default">
                <SummaryRow k="Deadline" v={deadlineType === "first_game_of_day" ? "First game of day" : "Per-player lock"} />
                <SummaryRow k="Captain" v={captainEnabled ? `On ×${chipCaptainMult}` : "Off"} />
                <SummaryRow k="Wildcard" v={wildcardEnabled ? `On — ${wildcardCount}/season` : "Off"} />
                <SummaryRow k="All-Star" v={allStarEnabled ? `On ×${allStarMultiplier} — ${allStarCount}/season` : "Off"} />
                <SummaryRow k="Transfers" v={`${transferCap} / GW`} />
              </SummaryCard>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || isLoading}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < TOTAL_STEPS ? (
          <Button onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))} disabled={!canNext}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Create League
          </Button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-heading uppercase tracking-wider font-bold">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function ChipRow({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{label}</div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
    </div>
  );
}

function SummaryRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/40 last:border-b-0">
      <div className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground shrink-0">{k}</div>
      <div className={cn("text-sm font-medium text-right break-words", mono && "font-mono text-xs")}>{v}</div>
    </div>
  );
}

function SummaryCard({ title, tone, children }: { title: string; tone: "primary" | "accent" | "default"; children: React.ReactNode }) {
  const toneClass =
    tone === "primary" ? "border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card" :
    tone === "accent" ? "border-accent/30 bg-gradient-to-br from-accent/10 via-card to-card" :
    "border-border bg-card";
  return (
    <div className={cn("rounded-xl border p-4 space-y-1", toneClass)}>
      <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}