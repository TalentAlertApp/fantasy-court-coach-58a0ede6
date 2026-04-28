import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFirstRunGate } from "@/hooks/useFirstRunGate";
import { Loader2 } from "lucide-react";
import {
  shouldShowWelcomeBack,
  markWelcomeBackSeenThisSession,
  clearLastSignOut,
  isTeamPickedThisSession,
  isWelcomeBackSeenThisSession,
} from "@/lib/welcome-back-store";
import WelcomeBackHero from "@/components/welcome-back/WelcomeBackHero";
import { useTeam } from "@/contexts/TeamContext";

interface Props {
  children: React.ReactNode;
  /** When true, do not redirect to /welcome (e.g. /welcome itself uses this). */
  skipOnboardingGate?: boolean;
}

export default function RequireAuth({ children, skipOnboardingGate }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { ready, shouldOnboard } = useFirstRunGate();
  const { teams, isReady: teamsReady } = useTeam();
  // Recap is one-shot per session. Compute *after* auth resolves so the
  // user id is reliably available — initializing in useState would race
  // with the loading state and silently produce false.
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(false);
  useEffect(() => {
    if (loading) return;
    if (!user?.id) return;
    // Force-open via ?welcomeback=1 for testing
    const forced = new URLSearchParams(location.search).get("welcomeback") === "1";
    // Show Welcome Back to any returning user (≥1 team) once per session.
    // Previously gated on a >1h sign-out gap; now always on for returning users.
    setWelcomeOpen(forced || !isWelcomeBackSeenThisSession());
  }, [loading, user?.id, location.search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // First-run onboarding redirect (only once teams have loaded; never bounces /welcome onto itself)
  if (!skipOnboardingGate && ready && shouldOnboard) {
    return <Navigate to="/welcome" replace />;
  }

  // Multi-team picker: when a returning user owns ≥2 teams and hasn't yet
  // chosen one in this session, route to the picker. Skip on the picker
  // route itself to avoid an infinite redirect loop.
  const onPickerRoute = location.pathname === "/welcome/pick-team";
  if (
    !skipOnboardingGate &&
    !onPickerRoute &&
    ready &&
    !shouldOnboard &&
    teamsReady &&
    user
  ) {
    const owned = teams.filter((t: any) => t.owner_id === user.id || !t.owner_id);
    if (owned.length >= 2 && !isTeamPickedThisSession()) {
      return <Navigate to="/welcome/pick-team" replace />;
    }
  }

  // One-shot welcome-back recap for returning users (post-onboarding only)
  if (
    !skipOnboardingGate &&
    ready &&
    !shouldOnboard &&
    welcomeOpen &&
    user
  ) {
    return (
      <WelcomeBackHero
        onEnter={() => {
          markWelcomeBackSeenThisSession();
          clearLastSignOut(user.id);
          setWelcomeOpen(false);
          // Strip the preview query param if present
          if (new URLSearchParams(location.search).get("welcomeback") === "1") {
            navigate(location.pathname, { replace: true });
          }
        }}
      />
    );
  }

  return <>{children}</>;
}