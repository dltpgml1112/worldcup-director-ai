"use client";

import type { MatchData } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";
import { teamComparison } from "@/lib/analytics";
import { useGame } from "@/lib/store";
import { t } from "@/lib/i18n";

const HOME = "#3987e5"; // series-1
const AWAY = "#d95926"; // series-2

/**
 * 우리 팀 vs 상대 핵심 지표 비교.
 * 각 행은 두 값의 상대 비율로 좌우 분할 — 한 축, 색은 팀(주체)에 고정.
 */
export default function TeamComparison({ match, snap, minute }: { match: MatchData; snap: MatchSnapshot; minute: number }) {
  const lang = useGame((s) => s.lang);
  const rows = teamComparison(match, snap, minute, lang);
  const homeName = lang === "ko" ? match.home.nameKo : match.home.name;
  const awayName = lang === "ko" ? match.away.nameKo : match.away.name;

  return (
    <div className="panel rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">{t(lang, "cmp.title")}</span>
        {/* 범례 — 2개 시리즈이므로 항상 표시 */}
        <div className="flex items-center gap-3 text-[10px] text-ink-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: HOME }} />
            {homeName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: AWAY }} />
            {awayName}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const total = r.home + r.away;
          const hp = total > 0 ? (r.home / total) * 100 : 50;
          const leading = r.home === r.away ? null : r.home > r.away ? "home" : "away";
          return (
            <div key={r.key}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span
                  className="metric-num font-semibold"
                  style={{ color: leading === "home" ? HOME : "#e8ecf1" }}
                  title={`${homeName} ${r.fmt(r.home)}`}
                >
                  {r.fmt(r.home)}
                </span>
                <span className="text-[11px] text-ink-secondary">{r.label}</span>
                <span
                  className="metric-num font-semibold"
                  style={{ color: leading === "away" ? AWAY : "#e8ecf1" }}
                  title={`${awayName} ${r.fmt(r.away)}`}
                >
                  {r.fmt(r.away)}
                </span>
              </div>
              {/* 두 채움 사이 2px 표면 간격 */}
              <div className="flex h-1.5 overflow-hidden rounded-sm bg-surface-line">
                <div style={{ width: `${hp}%`, background: HOME }} />
                <div className="w-0.5 shrink-0 bg-surface-panel" />
                <div style={{ width: `${100 - hp}%`, background: AWAY }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
