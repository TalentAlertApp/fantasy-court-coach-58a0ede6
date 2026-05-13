import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trophy, Users } from "lucide-react";
import LeaguePickerCards from "@/components/LeaguePickerCards";
import { useFantasyLeagues, MAIN_LEAGUE_ID } from "@/hooks/useFantasyLeagues";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  onBack: () => void;
  onSubmit: (args: { fantasyLeagueId?: string; leagueCode: "nba" | "wnba" }) => void | Promise<void>;
  submitting: boolean;
}

export default function ChooseLeagueStep({ onBack, onSubmit, submitting }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: leagues = [], isLoading } = useFantasyLeagues();
  const [selectedId, setSelectedId] = useState<string>(MAIN_LEAGUE_ID);
  const [mainSport, setMainSport] = useState<"nba" | "wnba">("nba");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const main = leagues.find((l) => l.id === MAIN_LEAGUE_ID);
  const others = leagues.filter((l) => l.id !== MAIN_LEAGUE_ID);
  const selected = leagues.find((l) => l.id === selectedId);

  const handleNext = () => {
    if (selectedId === MAIN_LEAGUE_ID) {
      onSubmit({ leagueCode: mainSport });
    } else if (selected) {
      onSubmit({ fantasyLeagueId: selectedId, leagueCode: selected.sport });
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("leagues-join", {
        body: { join_code: code },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error.message ?? "Could not join league");
      toast({ title: "Joined!", description: "League added to your list." });
      await queryClient.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      const newId = data?.data?.league_id ?? data?.league_id;
      if (newId) setSelectedId(newId);
      setJoinCode("");
    } catch (e: any) {
      toast({ title: "Could not join", description: e?.message ?? "Try again", variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen px-6 py-8 items-center justify-center overflow-y-auto">
      <div className="w-full max-w-3xl text-center animate-fade-in py-10">
        <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-4">Almost there</p>
        <h2
          className="font-heading font-black uppercase tracking-[0.15em] text-foreground"
          style={{ fontSize: "clamp(2rem, 6vh, 4rem)", lineHeight: 1 }}
        >
          Choose Your <span className="text-accent">League</span>
        </h2>
        <p className="mt-3 text-sm text-foreground/60">Where will this team play?</p>

        <div className="mt-8 grid gap-3 text-left">
          {/* Main league card */}
          <LeagueCard
            active={selectedId === MAIN_LEAGUE_ID}
            onClick={() => setSelectedId(MAIN_LEAGUE_ID)}
            title={main?.name ?? "Main League"}
            subtitle="The flagship public league — open to everyone."
            badge="MAIN"
          >
            {selectedId === MAIN_LEAGUE_ID && (
              <div className="mt-4 pt-4 border-t border-foreground/10">
                <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
                  Choose sport
                </div>
                <LeaguePickerCards
                  value={mainSport}
                  onChange={setMainSport}
                  size="md"
                  disabled={submitting}
                  showSubtitle={false}
                />
              </div>
            )}
          </LeagueCard>

          {others.map((l) => (
            <LeagueCard
              key={l.id}
              active={selectedId === l.id}
              onClick={() => setSelectedId(l.id)}
              title={l.name}
              subtitle={l.description ?? `${l.memberCount} member${l.memberCount === 1 ? "" : "s"} • ${l.sport.toUpperCase()}`}
              badge={l.sport.toUpperCase()}
            />
          ))}

          {!isLoading && others.length === 0 && (
            <div className="text-xs text-foreground/40 italic px-2">
              You're not in any custom leagues yet.
            </div>
          )}
        </div>

        {/* Create / Join actions */}
        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate("/leagues/create")}
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] px-4 py-3 text-sm uppercase tracking-[0.15em] text-foreground/70 hover:border-accent hover:text-accent transition-colors"
          >
            <Plus className="h-4 w-4" /> Create New League
          </button>
          <div className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="JOIN CODE"
              maxLength={8}
              disabled={joining || submitting}
              className="h-11 font-mono uppercase tracking-[0.2em] text-center"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleJoin}
              disabled={joining || submitting || joinCode.trim().length < 4}
              className="h-11"
            >
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={submitting}
            className="h-12 rounded-full px-6 text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={submitting || !selected}
            className="h-14 rounded-full px-10 tracking-[0.25em] shadow-[0_0_40px_-10px_hsl(var(--accent))] hover:translate-y-[-1px] hover:shadow-[0_0_60px_-10px_hsl(var(--accent))] transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
              </>
            ) : (
              <>
                Create Team <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeagueCard({
  active,
  onClick,
  title,
  subtitle,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-5 transition-all ${
        active
          ? "border-accent bg-accent/5 shadow-[0_0_30px_-12px_hsl(var(--accent))]"
          : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/25"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${active ? "bg-accent/15 text-accent" : "bg-foreground/5 text-foreground/50"}`}>
          <Trophy className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-heading uppercase tracking-[0.12em] text-base text-foreground truncate">
              {title}
            </h3>
            {badge && (
              <span className="text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/60">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-foreground/50 mt-1 line-clamp-2">{subtitle}</p>
        </div>
      </div>
      {children}
    </button>
  );
}