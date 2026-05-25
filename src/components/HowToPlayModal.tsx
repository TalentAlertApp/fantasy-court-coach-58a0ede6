import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScoringSystem, buildFormulaString, captainMultiplier } from "@/hooks/useScoringSystem";
import { useLeague } from "@/contexts/LeagueContext";

interface HowToPlayModalProps {
  iconClassName?: string;
}

export default function HowToPlayModal({ iconClassName }: HowToPlayModalProps) {
  const [open, setOpen] = useState(false);
  const { data: scoringRules } = useScoringSystem();
  const formula = buildFormulaString(scoringRules);
  const captainMult = captainMultiplier(scoringRules);
  const { league } = useLeague();
  const LEAGUE =
    league === "wnba" ? "WNBA" : league === "euroleague" ? "EuroLeague" : "NBA";
  const isEuroLeague = league === "euroleague";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={iconClassName ?? "text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"}
        title="Guide"
      >
        <BookOpen className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg h-[min(85vh,50rem)] flex flex-col rounded-xl overflow-hidden">
          <DialogHeader className="pr-10">
            <DialogTitle className="font-heading text-lg">🏀 How To Play</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mr-2 pr-2">
            <Accordion type="multiple" defaultValue={["roster"]} className="w-full">

              <AccordionItem value="roster">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  📋 Selecting Your Initial Roster
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-2 font-body">
                  <p>Your squad consists of <strong>10 players</strong>: 5 Frontcourt (FC) and 5 Backcourt (BC).</p>
                  <p>You have a <strong>$100M salary cap</strong> to build your team. Player salaries are based on their real-life performance and updated throughout the season.</p>
                  <p><strong>Maximum 2 players from the same {LEAGUE} team.</strong> This ensures diversity and strategic depth.</p>
                  <p>Choose wisely — your initial roster sets the foundation for the entire season!</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="management">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  ⚙️ Managing Your Team
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-2 font-body">
                  <p><strong>Formations:</strong> Your 5 starters must be either <strong>2 BC + 3 FC</strong> or <strong>3 BC + 2 FC</strong>. The remaining 5 sit on your bench.</p>
                  <p><strong>Auto-subs:</strong> If a starter doesn't play (DNP), the first eligible bench player automatically replaces them. Bench priority goes from Bench 1 → Bench 5.</p>
                  <p><strong>Transfers:</strong> You can make transfers each gameweek. Each transfer costs points unless you use a Wildcard chip.</p>
                  <p>You can only transfer players who are <strong>not currently locked</strong> (i.e., their game hasn't started yet).</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="deadlines">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  ⏰ Deadlines
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-2 font-body">
                  <p>Each gameweek has multiple <strong>gamedays</strong>. Each gameday can have 1–15 {LEAGUE} games.</p>
                  <p><strong>Deadline: 30 minutes before the first tipoff</strong> of each gameday. After this, your lineup is locked for that day.</p>
                  <p>You can still make changes for future gamedays within the same gameweek.</p>
                  <p>All times shown are in <strong>Lisbon (WET/WEST)</strong> timezone.</p>
                  {isEuroLeague && (
                    <p>EuroLeague gamedays typically run <strong>Tuesday–Friday</strong>, so gameweeks are shorter and denser than NBA/WNBA weeks.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="leagues">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  ⚔️ Leagues
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-2 font-body">
                  <p>Leagues are how you compete. Each team belongs to <strong>one Main League</strong> (NBA, WNBA or EuroLeague) where standings, prizes and bragging rights live.</p>
                  <p><strong>Discover:</strong> browse public leagues you can join with one click. Filter by NBA / WNBA / EuroLeague / All to find the right room.</p>
                  <p><strong>Join with Code:</strong> private leagues are invite-only — paste the share code your commissioner sent you to jump straight in.</p>
                  <p><strong>Create a League:</strong> open your own room, set the sport (NBA, WNBA or EuroLeague), and share the code with friends. As commissioner you control name, visibility and members.</p>
                  <p><strong>Multi-team:</strong> you can manage multiple teams across different leagues — switch between them at any time from the team selector in the sidebar.</p>
                  <p><strong>Standings:</strong> updated after every gameday using your Fantasy Points (FP). The Main League view groups every team in your league for head-to-head context.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="chips">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  🃏 Chips
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-3 font-body">
                  <div>
                    <p className="font-semibold text-foreground">Gameday Captain (1× per week)</p>
                    <p>Pick one starter whose score is <strong>doubled</strong> for that gameday. You can use this once per gameweek, so choose the day with the best matchup.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">All-Star Chip (1× per season)</p>
                    <p>For one gameweek, your transfer cap is raised by <strong>+2</strong> (from 2 to 4). One-time use per season, locked in the moment you commit a trade with the chip active.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Wildcard (1× per season)</p>
                    <p>Make <strong>unlimited transfers</strong> for one gameweek — the GW cap is bypassed entirely. One-time use per season.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scoring">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  📊 Scoring
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-2 font-body">
                  <p>Fantasy Points (FP) are calculated per game using this formula:</p>
                  <div className="bg-muted rounded-lg p-3 font-mono text-xs text-center">
                    {formula}
                  </div>
                  <p>Only <strong>starters</strong> (or auto-subbed bench players) score points for your team each gameday.</p>
                  <p>The Gameday Captain chip multiplies the selected player's FP for that day by <strong>{captainMult}×</strong>.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="indexes">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  🧠 Indexes & Ballers.IQ
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-3 font-body">
                  <p>
                    Across the app you'll see a set of <strong>intelligence indexes</strong> that turn raw stats and
                    schedule data into quick, glanceable reads. They're advisory signals — not predictions — designed to
                    help you make faster lineup, captain and transfer calls.
                  </p>
                  <div>
                    <p className="font-semibold text-foreground">Ballers.IQ</p>
                    <p>
                      A per-player score (0–100) that blends recent form, role stability, opponent difficulty, schedule
                      density, market value and injury context into a single confidence read for the upcoming gameweek.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Form Index</p>
                    <p>Momentum signal weighted toward the most recent games — rewards players trending up.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Matchup Index</p>
                    <p>Adjusts for opponent defensive strength and pace — flags soft and brutal matchups.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Schedule Index</p>
                    <p>Accounts for back-to-backs, rest days and games per gameweek — more games, more upside.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Market Index</p>
                    <p>Value-vs-salary read — flags over- and under-priced players relative to recent production.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Role Stability</p>
                    <p>Minutes and usage consistency over the trailing window — high stability means low risk of a bench surprise.</p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Indexes are advisory — always cross-check with the live Injury Report and your own watch.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq">
                <AccordionTrigger className="font-heading text-sm uppercase font-bold bg-accent/20 px-3 rounded-lg hover:no-underline">
                  ❓ FAQ
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 text-sm space-y-3 font-body">
                  <div>
                    <p className="font-semibold text-foreground">Can I have more than one team?</p>
                    <p>No. Each manager controls exactly one team per league.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">What happens if my player gets injured mid-game?</p>
                    <p>You still receive whatever FP they earned before leaving. No auto-sub occurs mid-game — subs only apply if the player is a full DNP.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">How do bench auto-subs work?</p>
                    <p>If a starter has a DNP, the highest-priority bench player <strong>of the correct position type</strong> (BC/FC) subs in, maintaining the valid formation. If no valid sub exists, the slot stays empty.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">When are player salaries updated?</p>
                    <p>Salaries are updated periodically throughout the season based on real-life performance trends.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
