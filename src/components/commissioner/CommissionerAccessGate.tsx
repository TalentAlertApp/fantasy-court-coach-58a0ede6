import { useState, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const storageKey = (userId: string) => `commissioner_unlocked:${userId}`;

function readUnlocked(userId: string | undefined): boolean {
  if (!userId) return false;
  try { return localStorage.getItem(storageKey(userId)) === "1"; } catch { return false; }
}

export default function CommissionerAccessGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(() => readUnlocked(user?.id));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("commissioner-access-verify", {
        body: { password },
      });
      if (invokeErr || !data?.ok) {
        setError(data?.error?.message ?? "Incorrect password.");
        return;
      }
      if (user?.id) {
        try { localStorage.setItem(storageKey(user.id), "1"); } catch { /* noop */ }
      }
      setUnlocked(true);
    } catch (err) {
      setError((err as Error).message ?? "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative h-full min-h-[60vh] flex items-center justify-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border bg-card/60 backdrop-blur p-6 space-y-4 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h1 className="text-base font-heading font-semibold">Commissioner Access</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the access password to continue. You only need to do this once per account on this browser.
        </p>
        <Input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
          disabled={busy}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || !password.trim()} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
          Unlock
        </Button>
      </form>
    </div>
  );
}
