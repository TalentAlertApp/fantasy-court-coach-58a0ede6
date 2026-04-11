import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
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

  const chartCard = (title: string, children: React.ReactNode) => (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="section-bar">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {chartCard("Starters vs Bench FP5", (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[{ name: "Starters", fp5: starterFp5 }, { name: "Bench", fp5: benchFp5 }]}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Barlow Condensed" }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="fp5" fill="hsl(220, 65%, 33%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ))}

      {chartCard("FP vs FP5 Delta", (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={fpDelta}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "Barlow Condensed" }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="delta" fill="hsl(43, 100%, 59%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ))}

      {chartCard("Stocks Impact (STL+BLK ×3)", (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stocksData}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "Barlow Condensed" }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="stocks" fill="hsl(351, 85%, 42%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ))}

      {chartCard("Salary vs Value5", (
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="salary" name="Salary" tick={{ fontSize: 11 }} />
            <YAxis dataKey="value5" name="Value5" tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={scatterData} fill="hsl(220, 65%, 33%)" />
          </ScatterChart>
        </ResponsiveContainer>
      ))}
    </div>
  );
}
