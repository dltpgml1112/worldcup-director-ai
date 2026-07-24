"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MatchData, FormationKey, Tactics } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";
import { coachTips } from "@/lib/aiCoach";
import { useGame } from "@/lib/store";
import { t } from "@/lib/i18n";

const SEV: Record<string, { color: string; k: string }> = {
  opportunity: { color: "#199e70", k: "sev.opportunity" }, // aqua (good/opportunity)
  warning: { color: "#fab219", k: "sev.warning" }, // status.warning
  info: { color: "#3987e5", k: "sev.info" }, // team.home blue
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
  const applyAdvice = useGame((s) => s.applyAdvice);
  const tips = coachTips(match, snap, tactics, formation, players, subsUsed, lang);
  return (
    <div className="panel-raised rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-series-3/15 text-xs">🧠</span>
        <div>
          <div className="font-display text-sm font-bold uppercase tracking-wide text-ink-primary">{t(lang, "coach.title")}</div>
          <div className="text-[10px] text-ink-muted">{t(lang, "coach.subtitle")}</div>
        </div>
        <span className="ml-auto chip bg-series-3/15 text-series-3">
          <span className="h-1.5 w-1.5 rounded-full bg-series-3 animate-pulseGlow" /> {t(lang, "coach.analyzing")}
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
                className="rounded-md border border-surface-line bg-surface-panel p-3"
                style={{ borderLeft: `2px solid ${sev.color}` }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: sev.color }}>{t(lang, sev.k)}</span>
                  <span className="text-[10px] text-ink-muted">{t(lang, "coach.confidence")} {tip.confidence}%</span>
                </div>
                <p className="text-sm font-semibold leading-snug text-ink-primary">{tip.headline}</p>
                <p className="mt-1 text-xs leading-snug text-ink-secondary">{tip.reason}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-line">
                  <motion.div
                    className="h-full bg-team-home"
                    initial={{ width: 0 }}
                    animate={{ width: `${tip.confidence}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
                {tip.apply && (
                  <button
                    onClick={() => applyAdvice(tip.apply!)}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-team-home/40 bg-team-home/10 py-1.5 text-xs font-bold text-team-home transition hover:bg-team-home/20"
                  >
                    ⚡ {t(lang, "coach.apply")}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
