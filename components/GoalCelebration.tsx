"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MatchEvent } from "@/lib/types";
import type { Lang } from "@/lib/i18n";

/**
 * 방송 그래픽 스타일 골 알림 (로어서드).
 * 아케이드 연출 대신 중계 하단 배너처럼 절제된 형태 — 전략 도구 톤 유지.
 */
export default function GoalCelebration({
  goal,
  minute,
  lang,
  accent = "#3987e5",
}: {
  goal: MatchEvent | undefined;
  minute: number;
  lang: Lang;
  accent?: string;
}) {
  return (
    <AnimatePresence>
      {goal && (
        <motion.div
          key={`goal-${minute}`}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4"
        >
          <div
            className="flex items-stretch overflow-hidden rounded-lg border border-surface-line bg-surface-raised/95 shadow-xl backdrop-blur"
            style={{ borderLeft: `4px solid ${accent}` }}
          >
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="font-display text-2xl font-bold uppercase tracking-wide" style={{ color: accent }}>
                {lang === "ko" ? "골" : "GOAL"}
              </span>
              <span className="metric-num rounded bg-surface-panel px-2 py-0.5 font-display text-sm font-bold text-ink-secondary">
                {Math.min(minute, 120)}'
              </span>
              <div className="min-w-0">
                {goal.player && <div className="font-display text-lg font-bold leading-tight text-ink-primary">{goal.player}</div>}
                <div className="max-w-md truncate text-xs text-ink-secondary">
                  {lang === "ko" && goal.detailKo ? goal.detailKo : goal.detail}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
