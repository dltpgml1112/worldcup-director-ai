"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { postGoalAdvice } from "@/lib/liveInsights";
import type { MatchSnapshot } from "@/lib/matchEngine";
import type { MatchData, MatchEvent } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";

/**
 * 골 모먼트 — 방송 그래픽 + 다음 전술 제안을 한 화면에.
 *
 * 골이 들어간 직후는 감독이 가장 크게 흔들리는 순간이다. 세리머니가 도는 몇 초를
 * 그냥 흘려보내지 않고 "그래서 지금 뭘 바꿔야 하는가"를 원클릭으로 붙인다.
 * 3D 카메라 연출(Pitch3D)과 같은 타이밍에 돌아간다.
 */
export default function GoalMoment({
  goal,
  match,
  snap,
  minute,
  lang,
}: {
  goal: MatchEvent | undefined;
  match: MatchData;
  snap: MatchSnapshot;
  minute: number;
  lang: Lang;
}) {
  const tactics = useGame((s) => s.tactics);
  const applyAdvice = useGame((s) => s.applyAdvice);
  const [applied, setApplied] = useState(false);

  const scoredBy = goal?.side ?? "home";
  const us = scoredBy === "home";
  const accent = us ? match.home.primary : match.away.primary;
  const team = us ? match.home : match.away;
  const [hs, as] = snap.score;

  const advice = goal
    ? postGoalAdvice({ snap, tactics, scoredBy, minute, lang })
    : null;

  return (
    <AnimatePresence
      onExitComplete={() => setApplied(false)}
    >
      {goal && advice && (
        <motion.div
          key={`goal-${minute}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-end gap-3 px-4 pb-10"
        >
          {/* 화면 가장자리 색 번짐 — 골 순간의 임팩트 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.15] }}
            transition={{ duration: 1.2, times: [0, 0.15, 1] }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, transparent 45%, ${accent}55 100%)`,
            }}
          />

          {/* GOAL 방송 그래픽 */}
          <motion.div
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            className="relative flex items-stretch overflow-hidden rounded-lg border border-surface-line bg-surface-raised/96 shadow-2xl backdrop-blur"
            style={{ borderLeft: `5px solid ${accent}` }}
          >
            {/* 스윕 하이라이트 */}
            <motion.div
              initial={{ x: "-120%" }}
              animate={{ x: "180%" }}
              transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
              className="pointer-events-none absolute inset-y-0 w-1/3"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}33, transparent)` }}
            />
            <div className="flex items-center gap-4 px-6 py-4">
              <motion.span
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="font-display text-4xl font-bold uppercase tracking-wide"
                style={{ color: accent }}
              >
                {t(lang, "feed.goal")}
              </motion.span>
              <span className="metric-num rounded bg-surface-panel px-2 py-0.5 font-display text-sm font-bold text-ink-secondary">
                {Math.min(minute, 120)}&apos;
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">
                  {team.flag} {lang === "ko" ? team.nameKo : team.name}
                </div>
                {goal.player && (
                  <div className="font-display text-xl font-bold leading-tight text-ink-primary">
                    {goal.player}
                  </div>
                )}
                <div className="max-w-md truncate text-xs text-ink-secondary">
                  {lang === "ko" && goal.detailKo ? goal.detailKo : goal.detail}
                </div>
              </div>
              {/* 스코어 */}
              <div className="ml-2 flex items-center gap-2 rounded-md bg-surface-panel px-3 py-2">
                <span className="text-[10px] font-bold text-ink-muted">{match.home.code}</span>
                <span className="metric-num font-display text-2xl font-bold text-ink-primary">
                  {hs}–{as}
                </span>
                <span className="text-[10px] font-bold text-ink-muted">{match.away.code}</span>
              </div>
            </div>
          </motion.div>

          {/* 다음 전술 — 세리머니 도는 동안 결정하게 한다 */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, type: "spring", stiffness: 260, damping: 26 }}
            className="pointer-events-auto w-full max-w-2xl rounded-lg border border-surface-line bg-surface-raised/96 p-3 shadow-2xl backdrop-blur"
            style={{ borderLeft: `3px solid ${us ? "#0ca30c" : "#d03b3b"}` }}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{
                  background: us ? "#0ca30c22" : "#d03b3b22",
                  color: us ? "#0ca30c" : "#d03b3b",
                }}
              >
                ▶ {t(lang, "goal.next")}
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-ink-primary">
                {advice.title}
              </span>
            </div>
            <p className="mb-2 text-[11px] leading-snug text-ink-secondary">{advice.detail}</p>
            <div className="flex items-center gap-2">
              <span className="rounded border border-surface-line bg-surface-panel px-2 py-1 text-[10px] text-ink-muted">
                {advice.metric.label}{" "}
                <span className="metric-num font-bold text-ink-primary">{advice.metric.value}</span>
              </span>
              <button
                onClick={() => {
                  applyAdvice(advice.apply);
                  setApplied(true);
                }}
                disabled={applied}
                className="ml-auto rounded-md border border-team-home/50 bg-team-home/15 px-3 py-1.5 text-[11px] font-semibold text-team-home transition hover:bg-team-home/25 disabled:opacity-60"
              >
                {applied ? t(lang, "insight.applied") : t(lang, "goal.applyNext")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
