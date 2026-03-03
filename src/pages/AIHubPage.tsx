import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, ArrowLeftRight, Star, HelpCircle } from "lucide-react";

export default function AIHubPage() {
  const cards = [
    { icon: ArrowLeftRight, title: "Suggest Transfers", desc: "AI analyzes your roster and suggests optimal transfers" },
    { icon: Star, title: "Pick Captain", desc: "AI recommends the best captain based on upcoming matchups" },
    { icon: HelpCircle, title: "Explain Player", desc: "Ask the AI to break down any player's performance" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center py-8">
        <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">AI Hub</h2>
        <p className="text-muted-foreground">Coming in Prompt 3 — AI-powered coaching features</p>
      </div>
      <div className="grid gap-4">
        {cards.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="opacity-60 cursor-not-allowed">
            <CardHeader className="flex flex-row items-center gap-3 p-4">
              <Icon className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-sm">{desc}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
