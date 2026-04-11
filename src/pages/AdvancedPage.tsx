import { Gauge } from "lucide-react";

export default function AdvancedPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
      <Gauge className="h-12 w-12 mx-auto text-muted-foreground" />
      <h1 className="text-2xl font-heading font-bold uppercase tracking-wider">Advanced</h1>
      <p className="text-muted-foreground">Advanced features coming soon.</p>
    </div>
  );
}
