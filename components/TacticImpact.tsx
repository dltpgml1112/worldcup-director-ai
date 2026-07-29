"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt, simulateAlternate } from "@/lib/matchEngine";
import { t } from "@/lib/i18n";

/**
 * 전술 조정의 효과를 즉시 보여준다.
 *
 * 받은 피드백 중 "전술판이 다시보기 느낌"이 가장 뼈아팠다. 실제로는 슬라이더를
 * 움직이면 승리 확률과 예상 스코어가 즉시 바뀌는데, 그 변화가 화면 어디에도
 * 드러나지 않아 '내 조작이 아무것도 안 바꾼다'고 느껴졌다.
 *
 * 기준선(baseline)은 조정을 시작한 시점의 값으로 잡고, 조정이 멈추면 사라진다.
 * 그래서 슬라이더를 계속 끄는 동안 **누적 효과**가 보인다.
 */
const HOLD_MS = 3200;

export default function TacticImpact() {
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const formation = useGame((s) => s.formation);
  const minute = useGame((s) => s.minute);
  const lang = useGame((s) => s.lang);
  const match = getMatch(matchId);

  const [view, setView] = useState<{
    from: number;
    to: number;
    score: [number, number];
  } | null>(null);

  const baseline = useRef<{ win: number; score: [number, number] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!match) return;

    const win = snapshotAt(match, minute, tactics).homeWinProb;
    const alt = simulateAlternate(match, tactics);

    // 최초 마운트는 '조정'이 아니다 — 기준선만 잡고 표시하지 않는다
    if (first.current) {
      first.current = false;
      baseline.current = { win, score: alt.score };
      return;
    }

    if (!baseline.current) baseline.current = { win, score: alt.score };
    setView({ from: baseline.current.win, to: win, score: alt.score });

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setView(null);
      baseline.current = null;
    }, HOLD_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // minute 변화(경기 진행)로는 뜨지 않게 — 전술/포메이션 변경에만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tactics, formation, match]);

  const delta = view ? view.to - view.from : 0;
  const up = delta > 0;
  const color = delta === 0 ? "#9aa4b2" : up ? "#0ca30c" : "#d03b3b";

  return (
    <AnimatePresence>
      {view && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="mb-2 rounded-md border bg-surface-raised px-3 py-2"
          style={{ borderColor: `${color}55` }}
        >
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
            {t(lang, "impact.title")}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-secondary">{t(lang, "impact.winprob")}</span>
            <span className="metric-num text-sm font-bold text-ink-muted">{view.from}%</span>
            <span className="text-ink-muted">→</span>
            <span className="metric-num font-display text-lg font-bold" style={{ color }}>
              {view.to}%
            </span>
            <span
              className="metric-num ml-auto rounded px-1.5 py-0.5 text-[11px] font-bold"
              style={{ background: `${color}22`, color }}
            >
              {delta === 0 ? "±0" : `${up ? "+" : ""}${delta}`}%p
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 border-t border-surface-line pt-1">
            <span className="text-[11px] text-ink-secondary">{t(lang, "impact.projected")}</span>
            <span className="metric-num font-display text-sm font-bold text-team-home">
              {view.score[0]}–{view.score[1]}
            </span>
            <span className="ml-auto text-[9px] text-ink-muted">{t(lang, "impact.note")}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
