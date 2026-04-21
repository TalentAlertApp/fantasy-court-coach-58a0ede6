import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns shouldOnboard=true when the signed-in user has zero teams they own.
 * Legacy teams (owner_id === null) do NOT count — onboarding is per-user.
 */
export function useFirstRunGate() {
  const { user, loading: authLoading } = useAuth();
  const { teams, isReady, isLoading } = useTeam();

  const ready = !authLoading && !isLoading && isReady && !!user;
  const ownedTeams = ready
    ? teams.filter((t: any) => t.owner_id && t.owner_id === user!.id)
    : [];

  return {
    ready,
    ownedTeams,
    shouldOnboard: ready && ownedTeams.length === 0,
  };
}