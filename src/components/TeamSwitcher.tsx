import { useState } from "react";
import { useTeam } from "@/contexts/TeamContext";
import { createTeam, updateTeam, deleteTeam } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function TeamSwitcher() {
  const { teams, selectedTeamId, setSelectedTeamId, isLoading } = useTeam();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createTeam({ name: newName.trim() });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      setSelectedTeamId(res.team.id);
      setCreateOpen(false);
      setNewName("");
      toast({ title: `Team "${res.team.name}" created!` });
    } catch (e: any) {
      toast({ title: "Error creating team", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;
    setRenaming(true);
    try {
      await updateTeam(renameId, { name: renameName.trim() });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      setRenameOpen(false);
      toast({ title: "Team renamed!" });
    } catch (e: any) {
      toast({ title: "Error renaming team", description: e.message, variant: "destructive" });
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
      await deleteTeam(deleteId);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      if (selectedTeamId === deleteId) {
        const remaining = teams.find((t) => t.id !== deleteId);
        if (remaining) setSelectedTeamId(remaining.id);
      }
      setDeleteOpen(false);
      toast({ title: "Team deleted" });
    } catch (e: any) {
      toast({ title: "Error deleting team", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={selectedTeamId ?? ""} onValueChange={(v) => {
          if (v === "__new__") {
            setCreateOpen(true);
          } else {
            setSelectedTeamId(v);
          }
        }}>
          <SelectTrigger className="w-[160px] h-8 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground text-sm">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2 w-full">
                  {t.name}
                </span>
              </SelectItem>
            ))}
            <SelectItem value="__new__">
              <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> New Team</span>
            </SelectItem>
          </SelectContent>
        </Select>

        {selectedTeamId && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                const team = teams.find((t) => t.id === selectedTeamId);
                if (team) {
                  setRenameId(team.id);
                  setRenameName(team.name);
                  setRenameOpen(true);
                }
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground/70 hover:text-destructive hover:bg-primary-foreground/10"
              onClick={() => {
                setDeleteId(selectedTeamId);
                setDeleteOpen(true);
              }}
              disabled={teams.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Team</DialogTitle></DialogHeader>
          <Input placeholder="Team name..." value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>{creating ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Team</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRename()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming || !renameName.trim()}>{renaming ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the team and its roster. This action cannot be undone.
            </AlertDialogDescription>
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
