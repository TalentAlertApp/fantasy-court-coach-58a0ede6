import { Button } from "@/components/ui/button";
import { ChevronRight, LogOut } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import nbaLogo from "@/assets/nba-logo.svg";
import PlayerMarquee from "./PlayerMarquee";

interface Props {
  onStart: () => void;
  onSignOut: () => void;
  onSkip: () => void;
  email?: string | null;
}

export default function OnboardingHero({ onStart, onSignOut, onSkip, email }: Props) {
  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      <PlayerMarquee />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <img src={nbaLogo} alt="NBA" className="h-9 w-auto" />
          <span className="text-xs font-heading uppercase tracking-[0.3em] text-foreground/70">
            Fantasy
          </span>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSignOut}
                aria-label={email ? `Sign out · ${email}` : "Sign out"}
                className="h-9 w-9 rounded-full flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px] uppercase tracking-[0.15em]">
              Sign out{email ? ` · ${email}` : ""}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </header>

      {/* Hero content */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center pb-6">
        <div className="animate-fade-in text-[11px] uppercase tracking-[0.4em] text-accent mb-4">
          Welcome to
        </div>

        <h1
          className="font-heading font-black uppercase tracking-[0.18em] leading-[0.95] text-foreground"
          style={{
            textShadow: "0 8px 60px hsl(var(--accent) / 0.35)",
            fontSize: "clamp(3rem, 11vh, 8rem)",
          }}
        >
          Draft Your
          <br />
          <span className="text-accent">Squad</span>
        </h1>

        <p className="mt-6 max-w-xl text-base md:text-lg italic text-foreground/70 font-body">
          "Build the team. Run the league."
        </p>

        <Button
          onClick={onStart}
          size="lg"
          className="mt-8 h-14 px-10 rounded-full text-base tracking-[0.25em] shadow-[0_0_50px_-10px_hsl(var(--accent))] hover:translate-y-[-2px] hover:shadow-[0_0_70px_-10px_hsl(var(--accent))] transition-all"
        >
          Start Your Draft
          <ChevronRight className="ml-1 h-5 w-5" />
        </Button>

        <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-foreground/40">
          3 quick steps
        </p>

        <button
          type="button"
          onClick={onSkip}
          className="mt-2 text-[11px] uppercase tracking-[0.2em] text-foreground/40 hover:text-foreground/80 underline-offset-4 hover:underline transition-colors"
        >
          Skip for now →
        </button>

        <div className="mt-auto pt-6 flex flex-wrap items-center justify-center gap-3">
          {[
            "$100M Cap",
            "10 Players",
            "5 FC + 5 BC",
            "1 Captain · 2× FP",
          ].map((chip) => (
            <span
              key={chip}
              className="px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.25em] border border-[hsl(var(--nba-yellow))] bg-[hsl(var(--nba-yellow))]/10 text-black font-bold"
            >
              {chip}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}