import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid,
} from "recharts";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface ChartsPanelProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  allRoster: PlayerListItem[];
}

export default function ChartsPanel({ starters, bench, allRoster }: ChartsPanelProps) {
  const starterFp5 = starters.reduce((s, p) => s + p.last5.fp5, 0);
  const benchFp5 = bench.reduce((s, p) => s + p.last5.fp5, 0);

  const fpDelta = allRoster.map((p) => ({
    name: p.core.name.split(" ").pop() ?? p.core.name,
    fp: p.season.fp,
    fp5: p.last5.fp5,
    delta: p.computed.delta_fp,
  }));

  const stocksData = allRoster.map((p) => ({
    name: p.core.name.split(" ").pop() ?? p.core.name,
    stocks: p.computed.stocks5,
  }));

  const scatterData = allRoster.map((p) => ({
    name: p.core.name,
    salary: p.core.salary,
    value5: p.computed.value5,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Starters vs Bench FP5</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{ name: "Starters", fp5: starterFp5 }, { name: "Bench", fp5: benchFp5 }]}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="fp5" fill="hsl(216, 78%, 31%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">FP vs FP5 Delta</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fpDelta}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="delta" fill="hsl(43, 97%, 57%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Stocks Impact (STL+BLK ×3)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stocksData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="stocks" fill="hsl(351, 95%, 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Salary vs Value5</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="salary" name="Salary" tick={{ fontSize: 12 }} />
              <YAxis dataKey="value5" name="Value5" tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={scatterData} fill="hsl(216, 78%, 31%)" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
