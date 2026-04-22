import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFirstRunGate } from "@/hooks/useFirstRunGate";
import { Loader2 } from "lucide-react";
import {
  shouldShowWelcomeBack,
  markWelcomeBackSeenThisSession,
  clearLastSignOut,
} from "@/lib/welcome-back-store";
import WelcomeBackHero from "@/components/welcome-back/WelcomeBackHero";

interface Props {
  children: React.ReactNode;
  /** When true, do not redirect to /welcome (e.g. /welcome itself uses this). */
  skipOnboardingGate?: boolean;
}

export default function RequireAuth({ children, skipOnboardingGate }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { ready, shouldOnboard } = useFirstRunGate();
  // Compute once on mount; recap is one-shot per session.
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() =>
    shouldShowWelcomeBack(user?.id)
  );

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
        }}
      />
    );
  }

  return <>{children}</>;
}