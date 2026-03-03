import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface FiltersPanelProps {
  fcBc: string;
  onFcBcChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  maxSalary: number;
  onMaxSalaryChange: (v: number) => void;
}

export default function FiltersPanel({
  fcBc, onFcBcChange, sort, onSortChange, search, onSearchChange, maxSalary, onMaxSalaryChange,
}: FiltersPanelProps) {
  return (
    <div className="space-y-4 p-3 bg-card border rounded-sm">
      <div>
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Position</Label>
        <ToggleGroup type="single" value={fcBc} onValueChange={(v) => v && onFcBcChange(v)} className="justify-start">
          <ToggleGroupItem value="ALL" className="text-xs font-heading uppercase rounded-sm">All</ToggleGroupItem>
          <ToggleGroupItem value="FC" className="text-xs font-heading uppercase rounded-sm">FC</ToggleGroupItem>
          <ToggleGroupItem value="BC" className="text-xs font-heading uppercase rounded-sm">BC</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div>
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Sort By</Label>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
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
        <Input placeholder="Name or team…" value={search} onChange={(e) => onSearchChange(e.target.value)} className="rounded-sm" />
      </div>
      <div>
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 block tracking-wider">Max Salary: ${maxSalary}</Label>
        <Slider value={[maxSalary]} onValueChange={([v]) => onMaxSalaryChange(v)} min={0} max={50} step={0.5} />
      </div>
    </div>
  );
}
