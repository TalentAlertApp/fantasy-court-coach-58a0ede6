import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import nbaLogo from "@/assets/nba-logo.svg";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Sign in failed", { description: error.message });
    } else {
      toast.success("Signed in");
      navigate("/", { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    setBusy(false);
    if (error) {
      toast.error("Sign up failed", { description: error.message });
    } else {
      toast.success("Account created", {
        description: "If email confirmation is required, check your inbox.",
      });
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail) return;
    setBusy(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: redirectUrl },
    });
    setBusy(false);
    if (error) {
      toast.error("Could not send magic link", { description: error.message });
    } else {
      toast.success("Check your inbox", {
        description: `We sent a sign-in link to ${magicEmail}`,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src={nbaLogo} alt="NBA" className="h-12 w-auto" />
          <h1 className="text-2xl font-heading font-bold uppercase tracking-[0.2em] text-foreground">
            Fantasy
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to manage your team</p>
        </div>

        <Card className="p-6">
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="password">
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Password
              </TabsTrigger>
              <TabsTrigger value="magic">
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Magic Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="space-y-4">
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    minLength={6}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="submit"
                    onClick={handleSignIn}
                    disabled={busy || !email || !password}
                    className="w-full"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSignUp}
                    disabled={busy || !email || !password}
                    variant="outline"
                    className="w-full"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign up"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="magic" className="space-y-4">
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="you@example.com"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" disabled={busy || !magicEmail} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send magic link"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  We'll email you a one-click sign-in link.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}