import { useState } from "react";
import { useTeam } from "@/contexts/TeamContext";
import { createTeam } from "@/lib/api";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function TeamSwitcher() {
  const { teams, selectedTeamId, setSelectedTeamId, isLoading } = useTeam();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createTeam({ name: newName.trim() });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      setSelectedTeamId(res.team.id);
      setDialogOpen(false);
      setNewName("");
      toast({ title: `Team "${res.team.name}" created!` });
    } catch (e: any) {
      toast({ title: "Error creating team", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={selectedTeamId ?? ""} onValueChange={(v) => {
          if (v === "__new__") {
            setDialogOpen(true);
          } else {
            setSelectedTeamId(v);
          }
        }}>
          <SelectTrigger className="w-[160px] h-8 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground text-sm">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
            <SelectItem value="__new__">
              <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> New Team</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Team name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
