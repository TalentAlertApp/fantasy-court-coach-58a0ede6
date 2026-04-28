import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PulseRow {
  player_id: number;
  count: number;
  name: string;
  team: string;
  fc_bc: "FC" | "BC";
  photo: string | null;
}

async function fetchPulse(): Promise<{ picked: PulseRow[]; waived: PulseRow[] }> {
  // Pull all transactions (RLS scopes per-user normally, but this is a public aggregate view —
  // the SELECT policy on transactions is per-team. To get *all* fantasy-user activity we need a
  // policy that allows public read OR an RPC. We'll do a best-effort client query and rely on
  // whatever rows the user can see. In single-league deployments this still surfaces useful data.)
  const { data, error } = await supabase
    .from("transactions")
    .select("player_in_id, player_out_id")
    .limit(10000);
  if (error) throw error;

  const inCounts = new Map<number, number>();
  const outCounts = new Map<number, number>();
  for (const row of data ?? []) {
    if (row.player_in_id && row.player_in_id > 0) {
      inCounts.set(row.player_in_id, (inCounts.get(row.player_in_id) ?? 0) + 1);
    }
    if (row.player_out_id && row.player_out_id > 0) {
      outCounts.set(row.player_out_id, (outCounts.get(row.player_out_id) ?? 0) + 1);
    }
  }

  const allIds = Array.from(new Set([...inCounts.keys(), ...outCounts.keys()]));
  if (allIds.length === 0) return { picked: [], waived: [] };

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, name, team, fc_bc, photo")
    .in("id", allIds);
  if (pErr) throw pErr;

  const pmap = new Map((players ?? []).map((p: any) => [p.id, p]));
  const build = (m: Map<number, number>): PulseRow[] =>
    Array.from(m.entries())
      .map(([id, count]) => {
        const p = pmap.get(id);
        if (!p) return null;
        return {
          player_id: id,
          count,
          name: p.name,
          team: p.team,
          fc_bc: p.fc_bc as "FC" | "BC",
          photo: p.photo ?? null,
        };
      })
      .filter(Boolean) as PulseRow[];

  const picked = build(inCounts).sort((a, b) => b.count - a.count).slice(0, 20);
  const waived = build(outCounts).sort((a, b) => b.count - a.count).slice(0, 20);
  return { picked, waived };
}

export function useTransactionsPulse() {
  return useQuery({
    queryKey: ["transactions-pulse"],
    queryFn: fetchPulse,
    staleTime: 5 * 60 * 1000,
  });
}