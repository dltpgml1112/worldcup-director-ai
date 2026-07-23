"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MatchData, MatchEvent } from "@/lib/types";

const ICON: Record<MatchEvent["type"], string> = {
  goal: "⚽",
  shot: "🎯",
  save: "🧤",
  chance: "⚡",
  corner: "🚩",
  card: "🟨",
  sub: "🔁",
  whistle: "📣",
};

export default function EventFeed({ match, minute }: { match: MatchData; minute: number }) {
  const events = match.timeline.filter((e) => e.minute <= minute).slice().reverse();
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/50">Live Commentary</div>
      <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const home = e.side === "home";
            const team = home ? match.home : match.away;
            const isGoal = e.type === "goal";
            return (
              <motion.div
                key={`${e.minute}-${e.type}-${e.player ?? ""}-${e.detail.slice(0, 8)}`}
                initial={{ opacity: 0, x: home ? -20 : 20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                className={`flex items-start gap-3 rounded-xl border p-2.5 ${
                  isGoal ? "border-neon-gold/40 bg-neon-gold/10 shadow-glow-gold" : "border-white/10 bg-white/5"
                }`}
              >
                <span className="mt-0.5 w-9 shrink-0 text-center font-display text-sm font-bold tabular-nums text-white/70">
                  {e.minute}'
                </span>
                <span className="text-lg leading-none">{ICON[e.type]}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: team.primary }}>
                      {team.code}
                    </span>
                    {isGoal && <span className="chip bg-neon-gold/20 text-neon-gold">GOAL</span>}
                  </div>
                  <p className={`text-sm ${isGoal ? "font-semibold text-white" : "text-white/80"}`}>{e.detail}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
