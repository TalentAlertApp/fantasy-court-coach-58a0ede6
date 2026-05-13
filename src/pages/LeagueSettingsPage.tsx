import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Copy, RefreshCw, Trash2, AlertTriangle, Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type StatKey = "pts" | "reb" | "ast" | "stl" | "blk" | "to";

type Member = {
  user_id: string;
  role: "owner" | "commissioner" | "member" | string;
  joined_at: string;
  team_count: number;
  owner_label: string;
};

async function callManage(method: string, action: string, body: unknown) {
  const path = action ? `leagues-manage/${action}` : "leagues-manage";
  const { data, error } = await supabase.functions.invoke(path, {
    method: method as any,
    body,
  });
  if (error) throw new Error(error.message);
  const env = data as { ok?: boolean; data?: any; error?: { message?: string } } | null;
  if (!env?.ok) throw new Error(env?.error?.message ?? "Request failed");
  return env.data;
}

export default function LeagueSettingsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { fantasyLeagues, isLoading } = useFantasyLeague();
  const { user } = useAuth();

  const league = useMemo(() => fantasyLeagues.find((l) => l.id === leagueId) ?? null, [fantasyLeagues, leagueId]);
  const isOwner = !!user && !!league && league.owner_id === user.id;
  const status = league?.status ?? "draft";
  const isDraft = status === "draft";
  const isActive = status === "active";
  const canEditRules = isOwner && isDraft;

  // Editable form state seeded from league
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "invite_only" | "public">("private");
  const [transferCap, setTransferCap] = useState(2);

  const [weights, setWeights] = useState<Record<StatKey, number>>({ pts: 1, reb: 1, ast: 2, stl: 3, blk: 3, to: 0 });
  const [toEnabled, setToEnabled] = useState(false);
  const [captainMultiplier, setCaptainMultiplier] = useState(2);

  const [budgetCapEnabled, setBudgetCapEnabled] = useState(true);
  const [budgetCap, setBudgetCap] = useState(100);
  const [benchCount, setBenchCount] = useState(5);
  const [maxPerTeamEnabled, setMaxPerTeamEnabled] = useState(true);
  const [maxPerTeam, setMaxPerTeam] = useState(2);

  const [deadlineType, setDeadlineType] = useState<"first_game_of_day" | "per_player_game_lock">("first_game_of_day");

  const [captainEnabled, setCaptainEnabled] = useState(true);
  const [chipCaptainMult, setChipCaptainMult] = useState(2);
  const [wildcardEnabled, setWildcardEnabled] = useState(true);
  const [wildcardCount, setWildcardCount] = useState<1 | 2>(1);
  const [allStarEnabled, setAllStarEnabled] = useState(false);
  const [allStarCount, setAllStarCount] = useState<1 | 2>(1);
  const [allStarMultiplier, setAllStarMultiplier] = useState(2);

  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Hydrate form from league
  useEffect(() => {
    if (!league) return;
    setName(league.name);
    setDescription(league.description ?? "");
    setVisibility((league.visibility as any) ?? "private");
    setTransferCap(league.transfer_cap ?? 2);

    const w: Record<StatKey, number> = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 };
    let cap = 2;
    let toFound = false;
    for (const r of league.scoringRules ?? []) {
      if (r.applies_to === "captain") cap = Number(r.weight);
      else if (r.applies_to === "player" && (r.stat_key in w)) {
        w[r.stat_key as StatKey] = Number(r.weight);
        if (r.stat_key === "to") toFound = true;
      }
    }
    setWeights(w);
    setToEnabled(toFound);
    setCaptainMultiplier(cap);

    const rr = league.rosterRules;
    if (rr) {
      setBenchCount(rr.bench_count);
      setBudgetCapEnabled(rr.budget_cap != null);
      setBudgetCap(rr.budget_cap != null ? Number(rr.budget_cap) : 100);
      setMaxPerTeamEnabled(rr.max_players_per_team != null);
      setMaxPerTeam(rr.max_players_per_team != null ? Number(rr.max_players_per_team) : 2);
    }
    if (league.deadlineRules) {
      const dt = league.deadlineRules.deadline_type;
      setDeadlineType(dt === "per_player_game_lock" ? "per_player_game_lock" : "first_game_of_day");
    }
    if (league.chipRules) {
      const c = league.chipRules;
      setCaptainEnabled(c.captain_enabled);
      setChipCaptainMult(Number(c.captain_multiplier));
      setWildcardEnabled(c.wildcard_enabled);
      setWildcardCount((c.wildcard_count === 2 ? 2 : 1) as 1 | 2);
      setAllStarEnabled(c.all_star_enabled);
      setAllStarCount((c.all_star_count === 2 ? 2 : 1) as 1 | 2);
      setAllStarMultiplier(Number(c.all_star_multiplier));
    }
  }, [league]);

  // Members query (owner only)
  const membersQ = useQuery({
    queryKey: ["league-members", leagueId],
    enabled: !!leagueId && isOwner,
    queryFn: async () => {
      const data = await callManage("GET", `members?league_id=${leagueId}`, null);
      return data as Member[];
    },
  });

  if (isLoading) {
    return <div className="px-6 py-10 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!league) {
    return (
      <div className="px-6 py-5 max-w-[900px] mx-auto">
        <Link to="/leagues" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to leagues
        </Link>
        <div className="rounded-xl border border-border bg-card p-6">League not found or access denied.</div>
      </div>
    );
  }

  const formulaPreview = (() => {
    const order: StatKey[] = ["pts", "reb", "ast", "stl", "blk"];
    const parts = order.filter((k) => Number(weights[k]) !== 0).map((k) => `${k.toUpperCase()}×${weights[k]}`);
    if (toEnabled && weights.to !== 0) parts.push(`TO×${weights.to}`);
    return `FP = ${parts.join(" + ") || "—"} + Captain ×${captainMultiplier}`;
  })();

  async function handleSave() {
    if (!leagueId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        league_id: leagueId,
        name: name.trim(),
        description: description.trim() || null,
        visibility,
      };
      if (canEditRules) {
        body.transfer_cap = transferCap;
        body.scoring = {
          weights: {
            pts: weights.pts, reb: weights.reb, ast: weights.ast,
            stl: weights.stl, blk: weights.blk,
            ...(toEnabled ? { to: weights.to } : {}),
          },
          captain_multiplier: captainMultiplier,
        };
        body.roster = {
          budget_cap: budgetCapEnabled ? budgetCap : null,
          bench_count: benchCount,
          max_players_per_team: maxPerTeamEnabled ? maxPerTeam : null,
        };
        body.deadline_type = deadlineType;
        body.chips = {
          captain_enabled: captainEnabled,
          captain_multiplier: chipCaptainMult,
          wildcard_enabled: wildcardEnabled,
          wildcard_count: wildcardCount,
          all_star_enabled: allStarEnabled,
          all_star_count: allStarCount,
          all_star_multiplier: allStarMultiplier,
        };
      }
      await callManage("PATCH", "", body);
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!leagueId) return;
    setActivating(true);
    try {
      await callManage("POST", "activate", { league_id: leagueId });
      toast.success("League activated — rules are now locked");
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActivating(false);
      setConfirmActivate(false);
    }
  }

  async function handleArchive() {
    if (!leagueId) return;
    setArchiving(true);
    try {
      await callManage("POST", "archive", { league_id: leagueId });
      toast.success("League archived");
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setArchiving(false);
      setConfirmArchive(false);
    }
  }

  async function handleDelete() {
    if (!leagueId) return;
    setDeleting(true);
    try {
      await callManage("DELETE", "", { league_id: leagueId });
      toast.success("League deleted");
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      navigate("/leagues");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleRegenerate() {
    if (!leagueId) return;
    setRegenerating(true);
    try {
      const res = await callManage("POST", "regenerate-code", { league_id: leagueId });
      toast.success(`New invite code: ${res?.join_code ?? ""}`);
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
      setConfirmRegen(false);
    }
  }

  async function handleLeave() {
    if (!leagueId) return;
    try {
      await callManage("POST", "leave", { league_id: leagueId });
      toast.success("You left the league");
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      navigate("/leagues");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Leave failed");
    } finally {
      setConfirmLeave(false);
    }
  }

  async function changeRole(targetUserId: string, role: string) {
    if (!leagueId) return;
    try {
      await callManage("PATCH", "members", { league_id: leagueId, user_id: targetUserId, role });
      toast.success("Role updated");
      membersQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change role");
    }
  }

  async function removeMember(targetUserId: string) {
    if (!leagueId) return;
    try {
      await callManage("DELETE", "members", { league_id: leagueId, user_id: targetUserId });
      toast.success("Member removed");
      membersQ.refetch();
      qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove member");
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    );
  }

  const shareUrl = `${window.location.origin}/join/${league.join_code ?? ""}`;
  const statusBadgeClass = cn(
    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
    isDraft && "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
    isActive && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    !isDraft && !isActive && "border-border bg-muted/30 text-muted-foreground",
  );

  return (
    <div className="px-6 py-5 max-w-[900px] mx-auto space-y-5">
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <Link to="/leagues" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to leagues
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading uppercase tracking-wider font-bold">
              {league.name} · Settings
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={statusBadgeClass}>{status}</span>
              <span className="text-xs text-muted-foreground capitalize">{league.sport.toUpperCase()} · {league.visibility.replace("_", " ")}</span>
              {!isOwner && <span className="text-xs text-muted-foreground">· Read-only (member view)</span>}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invite">Invite</TabsTrigger>
        </TabsList>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-5">
          {isActive && isOwner && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>League is active — scoring, deadline and chip rules are locked. You can still edit the league name and description.</span>
            </div>
          )}

          <Section title="Basics">
            <Field label="League name">
              <Input value={name} maxLength={40} disabled={!isOwner} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea value={description} disabled={!isOwner} rows={3} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Visibility">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["private", "invite_only", "public"] as const).map((v) => (
                  <button key={v} type="button" disabled={!isOwner}
                    onClick={() => setVisibility(v)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm capitalize transition disabled:opacity-60 disabled:cursor-not-allowed",
                      visibility === v ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:bg-muted/30",
                    )}
                  >{v.replace("_", " ")}</button>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Scoring formula" locked={!canEditRules}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["pts", "reb", "ast", "stl", "blk"] as StatKey[]).map((k) => (
                <div key={k} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="text-sm font-semibold uppercase w-12">{k}</div>
                  <Input type="number" step={0.5} min={0} max={10} disabled={!canEditRules}
                    value={weights[k]} onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                    className="w-24" />
                </div>
              ))}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 sm:col-span-2">
                <div className="text-sm font-semibold uppercase w-12">TO</div>
                <Switch checked={toEnabled} disabled={!canEditRules}
                  onCheckedChange={(v) => { setToEnabled(v); setWeights((w) => ({ ...w, to: v ? (w.to === 0 ? -1 : w.to) : 0 })); }} />
                <Input type="number" step={0.5} min={-5} max={0} disabled={!canEditRules || !toEnabled}
                  value={weights.to} onChange={(e) => setWeights((w) => ({ ...w, to: Number(e.target.value) }))}
                  className="w-24" />
                <span className="text-xs text-muted-foreground">Penalize turnovers (-5 to 0)</span>
              </div>
            </div>
            <Field label="Captain multiplier">
              <Input type="number" step={0.5} min={1} max={3} disabled={!canEditRules}
                value={captainMultiplier} onChange={(e) => setCaptainMultiplier(Number(e.target.value))} className="w-24" />
            </Field>
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-mono">{formulaPreview}</div>
          </Section>

          <Section title="Roster rules" locked={!canEditRules}>
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Budget cap</Label>
                <Switch checked={budgetCapEnabled} disabled={!canEditRules} onCheckedChange={setBudgetCapEnabled} />
              </div>
              {budgetCapEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input type="number" min={1} disabled={!canEditRules} value={budgetCap}
                    onChange={(e) => setBudgetCap(Number(e.target.value))} className="w-32" />
                  <span className="text-xs text-muted-foreground">million</span>
                </div>
              )}
            </div>
            <Field label="Bench size (3-8)">
              <Input type="number" min={3} max={8} disabled={!canEditRules} value={benchCount}
                onChange={(e) => setBenchCount(Number(e.target.value))} className="w-24" />
            </Field>
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max players from same NBA/WNBA team</Label>
                <Switch checked={maxPerTeamEnabled} disabled={!canEditRules} onCheckedChange={setMaxPerTeamEnabled} />
              </div>
              {maxPerTeamEnabled && (
                <Input type="number" min={1} max={5} disabled={!canEditRules} value={maxPerTeam}
                  onChange={(e) => setMaxPerTeam(Number(e.target.value))} className="w-24" />
              )}
            </div>
          </Section>

          <Section title="Deadline" locked={!canEditRules}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: "first_game_of_day" as const, title: "First game of the day", desc: "Locks at first tip-off." },
                { key: "per_player_game_lock" as const, title: "Per-player game lock", desc: "Each player locks individually." },
              ]).map((opt) => (
                <button key={opt.key} type="button" disabled={!canEditRules}
                  onClick={() => setDeadlineType(opt.key)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition disabled:opacity-60 disabled:cursor-not-allowed",
                    deadlineType === opt.key ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:bg-muted/30",
                  )}
                >
                  <div className="text-sm font-semibold">{opt.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Chips & transfers" locked={!canEditRules}>
            <ChipRow label="Captain" enabled={captainEnabled} setEnabled={setCaptainEnabled} disabled={!canEditRules}>
              <Label className="text-xs text-muted-foreground">Multiplier</Label>
              <Input type="number" step={0.5} min={1} max={3} disabled={!canEditRules || !captainEnabled}
                value={chipCaptainMult} onChange={(e) => setChipCaptainMult(Number(e.target.value))} className="w-20" />
            </ChipRow>
            <ChipRow label="Wildcard" enabled={wildcardEnabled} setEnabled={setWildcardEnabled} disabled={!canEditRules}>
              <Label className="text-xs text-muted-foreground">Per season</Label>
              <select className="rounded-md border border-border bg-background h-9 px-2 text-sm" disabled={!canEditRules || !wildcardEnabled}
                value={wildcardCount} onChange={(e) => setWildcardCount(Number(e.target.value) as 1 | 2)}>
                <option value={1}>1</option><option value={2}>2</option>
              </select>
            </ChipRow>
            <ChipRow label="All-Star" enabled={allStarEnabled} setEnabled={setAllStarEnabled} disabled={!canEditRules}>
              <Label className="text-xs text-muted-foreground">Count</Label>
              <select className="rounded-md border border-border bg-background h-9 px-2 text-sm" disabled={!canEditRules || !allStarEnabled}
                value={allStarCount} onChange={(e) => setAllStarCount(Number(e.target.value) as 1 | 2)}>
                <option value={1}>1</option><option value={2}>2</option>
              </select>
              <Label className="text-xs text-muted-foreground">Multiplier</Label>
              <Input type="number" step={0.5} min={1} max={5} disabled={!canEditRules || !allStarEnabled}
                value={allStarMultiplier} onChange={(e) => setAllStarMultiplier(Number(e.target.value))} className="w-20" />
            </ChipRow>
            <Field label="Free transfers per gameweek (1-5)">
              <Input type="number" min={1} max={5} disabled={!canEditRules} value={transferCap}
                onChange={(e) => setTransferCap(Number(e.target.value))} className="w-24" />
            </Field>
          </Section>

          {isOwner && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Save changes
                </Button>
                {isDraft && (
                  <Button variant="secondary" onClick={() => setConfirmActivate(true)} disabled={activating}>
                    Activate league
                  </Button>
                )}
                {isActive && (
                  <Button variant="secondary" onClick={() => setConfirmArchive(true)} disabled={archiving}>
                    Archive league
                  </Button>
                )}
              </div>
              {isDraft && (
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete league
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-3">
          {!isOwner ? (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="text-sm text-muted-foreground">You're a member of this league.</p>
              <Button variant="destructive" onClick={() => setConfirmLeave(true)}>
                <LogOut className="h-4 w-4 mr-2" /> Leave league
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {membersQ.isLoading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</div>}
              {membersQ.error && <div className="p-4 text-sm text-destructive">{(membersQ.error as Error).message}</div>}
              {membersQ.data && (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Member</th>
                      <th className="text-left px-4 py-2">Role</th>
                      <th className="text-left px-4 py-2">Teams</th>
                      <th className="text-left px-4 py-2">Joined</th>
                      <th className="text-right px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membersQ.data.map((m) => {
                      const isMemberOwner = m.user_id === league.owner_id;
                      const initials = m.owner_label.slice(0, 2).toUpperCase();
                      return (
                        <tr key={m.user_id} className="border-t border-border">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-xs font-bold inline-flex items-center justify-center">
                                {initials}
                              </div>
                              <span>{m.owner_label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                              isMemberOwner ? "border-primary/40 bg-primary/10 text-primary"
                                : m.role === "commissioner" ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                                : "border-border bg-muted/30 text-muted-foreground",
                            )}>{isMemberOwner ? "owner" : m.role}</span>
                          </td>
                          <td className="px-4 py-2">{m.team_count}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(m.joined_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-right">
                            {!isMemberOwner && (
                              <div className="inline-flex gap-2">
                                <select
                                  className="rounded-md border border-border bg-background h-8 px-2 text-xs"
                                  value={m.role}
                                  onChange={(e) => changeRole(m.user_id, e.target.value)}
                                >
                                  <option value="member">member</option>
                                  <option value="commissioner">commissioner</option>
                                </select>
                                <Button size="sm" variant="ghost" onClick={() => removeMember(m.user_id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </TabsContent>

        {/* INVITE TAB */}
        <TabsContent value="invite" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Join code</Label>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <div className="font-mono text-3xl tracking-[0.3em] font-bold rounded-lg border border-primary/30 bg-primary/5 px-5 py-3">
                  {league.join_code ?? "—"}
                </div>
                <Button variant="secondary" onClick={() => copyToClipboard(league.join_code ?? "", "Code")}>
                  <Copy className="h-4 w-4 mr-2" /> Copy code
                </Button>
                {isOwner && (
                  <Button variant="ghost" onClick={() => setConfirmRegen(true)} disabled={regenerating}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Share link</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button variant="secondary" onClick={() => copyToClipboard(shareUrl, "Link")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Join at {window.location.host}/join/{league.join_code ?? ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                "border-border bg-muted/30",
              )}>{league.visibility.replace("_", " ")}</span>
              {league.visibility === "public" && (
                <span className="text-xs text-muted-foreground">Anyone can find and join this league from the public directory.</span>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation dialogs */}
      <AlertDialog open={confirmActivate} onOpenChange={setConfirmActivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate league?</AlertDialogTitle>
            <AlertDialogDescription>
              Activating will lock the scoring, deadline and chip rules. Scoring begins immediately. Requires at least 2 teams.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate} disabled={activating}>
              {activating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive league?</AlertDialogTitle>
            <AlertDialogDescription>
              The league will be hidden from the active list but kept for history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete league?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the league and its rule sets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate invite code?</AlertDialogTitle>
            <AlertDialogDescription>
              The current code will stop working immediately. Anyone with the old code will need the new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={regenerating}>
              {regenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave league?</AlertDialogTitle>
            <AlertDialogDescription>
              Your teams in this league will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, locked, children }: { title: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-heading uppercase tracking-wider font-bold">{title}</h2>
        {locked && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Locked</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ChipRow({
  label, enabled, setEnabled, disabled, children,
}: { label: string; enabled: boolean; setEnabled: (v: boolean) => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{label}</div>
        <Switch checked={enabled} disabled={disabled} onCheckedChange={setEnabled} />
      </div>
      {enabled && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
    </div>
  );
}