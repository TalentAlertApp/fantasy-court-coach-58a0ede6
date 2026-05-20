import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquareHeart,
  AlertOctagon,
  Lightbulb,
  Heart,
  Send,
  ArrowLeft,
  Copy,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FEEDBACK_EMAIL = "alertadetalento@gmail.com";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROUTE_LABELS: Record<string, string> = {
  "/": "My Roster",
  "/scoring": "Scoring",
  "/transactions": "Transactions",
  "/teams": "Teams",
  "/leagues": "Leagues",
  "/schedule": "Schedule",
  "/schedule/grid": "Schedule Grid",
  "/advanced": "Advanced",
  "/commissioner": "Commissioner",
};

type SectionKey = "issues" | "suggestions" | "loved";

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  header: string;
  placeholder: string;
  Icon: typeof AlertOctagon;
  iconClass: string;
}> = [
  {
    key: "issues",
    label: "Issues / Errors",
    header: "ISSUES / ERRORS",
    placeholder: "Anything broken, confusing, or just wrong?",
    Icon: AlertOctagon,
    iconClass: "text-destructive",
  },
  {
    key: "suggestions",
    label: "Suggestions",
    header: "SUGGESTIONS",
    placeholder: "Ideas, missing features, things you'd tweak…",
    Icon: Lightbulb,
    iconClass: "text-[hsl(var(--nba-yellow))]",
  },
  {
    key: "loved",
    label: "Loved it",
    header: "LOVED IT",
    placeholder: "What clicked? What should we keep doing?",
    Icon: Heart,
    iconClass: "text-emerald-500",
  },
];

export default function FeedbackModal({ open, onOpenChange }: Props) {
  const { pathname } = useLocation();
  const routeLabel = ROUTE_LABELS[pathname] ?? pathname;

  const [values, setValues] = useState<Record<SectionKey, string>>({
    issues: "",
    suggestions: "",
    loved: "",
  });
  const [stage, setStage] = useState<"compose" | "confirm">("compose");

  const hasContent = useMemo(
    () => Object.values(values).some((v) => v.trim().length > 0),
    [values],
  );

  const subject = `Hoops Fantasy Manager Feedback — ${routeLabel}`;

  const body = useMemo(() => {
    const parts: string[] = [];
    for (const s of SECTIONS) {
      const text = values[s.key].trim();
      if (!text) continue;
      parts.push(`=== ${s.header} ===`, text, "");
    }
    parts.push(
      "---",
      `route: ${pathname} (${routeLabel})`,
      `sent: ${new Date().toISOString()}`,
    );
    return parts.join("\n");
  }, [values, pathname, routeLabel]);

  const reset = () => {
    setValues({ issues: "", suggestions: "", loved: "" });
    setStage("compose");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      toast({ title: "Email copied", description: FEEDBACK_EMAIL });
    } catch {
      toast({
        title: "Couldn't copy",
        description: FEEDBACK_EMAIL,
        variant: "destructive",
      });
    }
  };

  const doSend = () => {
    const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast({ title: "Opening your email app…" });
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wide flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-accent" />
            {stage === "compose" ? "Send feedback" : "Confirm send"}
          </DialogTitle>
          <DialogDescription className="pt-0.5 leading-snug text-xs">
            {stage === "compose" ? (
              <>
                Hoops Fantasy Manager is in MVP testing — every line helps us
                ship the right thing next.
              </>
            ) : (
              <>
                Your default email app will open prefilled to{" "}
                <span className="font-mono">{FEEDBACK_EMAIL}</span>. You can
                still edit before hitting send.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {stage === "compose" ? (
          <div className="space-y-2.5">
            {SECTIONS.map(({ key, label, placeholder, Icon, iconClass }) => (
              <div key={key} className="space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                  <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
                  {label}
                </label>
                <Textarea
                  rows={3}
                  value={values[key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  className="resize-none text-sm leading-snug min-h-0"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={copyEmail}
              className="w-full flex items-center justify-between gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
              aria-label="Copy feedback email"
            >
              <span className="font-mono truncate">{FEEDBACK_EMAIL}</span>
              <span className="inline-flex items-center gap-1">
                <Copy className="h-3 w-3" />
                copy
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-3 max-h-[280px] overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90">
              {body}
            </pre>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {stage === "compose" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStage("confirm")}
                disabled={!hasContent}
              >
                <Send className="h-4 w-4 mr-1.5" />
                Send
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStage("compose")}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <Button onClick={doSend}>
                <Send className="h-4 w-4 mr-1.5" />
                Confirm &amp; send
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}