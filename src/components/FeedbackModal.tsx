import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";

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
  const [sending, setSending] = useState(false);

  const hasContent = useMemo(
    () => Object.values(values).some((v) => v.trim().length > 0),
    [values],
  );

  const subject = `Hoops Fantasy Manager Feedback — ${routeLabel}`;

  // Preview body shown on the confirm screen — no route/sent metadata.
  const previewBody = useMemo(() => {
    const parts: string[] = [];
    for (const s of SECTIONS) {
      const text = values[s.key].trim();
      if (!text) continue;
      parts.push(`=== ${s.header} ===`, text, "");
    }
    return parts.join("\n").trimEnd();
  }, [values]);

  // Mailto fallback body (kept compact, includes route for triage).
  const mailtoBody = useMemo(() => {
    const parts: string[] = [];
    for (const s of SECTIONS) {
      const text = values[s.key].trim();
      if (!text) continue;
      parts.push(`=== ${s.header} ===`, text, "");
    }
    parts.push("---", `route: ${pathname} (${routeLabel})`);
    return parts.join("\n");
  }, [values, pathname, routeLabel]);

  const reset = () => {
    setValues({ issues: "", suggestions: "", loved: "" });
    setStage("compose");
    setSending(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !sending) reset();
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

  const openMailtoFallback = () => {
    const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(mailtoBody)}`;
    window.location.href = mailto;
  };

  const doSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-feedback", {
        body: {
          issues: values.issues,
          suggestions: values.suggestions,
          loved: values.loved,
          route: pathname,
          routeLabel,
        },
      });
      if (error || !data?.ok) {
        throw new Error(
          (data?.error?.message as string | undefined) ??
            error?.message ??
            "Send failed",
        );
      }
      toast({
        title: "Feedback sent — thank you",
        description: "We read every line. Truly.",
      });
      handleOpenChange(false);
    } catch (err) {
      openMailtoFallback();
      toast({
        title: "Couldn't reach our server",
        description:
          "Opened your email app as a fallback. Hit send there to deliver it.",
        variant: "destructive",
      });
      handleOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-xl rounded-2xl border-border/60 p-0 overflow-hidden shadow-[0_30px_80px_-20px_hsl(0_0%_0%/0.6)]"
      >
        {/* Layered background: court image + theme-aware gradient + accent glow */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div
            className="absolute inset-0 bg-center bg-cover opacity-[0.07] dark:opacity-[0.10]"
            style={{ backgroundImage: "url('/court-bg.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-card" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        </div>

        {/* Header */}
        <div className="relative px-6 pt-5 pb-4 border-b border-accent/25">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md bg-white/5 dark:bg-white/5 border border-border/40 px-2 py-1 backdrop-blur-sm">
              <img src={nbaLogo} alt="NBA" className="h-5 w-auto" />
              <span className="h-4 w-px bg-border/60" aria-hidden />
              <img src={wnbaLogo} alt="WNBA" className="h-5 w-auto object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-heading font-semibold uppercase tracking-[0.32em] text-accent/90">
                <MessageSquareHeart className="h-3 w-3" />
                MVP Testing · Your voice ships the next build
              </div>
              <h2 className="font-heading font-bold uppercase tracking-[0.22em] text-base sm:text-lg text-foreground mt-1">
                {stage === "compose" ? "Send feedback" : "Confirm & send"}
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-6 py-4">
          {stage === "compose" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-snug">
                Three boxes. Write as much or as little as you want — anything you skip just doesn't get sent.
              </p>
              {SECTIONS.map(({ key, label, placeholder, Icon, iconClass }) => (
                <div
                  key={key}
                  className="group rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_hsl(var(--accent)/0.12)] transition-all"
                >
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-foreground/5 ${iconClass}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[10px] font-heading uppercase tracking-[0.18em] text-foreground/85">
                        {label}
                      </span>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground/70">
                      {values[key].length}
                    </span>
                  </div>
                  <Textarea
                    rows={3}
                    value={values[key]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="resize-none text-sm leading-snug min-h-0 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 pb-2.5 pt-0"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={copyEmail}
                className="w-full flex items-center justify-between gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1 pt-1"
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
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-snug">
                One click sends this straight to{" "}
                <span className="font-mono text-foreground/90">{FEEDBACK_EMAIL}</span>.
                We'll reply from the same address.
              </p>
              <div className="relative rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" aria-hidden />
                <div className="pl-4 pr-4 py-3 max-h-[260px] overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {previewBody}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative px-6 pb-5 pt-1 flex items-center justify-end gap-2">
          {stage === "compose" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="font-heading uppercase tracking-wider text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStage("confirm")}
                disabled={!hasContent}
                className="font-heading uppercase tracking-wider text-xs bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_24px_-4px_hsl(var(--accent)/0.55)]"
              >
                <Send className="h-4 w-4 mr-1.5" />
                Send
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setStage("compose")}
                disabled={sending}
                className="font-heading uppercase tracking-wider text-xs"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <Button
                onClick={doSend}
                disabled={sending}
                className="font-heading uppercase tracking-wider text-xs bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_24px_-4px_hsl(var(--accent)/0.55)]"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" />
                    Confirm &amp; send
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}