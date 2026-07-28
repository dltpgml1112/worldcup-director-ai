"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt } from "@/lib/matchEngine";
import { pitchFrame } from "@/lib/pitchPositions";
import { liveInsight, SEVERITY_COLOR, type LiveInsight } from "@/lib/liveInsights";
import { t } from "@/lib/i18n";

/** 한 인사이트를 유지하는 경기 시간(분) — 너무 짧으면 읽기 전에 사라진다 */
const HOLD_MINUTES = 6;

/**
 * 피치 위에 뜨는 실시간 전술 피드백.
 *
 * 사이드 대시보드와 역할이 다르다: 지금 결정이 필요한 항목 하나만,
 * 근거 수치와 원클릭 조치를 붙여 방송 로어서드처럼 올린다.
 * 같은 인사이트가 반복 점멸하지 않도록 표시 후 HOLD_MINUTES 동안 유지한다.
 */
export default function LiveInsightOverlay() {
  const matchId = useGame((s) => s.matchId);
  const players = useGame((s) => s.players);
  const tactics = useGame((s) => s.tactics);
  const formation = useGame((s) => s.formation);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const subsUsed = useGame((s) => s.subsUsed);
  const lang = useGame((s) => s.lang);
  const applyAdvice = useGame((s) => s.applyAdvice);

  const [shown, setShown] = useState<LiveInsight | null>(null);
  const [applied, setApplied] = useState(false);
  const shownAt = useRef(-99);
  const dismissed = useRef<Set<string>>(new Set());

  const match = getMatch(matchId);

  useEffect(() => {
    if (!match) return;
    if (minute === 0) {
      // 경기 리셋 — 전부 초기화
      setShown(null);
      dismissed.current.clear();
      shownAt.current = -99;
      return;
    }

    const snap = snapshotAt(match, minute, tactics);
    const frame = pitchFrame({ match, players, tactics, minute, playing });
    const next = liveInsight({
      match, snap, frame, tactics, formation, players, minute, subsUsed, lang,
    });

    const held = minute - shownAt.current < HOLD_MINUTES;

    // 유지 시간이 지났고 새 인사이트가 없으면 내린다
    if (!next) {
      if (!held) setShown(null);
      return;
    }
    if (dismissed.current.has(next.id)) return;

    // 더 급한 게 오면 유지 시간을 무시하고 교체한다
    const moreUrgent = shown ? next.rank < shown.rank : true;
    if (!held || moreUrgent) {
      if (shown?.id !== next.id) {
        setShown(next);
        setApplied(false);
        shownAt.current = minute;
      }
    }
    // shown은 의도적으로 의존성에서 제외 — 표시 상태가 재평가를 다시 트리거하면 루프가 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, minute, playing, tactics, formation, players, subsUsed, lang]);

  const close = () => {
    if (shown) dismissed.current.add(shown.id);
    setShown(null);
  };

  const apply = () => {
    if (!shown?.apply) return;
    applyAdvice(shown.apply);
    setApplied(true);
    setTimeout(close, 900);
  };

  const color = shown ? SEVERITY_COLOR[shown.severity] : "#3987e5";

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="pointer-events-auto absolute inset-x-2 bottom-2 z-20"
        >
          <div
            className="rounded-lg border border-surface-line bg-surface-raised/95 p-2.5 shadow-xl backdrop-blur"
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <div className="mb-1 flex items-start gap-2">
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: `${color}22`, color }}
              >
                ● {t(lang, `insight.${shown.severity}`)}
              </span>
              <span className="metric-num shrink-0 rounded bg-surface-panel px-1.5 py-0.5 text-[10px] font-bold text-ink-secondary">
                {minute}&apos;
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-ink-primary">
                {shown.title}
              </span>
              <button
                onClick={close}
                aria-label={t(lang, "insight.dismiss")}
                className="shrink-0 rounded px-1 text-ink-muted transition hover:text-ink-primary"
              >
                ✕
              </button>
            </div>

            <p className="mb-2 text-[11px] leading-snug text-ink-secondary">{shown.detail}</p>

            <div className="flex items-center gap-2">
              {/* 근거 수치 — 주장만 하지 않는다 */}
              <span className="rounded border border-surface-line bg-surface-panel px-2 py-1 text-[10px] text-ink-muted">
                {shown.metric.label}{" "}
                <span className="metric-num font-bold" style={{ color }}>
                  {shown.metric.value}
                </span>
              </span>
              {shown.apply && (
                <button
                  onClick={apply}
                  disabled={applied}
                  className="ml-auto rounded-md border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60"
                  style={{ borderColor: `${color}66`, background: `${color}18`, color }}
                >
                  {applied ? t(lang, "insight.applied") : t(lang, "insight.apply")}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
