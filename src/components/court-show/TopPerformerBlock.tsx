import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopPerformer } from "./types";

/** Shared "top performer" panel used by both the Played-Games Recap cards and
 *  the Ballers.IQ played card. Photo + flame + name + FP + box-score line.
 *  Clicking the panel deep-links to the player. */
export default function TopPerformerBlock({
  tp,
  onPlayerClick,
  className,
}: {
  tp: TopPerformer;
  onPlayerClick: (id: number) => void;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onPlayerClick(tp.player_id);
      }}
      className={cn(
        "flex items-center gap-3 w-full rounded-lg bg-black/30 border border-white/5 px-3 py-2 text-left hover:border-amber-400/40 hover:bg-black/40 transition-colors",
        className,
      )}
    >
      {tp.photo ? (
        <img src={tp.photo} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-amber-400/40" />
      ) : (
        <div className="h-10 w-10 rounded-full bg-white/10" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Flame className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="font-heading font-black text-[12px] text-white truncate">{tp.name}</span>
          <span className="ml-auto font-mono font-bold text-[12px] text-amber-300 shrink-0">
            {tp.fp.toFixed(1)} FP
          </span>
        </div>
        <p className="text-[10px] text-white/55 mt-0.5 truncate">
          {(tp.pts ?? 0)} PTS · {(tp.reb ?? 0)} REB · {(tp.ast ?? 0)} AST · {(tp.stl ?? 0)} STL · {(tp.blk ?? 0)} BLK
        </p>
      </div>
    </button>
  );
}