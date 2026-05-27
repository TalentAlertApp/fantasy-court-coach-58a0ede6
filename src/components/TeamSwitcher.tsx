import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTeam } from "@/contexts/TeamContext";
import { updateTeam, deleteTeam } from "@/lib/api";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import LeagueLogoBadge from "@/components/LeagueLogoBadge";
import { markTeamPickedThisSession } from "@/lib/welcome-back-store";
import { setCreatingNewTeam } from "@/lib/onboarding-store";

export default function TeamSwitcher() {
  const { teams, selectedTeamId, setSelectedTeamId, isLoading } = useTeam();
  const queryClient = useQueryClient();
  const teamsFetching = useIsFetching({ queryKey: ["teams"] });
  const navigate = useNavigate();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Route to onboarding when arriving via ?newTeam=1 (e.g. from /leagues "Create Team").
  useEffect(() => {
    if (searchParams.get("newTeam") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("newTeam");
      next.delete("sport");
      next.delete("league_id");
      setSearchParams(next, { replace: true });
      markTeamPickedThisSession();
      setCreatingNewTeam();
      navigate("/welcome", { state: { forceNewTeam: true } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;
    const trimmed = renameName.trim();
    // Client-side duplicate guard so we never hit the server's 400 and don't
    // surface that as a runtime error overlay.
    const dup = teams.some(
      (t: any) =>
        t.id !== renameId &&
        String(t.name ?? "").trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (dup) {
      setRenameError("You already have a team with this name. Pick a different one.");
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await updateTeam(renameId, { name: trimmed });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      setRenameOpen(false);
      toast({ title: "Team renamed!" });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/DUPLICATE_NAME|already have a team with this name/i.test(msg)) {
        setRenameError("You already have a team with this name. Pick a different one.");
      } else {
        setRenameError(msg || "Could not rename team. Try again.");
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (teams.length <= 1) {
      toast({ title: "Cannot delete the last team", variant: "destructive" });
      return;
    }
    setDeleting(true);
    try {
      const deletingActiveTeam = selectedTeamId === deleteId;
      const fallbackTeam = teams.find((t) => t.id !== deleteId) ?? null;

      // Switch away from the team before deleting it so no subscriber refetches
      // roster-current with an id that is about to disappear.
      if (deletingActiveTeam && fallbackTeam) {
        setSelectedTeamId(fallbackTeam.id);
      }

      await queryClient.cancelQueries({ queryKey: ["roster-current", deleteId] });
      queryClient.removeQueries({ queryKey: ["roster-current", deleteId] });

      await deleteTeam(deleteId);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      await queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      setDeleteOpen(false);
      toast({ title: "Team deleted" });
    } catch (e: any) {
      toast({ title: "Error deleting team", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading || (teamsFetching > 0 && teams.length === 0)) {
    return (
      <div className="w-full h-8 rounded-lg bg-white/10 border border-white/20 animate-pulse" />
    );
  }

  return (
    <>
      <div className="w-full">
        <Select value={selectedTeamId ?? ""} onValueChange={(v) => {
          if (v === "__new__") {
            markTeamPickedThisSession();
            setCreatingNewTeam();
            navigate("/welcome", { state: { forceNewTeam: true } });
          } else setSelectedTeamId(v);
        }}>
          <SelectTrigger className="w-full h-8 bg-white/10 border-white/20 text-white text-[11px] font-heading uppercase tracking-[0.15em] rounded-lg">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent className="min-w-[--radix-select-trigger-width]">
            {teams.map((t: any) => (
              <div
                key={t.id}
                className="group relative flex items-center pr-14"
              >
                <SelectItem value={t.id} className="flex-1 font-heading uppercase tracking-[0.15em] text-[11px]">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <LeagueLogoBadge league={t.league_code ?? "nba"} size="xs" />
                    <span className="truncate">{t.name}</span>
                  </span>
                </SelectItem>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      setRenameId(t.id); setRenameName(t.name); setRenameError(null); setRenameOpen(true);
                    }}
                    className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    aria-label={`Rename ${t.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={teams.length <= 1}
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      setDeleteId(t.id); setDeleteOpen(true);
                    }}
                    className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent/40 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            <SelectItem value="__new__" className="font-heading uppercase tracking-[0.15em] text-[11px]">
              <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> New Team</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={renameOpen} onOpenChange={(o) => { setRenameOpen(o); if (!o) setRenameError(null); }}>
        <DialogContent className="rounded-lg">
          <DialogHeader><DialogTitle className="font-heading">Rename Team</DialogTitle></DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => { setRenameName(e.target.value); if (renameError) setRenameError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="rounded-lg"
          />
          {renameError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {renameError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming || !renameName.trim()}>{renaming ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the team and its roster.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
