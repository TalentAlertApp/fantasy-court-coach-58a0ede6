import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Loader2, Shuffle } from "lucide-react";

const SUGGESTIONS = [
  "Court Kings", "Splash Lab", "Triple Threat", "Glass Cleaners",
  "Rim Wreckers", "Buckets Inc.", "Lakers of Lisbon", "Iso Empire",
  "Pick & Roll Co.", "Dagger Squad", "Hardwood Heroes", "Free Throw Mafia",
];

function pickRandom(): string {
  return SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
}

interface Props {
  onBack: () => void;
  onSubmit: (name: string) => void | Promise<void>;
  submitting: boolean;
}

export default function NameStep({ onBack, onSubmit, submitting }: Props) {
  const initial = useMemo(() => pickRandom(), []);
  const [name, setName] = useState(initial);

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 2 && !submitting;

  return (
    <div className="relative flex flex-col min-h-screen px-6 py-10 items-center justify-center">
      <StepIndicator step={1} />

      <div className="w-full max-w-2xl text-center animate-fade-in">
        <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-4">Step 1 of 2</p>
        <h2 className="font-heading font-black uppercase tracking-[0.15em] text-5xl md:text-7xl text-foreground">
          Name Your
          <br />
          <span className="text-accent">Franchise</span>
        </h2>

        <div className="mt-12 relative">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Court Kings"
            maxLength={48}
            className="h-20 text-2xl md:text-3xl font-heading uppercase tracking-[0.1em] text-center rounded-2xl bg-background/60 border-foreground/15 focus-visible:ring-accent"
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit(trimmed);
            }}
          />
          <button
            type="button"
            onClick={() => setName(pickRandom())}
            disabled={submitting}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl flex items-center justify-center text-foreground/50 hover:text-accent hover:bg-foreground/5 transition-colors"
            title="Random suggestion"
          >
            <Shuffle className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mr-2">
            Suggestions
          </span>
          {SUGGESTIONS.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setName(s)}
              disabled={submitting}
              className="px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.15em] border border-foreground/15 bg-foreground/5 text-foreground/70 hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-14 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={submitting}
            className="h-12 rounded-full px-6 text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button
            onClick={() => canSubmit && onSubmit(trimmed)}
            disabled={!canSubmit}
            className="h-14 rounded-full px-10 tracking-[0.25em] shadow-[0_0_40px_-10px_hsl(var(--accent))] hover:translate-y-[-1px] hover:shadow-[0_0_60px_-10px_hsl(var(--accent))] transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
              </>
            ) : (
              <>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full transition-colors ${step >= 1 ? "bg-accent" : "bg-foreground/20"}`} />
      <span className="h-px w-8 bg-foreground/15" />
      <span className={`h-2.5 w-2.5 rounded-full transition-colors ${step >= 2 ? "bg-accent" : "bg-foreground/20"}`} />
    </div>
  );
}