import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicLeague = {
  id: string;
  name: string;
  description: string | null;
  sport: "nba" | "wnba";
  status: string;
  join_code: string | null;
  team_count: number;
  member_count: number;
  scoring_formula_short: string;
  deadline_type: string | null;
  chips_enabled: string[];
  created_at: string;
};

export type PublicLeaguesResponse = {
  items: PublicLeague[];
  page: number;
  page_size: number;
  has_more: boolean;
};

export type PublicLeaguesParams = {
  sport?: "nba" | "wnba" | null;
  search?: string;
  page?: number;
  sort?: "newest" | "most_teams" | "active";
};

async function fetchPublicLeagues(params: PublicLeaguesParams): Promise<PublicLeaguesResponse> {
  const qp = new URLSearchParams();
  if (params.sport) qp.set("sport", params.sport);
  if (params.search) qp.set("search", params.search);
  qp.set("page", String(params.page ?? 1));
  qp.set("sort", params.sort ?? "active");

  const { data, error } = await supabase.functions.invoke(`leagues-discover?${qp.toString()}`, {
    method: "GET",
  });
  if (error) throw error;
  const env = data as { ok: boolean; data: PublicLeaguesResponse; error?: { message: string } };
  if (!env?.ok) throw new Error(env?.error?.message ?? "Failed to load public leagues");
  return env.data;
}

export function usePublicLeagues(params: PublicLeaguesParams) {
  return useQuery({
    queryKey: ["public-leagues", params.sport ?? null, params.search ?? "", params.page ?? 1, params.sort ?? "active"],
    queryFn: () => fetchPublicLeagues(params),
    staleTime: 2 * 60_000,
  });
}