import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HowToPlayModalProps {
  iconClassName?: string;
}

export default function HowToPlayModal({ iconClassName }: HowToPlayModalProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
                  <p><strong>Maximum 2 players from the same NBA team.</strong> This ensures diversity and strategic depth.</p>
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
                  <p>Each gameweek has multiple <strong>gamedays</strong>. Each gameday can have 1–15 NBA games.</p>
                  <p><strong>Deadline: 30 minutes before the first tipoff</strong> of each gameday. After this, your lineup is locked for that day.</p>
                  <p>You can still make changes for future gamedays within the same gameweek.</p>
                  <p>All times shown are in <strong>Lisbon (WET/WEST)</strong> timezone.</p>
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
                    <p>For one gameweek, the salary cap is <strong>unlimited</strong>. You can bring in any player regardless of cost. Use it during high-impact weeks!</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Wildcard (3× per season)</p>
                    <p>Make <strong>unlimited free transfers</strong> for one gameweek — no point deductions. Perfect for reshaping your squad after injuries or schedule changes.</p>
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
                    FP = PTS×1 + REB×1 + AST×2 + BLK×3 + STL×3
                  </div>
                  <p>Only <strong>starters</strong> (or auto-subbed bench players) score points for your team each gameday.</p>
                  <p>The Gameday Captain chip <strong>doubles</strong> the selected player's FP for that day.</p>
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
          <div className="pt-3 border-t border-border shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full font-heading uppercase text-xs gap-2"
              onClick={() => {
                setOpen(false);
                navigate("/?welcomeback=1");
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Preview "Welcome Back" screen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
