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
import BallersIQEntryIntro from "@/components/welcome-back/BallersIQEntryIntro";
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
  const navStateAny = (location.state as { forceNewTeam?: boolean; resumeChooseLeague?: boolean } | null);
  const forceNewTeam = navStateAny?.forceNewTeam === true;
  const resumeChooseLeague = navStateAny?.resumeChooseLeague === true;
  // Recap is one-shot per session. Compute *after* auth resolves so the
  // user id is reliably available — initializing in useState would race
  // with the loading state and silently produce false.
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(false);
  const [entryIntroOpen, setEntryIntroOpen] = useState<boolean>(false);
  useEffect(() => {
    if (loading) return;
    if (!user?.id) return;
    // Force-open via ?welcomeback=1 for testing
    const forced = new URLSearchParams(location.search).get("welcomeback") === "1";
    // Show Welcome Back to any returning user (≥1 team) once per session.
    // Previously gated on a >1h sign-out gap; now always on for returning users.
    setWelcomeOpen(forced || !isWelcomeBackSeenThisSession());
  }, [loading, user?.id, location.search]);

  // One-shot: when onboarding just finished a brand-new team, play the entry
  // intro on the next render (Welcome Back was bypassed on purpose).
  useEffect(() => {
    if (loading || !user?.id) return;
    try {
      if (sessionStorage.getItem("nba_show_entry_intro_once") === "1") {
        sessionStorage.removeItem("nba_show_entry_intro_once");
        setEntryIntroOpen(true);
      }
    } catch { /* noop */ }
  }, [loading, user?.id]);

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

  // While teams are still loading, show a neutral loader instead of letting
  // child routes render. This prevents the Draft hero from flashing in the
  // one-frame window before the multi-team picker redirect fires.
  if (!skipOnboardingGate && !teamsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // First-run onboarding redirect (only once teams have loaded; never bounces /welcome onto itself)
  if (!skipOnboardingGate && location.pathname !== "/leagues/create" && ready && shouldOnboard) {
    return <Navigate to="/welcome" replace />;
  }

  // Multi-team picker: when a returning user owns ≥2 teams and hasn't yet
  // chosen one in this session, route to the picker. Skip on the picker
  // route itself to avoid an infinite redirect loop.
  const onPickerRoute = location.pathname === "/welcome/pick-team";
  const onCreateLeagueRoute = location.pathname === "/leagues/create";
  if (
    !skipOnboardingGate &&
    !onPickerRoute &&
    !onCreateLeagueRoute &&
    !forceNewTeam &&
    !resumeChooseLeague &&
    ready &&
    !shouldOnboard &&
    teamsReady &&
    user
  ) {
    const owned = teams.filter((t: any) => t.owner_id === user.id || !t.owner_id);
    if (owned.length >= 1 && !isTeamPickedThisSession()) {
      return <Navigate to="/welcome/pick-team" replace />;
    }
  }

  // One-shot welcome-back recap for returning users (post-onboarding only)
  if (
    !skipOnboardingGate &&
    !forceNewTeam &&
    !resumeChooseLeague &&
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
          // Strip the preview query param if present
          if (new URLSearchParams(location.search).get("welcomeback") === "1") {
            navigate(location.pathname, { replace: true });
          }
          setEntryIntroOpen(true);
          setWelcomeOpen(false);
        }}
        onContinue={() => {
          markWelcomeBackSeenThisSession();
          clearLastSignOut(user.id);
          setWelcomeOpen(false);
          navigate("/advanced", { replace: true });
        }}
      />
    );
  }

  return (
    <>
      {children}
      {entryIntroOpen && (
        <BallersIQEntryIntro onDone={() => setEntryIntroOpen(false)} />
      )}
    </>
  );
}