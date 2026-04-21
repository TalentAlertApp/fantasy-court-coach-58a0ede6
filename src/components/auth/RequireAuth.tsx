import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFirstRunGate } from "@/hooks/useFirstRunGate";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** When true, do not redirect to /welcome (e.g. /welcome itself uses this). */
  skipOnboardingGate?: boolean;
}

export default function RequireAuth({ children, skipOnboardingGate }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { ready, shouldOnboard } = useFirstRunGate();

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

  return <>{children}</>;
}