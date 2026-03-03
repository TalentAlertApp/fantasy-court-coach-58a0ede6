import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";
import type { z } from "zod";
import type { HealthPayloadSchema } from "@/lib/contracts";

type HealthData = z.infer<typeof HealthPayloadSchema>;

const Index = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-foreground">
          /api/v1/health
        </h1>

        {loading && (
          <p className="text-muted-foreground">Calling health endpoint…</p>
        )}

        {error && (
          <div className="rounded bg-destructive/10 p-4 text-destructive">
            <p className="font-semibold">Zod validation or fetch error:</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
          </div>
        )}

        {health && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              ✅ Server validated &amp; Client validated via Zod
            </p>
            <pre className="overflow-auto rounded bg-muted p-4 text-sm text-foreground">
              {JSON.stringify(health, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
