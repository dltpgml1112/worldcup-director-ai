"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MatchData, FormationKey, Tactics } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";
import { coachTips } from "@/lib/aiCoach";
import { useGame } from "@/lib/store";
import { t } from "@/lib/i18n";

const SEV: Record<string, { ring: string; text: string; k: string }> = {
  opportunity: { ring: "border-neon-grass/50", text: "text-neon-grass", k: "sev.opportunity" },
  warning: { ring: "border-neon-red/50", text: "text-neon-red", k: "sev.warning" },
  info: { ring: "border-neon-ice/50", text: "text-neon-ice", k: "sev.info" },
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
  const players = useGame((s) => s.players);
  const subsUsed = useGame((s) => s.subsUsed);
  const lang = useGame((s) => s.lang);
  const tips = coachTips(match, snap, tactics, formation, players, subsUsed, lang);
  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neon-ice/20 text-sm">🧠</span>
        <div>
          <div className="font-display text-sm font-bold uppercase tracking-widest">{t(lang, "coach.title")}</div>
          <div className="text-[10px] text-white/45">{t(lang, "coach.subtitle")}</div>
        </div>
        <span className="ml-auto chip bg-neon-ice/15 text-neon-ice">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-ice animate-pulseGlow" /> {t(lang, "coach.analyzing")}
        </span>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {tips.map((tip) => {
            const sev = SEV[tip.severity];
            return (
              <motion.div
                key={tip.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl border bg-white/5 p-3 ${sev.ring}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${sev.text}`}>{t(lang, sev.k)}</span>
                  <span className="text-[10px] text-white/45">{t(lang, "coach.confidence")} {tip.confidence}%</span>
                </div>
                <p className="text-sm font-semibold leading-snug">{tip.headline}</p>
                <p className="mt-1 text-xs leading-snug text-white/60">{tip.reason}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-neon-ice to-neon-grass"
                    initial={{ width: 0 }}
                    animate={{ width: `${tip.confidence}%` }}
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
