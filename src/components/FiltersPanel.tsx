import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { useMemo } from "react";

interface FiltersPanelProps {
  fcBc: string;
  onFcBcChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  maxSalary: number;
  onMaxSalaryChange: (v: number) => void;
  maxSalaryLimit?: number;
  team?: string;
  onTeamChange?: (v: string) => void;
}

export default function FiltersPanel({
  fcBc, onFcBcChange, sort, onSortChange, search, onSearchChange, maxSalary, onMaxSalaryChange,
  maxSalaryLimit = 50, team, onTeamChange,
}: FiltersPanelProps) {
  const sortedTeams = useMemo(
    () => [...NBA_TEAMS].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  return (
    <div className="space-y-4 p-3 bg-card border rounded-lg">
      <div>
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Position</Label>
        <ToggleGroup type="single" value={fcBc} onValueChange={(v) => v && onFcBcChange(v)} className="justify-start">
          <ToggleGroupItem value="ALL" className="text-xs font-heading uppercase rounded-lg">All</ToggleGroupItem>
          <ToggleGroupItem value="FC" className="text-xs font-heading uppercase rounded-lg">FC</ToggleGroupItem>
          <ToggleGroupItem value="BC" className="text-xs font-heading uppercase rounded-lg">BC</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {onTeamChange && (
        <div>
          <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Team</Label>
          <Select value={team ?? "ALL"} onValueChange={onTeamChange}>
            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Teams</SelectItem>
              {sortedTeams.map((t) => (
                <SelectItem key={t.tricode} value={t.tricode}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Sort By</Label>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fp5">FP5</SelectItem>
            <SelectItem value="salary">Salary</SelectItem>
            <SelectItem value="value5">Value5</SelectItem>
            <SelectItem value="stocks5">Stocks5</SelectItem>
            <SelectItem value="delta_fp">Delta FP</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Search</Label>
        <Input placeholder="Name or team…" value={search} onChange={(e) => onSearchChange(e.target.value)} className="rounded-lg" />
      </div>
      <div>
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Max Salary: ${maxSalary}</Label>
        <Slider value={[maxSalary]} onValueChange={([v]) => onMaxSalaryChange(v)} min={0} max={maxSalaryLimit} step={0.5} />
      </div>
    </div>
  );
}
