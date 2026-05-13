import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CreateLeagueInput = {
  name: string;
  description?: string;
  sport: "nba" | "wnba";
  visibility: "private" | "invite_only" | "public";
  scoring: {
    preset: "classic" | "guards_boost" | "bigs_boost" | "custom";
    weights: Partial<Record<"pts" | "reb" | "ast" | "stl" | "blk" | "to", number>>;
    captain_multiplier: number;
  };
  roster: {
    budget_cap?: number | null;
    bench_count: number;
    max_players_per_team?: number | null;
  };
  deadline_type: "first_game_of_day" | "per_player_game_lock";
  chips: {
    captain_enabled: boolean;
    captain_multiplier: number;
    wildcard_enabled: boolean;
    wildcard_count: number;
    all_star_enabled: boolean;
    all_star_count: number;
    all_star_multiplier: number;
  };
  transfer_cap: number;
};

export type CreateLeagueResult = { league_id: string; join_code: string };

export function useCreateLeague() {
  const qc = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLeague(input: CreateLeagueInput): Promise<CreateLeagueResult> {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("leagues-create", {
        body: input,
      });
      if (invokeErr) throw new Error(invokeErr.message);
      const env = data as { ok?: boolean; data?: CreateLeagueResult; error?: { message?: string } } | null;
      if (!env?.ok || !env.data) {
        throw new Error(env?.error?.message ?? "Failed to create league");
      }
      await qc.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      return env.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  return { createLeague, isLoading, error };
}