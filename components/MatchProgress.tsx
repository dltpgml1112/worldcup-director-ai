"use client";

import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { t } from "@/lib/i18n";

/**
 * 경기 진행 표시.
 *
 * 피드백: "게임 진행이 어디까지인지 모르겠다".
 * 분 숫자만으로는 전반인지 후반인지, 얼마나 남았는지 감이 오지 않는다.
 * 전·후반을 나눈 막대와 주요 이벤트 위치를 함께 보여준다.
 */
export default function MatchProgress() {
  const matchId = useGame((s) => s.matchId);
  const minute = useGame((s) => s.minute);
  const lang = useGame((s) => s.lang);
  const match = getMatch(matchId);
  if (!match) return null;

  const end = match.timeline[match.timeline.length - 1]?.minute ?? 90;
  const pct = Math.min(100, (minute / end) * 100);
  const half = minute === 0 ? 0 : minute <= 45 ? 1 : 2;

  // 전반/후반 경계 위치
  const htPct = (45 / end) * 100;

  const phase =
    minute === 0
      ? t(lang, "prog.kickoff")
      : minute >= end
        ? t(lang, "score.ft")
        : half === 1
          ? t(lang, "prog.first")
          : t(lang, "prog.second");

  return (
    <div className="rounded-md border border-surface-line bg-surface-panel px-3 py-2" data-tour="progress">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`chip ${
            minute >= end
              ? "bg-status-critical/20 text-status-critical"
              : "bg-team-home/20 text-team-home"
          }`}
        >
          {phase}
        </span>
        <span className="metric-num font-display text-lg font-bold leading-none text-ink-primary">
          {Math.min(minute, end)}&apos;
        </span>
        <span className="ml-auto text-[10px] text-ink-muted">
          {minute >= end
            ? t(lang, "prog.done")
            : `${t(lang, "prog.left")} ${Math.max(0, end - minute)}′`}
        </span>
      </div>

      {/* 진행 막대 — 전·후반이 나뉘고, 이벤트가 어디서 일어났는지 점으로 표시 */}
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-team-home transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
        {/* 하프타임 경계 */}
        <span
          className="absolute top-0 h-full w-px bg-ink-muted/60"
          style={{ left: `${htPct}%` }}
        />
        {/* 골·카드 위치 */}
        {match.timeline
          .filter((e) => e.type === "goal" || e.type === "card")
          .map((e, i) => (
            <span
              key={i}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-surface-base"
              style={{
                left: `${(e.minute / end) * 100}%`,
                background:
                  e.type === "goal"
                    ? e.side === "home"
                      ? match.home.primary
                      : match.away.primary
                    : e.card === "red"
                      ? "#d03b3b"
                      : "#fab219",
              }}
              title={`${e.minute}′ ${e.type === "goal" ? "GOAL" : "CARD"}`}
            />
          ))}
      </div>

      <div className="mt-1 flex justify-between text-[9px] text-ink-muted">
        <span>0′</span>
        <span>{t(lang, "prog.ht")} 45′</span>
        <span>{end}′</span>
      </div>
    </div>
  );
}
