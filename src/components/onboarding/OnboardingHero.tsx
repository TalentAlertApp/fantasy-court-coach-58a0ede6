import { Button } from "@/components/ui/button";
import { ChevronRight, Sparkles } from "lucide-react";
import nbaLogo from "@/assets/nba-logo.svg";
import PlayerMarquee from "./PlayerMarquee";

interface Props {
  onStart: () => void;
  onSignOut: () => void;
  email?: string | null;
}

export default function OnboardingHero({ onStart, onSignOut, email }: Props) {
  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden">
      <PlayerMarquee />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <img src={nbaLogo} alt="NBA" className="h-9 w-auto" />
          <span className="text-xs font-heading uppercase tracking-[0.3em] text-foreground/70">
            Fantasy
          </span>
        </div>
        <div className="flex items-center gap-4">
          {email && (
            <span className="text-[11px] uppercase tracking-wider text-foreground/50">
              {email}
            </span>
          )}
          <button
            onClick={onSignOut}
            className="text-[11px] uppercase tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Hero content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-fade-in flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-accent mb-6">
          <Sparkles className="h-3 w-3" />
          <span>Welcome to</span>
          <Sparkles className="h-3 w-3" />
        </div>

        <h1
          className="font-heading font-black uppercase tracking-[0.18em] leading-[0.95] text-6xl md:text-8xl lg:text-9xl text-foreground"
          style={{
            textShadow: "0 8px 60px hsl(var(--accent) / 0.35)",
          }}
        >
          Draft Your
          <br />
          <span className="text-accent">Squad</span>
        </h1>

        <p className="mt-8 max-w-xl text-base md:text-lg italic text-foreground/70 font-body">
          "Build the team. Run the league."
        </p>

        <Button
          onClick={onStart}
          size="lg"
          className="mt-12 h-16 px-12 rounded-full text-base tracking-[0.25em] shadow-[0_0_50px_-10px_hsl(var(--accent))] hover:translate-y-[-2px] hover:shadow-[0_0_70px_-10px_hsl(var(--accent))] transition-all"
        >
          Start Your Draft
          <ChevronRight className="ml-1 h-5 w-5" />
        </Button>

        <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-foreground/40">
          3 quick steps · ~60 seconds
        </p>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {[
            "$100M Cap",
            "10 Players",
            "5 FC + 5 BC",
            "1 Captain · 2× FP",
          ].map((chip) => (
            <span
              key={chip}
              className="px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.25em] border border-foreground/15 bg-foreground/5 text-foreground/70"
            >
              {chip}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}