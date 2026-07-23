"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MatchData, FormationKey, Tactics } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";
import { coachTips } from "@/lib/aiCoach";

const SEV: Record<string, { ring: string; text: string; tag: string }> = {
  opportunity: { ring: "border-neon-grass/50", text: "text-neon-grass", tag: "OPPORTUNITY" },
  warning: { ring: "border-neon-red/50", text: "text-neon-red", tag: "WARNING" },
  info: { ring: "border-neon-ice/50", text: "text-neon-ice", tag: "INSIGHT" },
};

export default function AICoachPanel({
  match,
  snap,
  tactics,
  formation,
}: {
  match: MatchData;
  snap: MatchSnapshot;
  tactics: Tactics;
  formation: FormationKey;
}) {
  const tips = coachTips(match, snap, tactics, formation);
  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neon-ice/20 text-sm">🧠</span>
        <div>
          <div className="font-display text-sm font-bold uppercase tracking-widest">AI Coach</div>
          <div className="text-[10px] text-white/45">Live tactical assistant</div>
        </div>
        <span className="ml-auto chip bg-neon-ice/15 text-neon-ice">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-ice animate-pulseGlow" /> ANALYZING
        </span>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {tips.map((t) => {
            const sev = SEV[t.severity];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl border bg-white/5 p-3 ${sev.ring}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${sev.text}`}>{sev.tag}</span>
                  <span className="text-[10px] text-white/45">Confidence {t.confidence}%</span>
                </div>
                <p className="text-sm font-semibold leading-snug">{t.headline}</p>
                <p className="mt-1 text-xs leading-snug text-white/60">{t.reason}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-neon-ice to-neon-grass"
                    initial={{ width: 0 }}
                    animate={{ width: `${t.confidence}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
