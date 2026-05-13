import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, UserPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";

type JoinResult = {
  league_id: string;
  league_name: string;
  sport: "nba" | "wnba" | string;
  join_code: string;
};

type JoinState =
  | { status: "loading" }
  | { status: "success"; data: JoinResult; alreadyMember: boolean }
  | { status: "error"; message: string };

async function callJoin(code: string): Promise<{ ok: boolean; data?: JoinResult; code?: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke("leagues-join", {
    body: { join_code: code },
  });
  if (error) {
    // Try to surface server error envelope from FunctionsHttpError
    try {
      const ctx = await (error as unknown as { context?: { json?: () => Promise<any> } })
        .context?.json?.();
      if (ctx?.error) return { ok: false, code: ctx.error.code, message: ctx.error.message };
    } catch { /* noop */ }
    return { ok: false, message: error.message };
  }
  const env = data as { ok?: boolean; data?: JoinResult; error?: { code?: string; message?: string } } | null;
  if (!env?.ok || !env.data) {
    return { ok: false, code: env?.error?.code, message: env?.error?.message ?? "Failed to join" };
  }
  return { ok: true, data: env.data };
}

export default function JoinLeaguePage() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setSelectedLeagueId } = useFantasyLeague();

  const [state, setState] = useState<JoinState>({ status: "loading" });
  const [retryCode, setRetryCode] = useState("");
  const [retrying, setRetrying] = useState(false);

  async function attemptJoin(code: string) {
    setState({ status: "loading" });
    const res = await callJoin(code.trim().toUpperCase());
    if (res.ok && res.data) {
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      setState({ status: "success", data: res.data, alreadyMember: false });
      return;
    }
    if (res.code === "ALREADY_MEMBER") {
      // We need league info to show buttons — re-fetch via list invalidation
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      setState({
        status: "success",
        data: { league_id: "", league_name: "this league", sport: "nba", join_code: code.toUpperCase() },
        alreadyMember: true,
      });
      return;
    }
    setState({ status: "error", message: res.message ?? "Unable to join this league." });
  }

  useEffect(() => {
    if (joinCode) attemptJoin(joinCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  async function handleRetry() {
    if (!retryCode.trim()) return;
    setRetrying(true);
    await attemptJoin(retryCode);
    setRetrying(false);
  }

  function goCreateTeam(leagueId: string) {
    if (leagueId) setSelectedLeagueId(leagueId);
    navigate("/welcome", { state: leagueId ? { leagueId } : undefined });
  }

  function goBrowse(leagueId: string) {
    if (leagueId) setSelectedLeagueId(leagueId);
    navigate("/leagues");
  }

  return (
    <div className="px-6 py-10 max-w-[640px] mx-auto space-y-5">
      <Link to="/leagues" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to leagues
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-heading uppercase tracking-wider font-bold">Join league</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Code: <span className="font-mono tracking-[0.3em]">{joinCode ?? "—"}</span>
        </p>

        <div className="mt-6">
          {state.status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your invite…
            </div>
          )}

          {state.status === "success" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {state.alreadyMember
                    ? "You're already in this league."
                    : `Welcome to ${state.data.league_name}!`}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">League</div>
                <div className="font-semibold">{state.data.league_name}</div>
                <div className="text-xs text-muted-foreground">{String(state.data.sport).toUpperCase()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => goCreateTeam(state.data.league_id)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Create team in this league
                </Button>
                <Button variant="secondary" onClick={() => goBrowse(state.data.league_id)}>
                  <Sparkles className="h-4 w-4 mr-2" /> Just browse standings
                </Button>
              </div>
            </div>
          )}

          {state.status === "error" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{state.message}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Try a different code</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="INVITE CODE"
                    value={retryCode}
                    onChange={(e) => setRetryCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase tracking-[0.3em]"
                    maxLength={8}
                    autoFocus
                  />
                  <Button onClick={handleRetry} disabled={retrying || !retryCode.trim()}>
                    {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                  </Button>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/leagues">Back to leagues</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}