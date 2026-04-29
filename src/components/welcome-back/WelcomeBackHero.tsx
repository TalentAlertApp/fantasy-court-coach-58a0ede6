import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, LogOut, Sparkles, Star, Clock, Trophy, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import nbaLogo from "@/assets/nba-logo.svg";
import PlayerMarquee from "@/components/onboarding/PlayerMarquee";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { getCurrentGameday, formatDeadline } from "@/lib/deadlines";
import { getLastSignOut, formatTimeAgo } from "@/lib/welcome-back-store";
import { getLastAdvancedTab, ADVANCED_TAB_LABEL } from "@/lib/advanced-tab-store";

interface Props {
  onEnter: () => void;
  onContinue?: (tab: string) => void;
}

function useCountdown(deadlineUtc: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!deadlineUtc) return null;
  const diff = new Date(deadlineUtc).getTime() - now;
  if (diff <= 0) return "LOCKED";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

const WHATS_NEW = [
  "AI Coach now ignores diacritics in player search",
  "Pick Player: schedule preview + team filter watermarks",
  "Roster: in-place schedule overlay, no more layout jumps",
  "Wishlist & Player Comparison improvements",
];

export default function WelcomeBackHero({ onEnter, onContinue }: Props) {
  const { user, signOut } = useAuth();
  const { teams, selectedTeamId } = useTeam();
  const lastTab = useMemo(() => getLastAdvancedTab(), []);
  const { data: rosterData } = useRosterQuery();
  const { data: playersData } = usePlayersQuery({ limit: 250 });

  const teamName = teams.find((t) => t.id === selectedTeamId)?.name ?? "Your Team";
  const lastSignOut = useMemo(() => getLastSignOut(user?.id), [user?.id]);
  const lastVisitLabel = lastSignOut ? formatTimeAgo(lastSignOut) : null;

  const currentGameday = useMemo(() => getCurrentGameday(), []);
  const countdown = useCountdown(currentGameday.deadline_utc);

  // Roster payload returns IDs only — resolve against the full players list.
  const players: any[] = (playersData as any)?.items ?? [];
  const rosterPlayers = useMemo(() => {
    const r = rosterData?.roster;
    if (!r || players.length === 0) return [] as any[];
    const ids = new Set<number>([...(r.starters ?? []), ...(r.bench ?? [])]);
    return players.filter((p: any) => ids.has(p?.core?.id));
  }, [rosterData, players]);

  const captain = useMemo(() => {
    const cid = rosterData?.roster?.captain_id;
    if (!cid) return null;
    return players.find((p: any) => p?.core?.id === cid) ?? null;
  }, [rosterData, players]);

  const topScorer = useMemo(() => {
    if (rosterPlayers.length === 0) return null;
    return [...rosterPlayers].sort(
      (a: any, b: any) => (b?.last5?.fp5 ?? 0) - (a?.last5?.fp5 ?? 0)
    )[0];
  }, [rosterPlayers]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  const fade = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div
      className="relative h-screen w-full bg-background text-foreground overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 20% 10%, hsl(var(--primary) / 0.18), transparent 55%),
          radial-gradient(ellipse at 85% 90%, hsl(var(--accent) / 0.12), transparent 55%),
          radial-gradient(ellipse at 50% 50%, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
        `,
      }}
    >
      {/* subtle grid overlay (matches onboarding) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="relative flex flex-col h-screen overflow-hidden">
        <PlayerMarquee />

        {/* Top bar — mirrors OnboardingHero */}
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
                  onClick={handleSignOut}
                  aria-label={user?.email ? `Sign out · ${user.email}` : "Sign out"}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px] uppercase tracking-[0.15em]">
                Sign out{user?.email ? ` · ${user.email}` : ""}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </header>

        {/* Hero content */}
        <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center pb-6 overflow-y-auto">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fade}
            transition={{ duration: 0.4 }}
            className="text-[11px] uppercase tracking-[0.4em] text-accent mb-3"
          >
            Welcome back · {teamName}
          </motion.div>

          {lastVisitLabel && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={fade}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-4"
            >
              Last visit: {lastVisitLabel}
            </motion.div>
          )}

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fade}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="font-heading font-black uppercase tracking-[0.16em] leading-[0.95] text-foreground"
            style={{
              textShadow: "0 8px 60px hsl(var(--accent) / 0.35)",
              fontSize: "clamp(2.25rem, 7vh, 5rem)",
            }}
          >
            Here's what
            <br />
            <span className="text-accent">you missed</span>
          </motion.h1>

          {/* 3-card recap strip */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fade}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl"
          >
            {/* Roster pulse */}
            <div className="bg-card/40 border border-border rounded-2xl p-5 backdrop-blur-md hover:border-accent/40 transition-colors text-left">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-foreground/60 font-heading mb-3">
                <Trophy className="h-3.5 w-3.5 text-accent" />
                Roster Pulse
              </div>
              {topScorer ? (
                <div className="flex items-center gap-3">
                  {topScorer.core?.photo && (
                    <img
                      src={topScorer.core.photo}
                      alt={topScorer.core.name}
                      className="h-14 w-14 rounded-full object-cover border border-border"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-heading uppercase text-sm truncate">{topScorer.core?.name}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      FP last 5 ·{" "}
                      <span className="text-accent font-bold tabular-nums">
                        {(topScorer.last5?.fp5 ?? 0).toFixed(1)}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Set a roster to see your top scorer.</p>
              )}
            </div>

            {/* Captain check */}
            <div className="bg-card/40 border border-border rounded-2xl p-5 backdrop-blur-md hover:border-accent/40 transition-colors text-left">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-foreground/60 font-heading mb-3">
                <Star className="h-3.5 w-3.5 text-accent" />
                Captain Check
              </div>
              {captain ? (
                <div>
                  <p className="font-heading uppercase text-sm truncate">{captain.core?.name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                    FP last 5 ·{" "}
                    <span className="text-accent font-bold tabular-nums">
                      {(captain.last5?.fp5 ?? 0).toFixed(1)}
                    </span>
                    <span className="ml-2 text-[hsl(var(--nba-yellow))]">2× active</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-snug">
                  No captain locked yet — set one before deadline to double their FP.
                </p>
              )}
            </div>

            {/* Next deadline */}
            <div className="bg-card/40 border border-[hsl(var(--nba-yellow))]/40 rounded-2xl p-5 backdrop-blur-md hover:border-[hsl(var(--nba-yellow))] transition-colors text-left">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--nba-yellow))] font-heading mb-3">
                <Clock className="h-3.5 w-3.5" />
                Next Deadline
              </div>
              <p className="font-heading uppercase text-sm">
                GW {currentGameday.gw} · Day {currentGameday.day}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                {formatDeadline(currentGameday.deadline_utc)}
              </p>
              <p className="mt-2 text-base font-mono font-bold text-[hsl(var(--nba-yellow))] tabular-nums">
                {countdown ?? "—"}
              </p>
            </div>
          </motion.div>

          {/* What's new chips */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fade}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-2 max-w-4xl"
          >
            {WHATS_NEW.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] border border-[hsl(var(--nba-yellow))] bg-[hsl(var(--nba-yellow))]/10 text-foreground font-bold"
              >
                <Sparkles className="h-3 w-3 text-[hsl(var(--nba-yellow))]" />
                {item}
              </span>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fade}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={onEnter}
                size="lg"
                className="h-14 px-10 rounded-full text-base tracking-[0.25em] shadow-[0_0_50px_-10px_hsl(var(--accent))] hover:translate-y-[-2px] hover:shadow-[0_0_70px_-10px_hsl(var(--accent))] transition-all"
              >
                Enter Court
                <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
              {lastTab && onContinue && (
                <Button
                  onClick={() => onContinue(lastTab)}
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 rounded-full text-base tracking-[0.2em] border-[hsl(var(--nba-yellow))]/60 text-[hsl(var(--nba-yellow))] hover:bg-[hsl(var(--nba-yellow))]/10 hover:text-[hsl(var(--nba-yellow))] transition-all"
                >
                  <ArrowRightCircle className="mr-2 h-5 w-5" />
                  Continue · {ADVANCED_TAB_LABEL[lastTab]}
                </Button>
              )}
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-foreground/40">
              Tap the Guide icon any time for the full tour
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}