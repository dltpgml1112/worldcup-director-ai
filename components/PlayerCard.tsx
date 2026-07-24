"use client";

import type { Player } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { displayName } from "@/lib/i18n";
import { cardStats, STAT_LABELS, type CardStats } from "@/lib/playerCard";

/** 평점 → 색 (전문 톤: 상태 팔레트 계열) */
function ratingColor(r: number): string {
  if (r >= 85) return "#3987e5"; // team/elite
  if (r >= 80) return "#199e70"; // strong
  if (r >= 75) return "#c98500"; // solid
  return "#9aa4b2"; // squad
}

/**
 * 스카우팅 프로필 카드 (전문 분석 톤).
 * FUT식 광택 카드 대신 다크 서피스 + 지표 바 — 데이터 카드.
 */
export default function PlayerCard({
  player,
  lang,
  flag,
  compact,
}: {
  player: Player;
  lang: Lang;
  flag?: string;
  compact?: boolean;
}) {
  const stats = cardStats(player);
  const name = displayName(lang, player.name, player.nameKo);
  const rc = ratingColor(player.rating);
  const w = compact ? 168 : 208;

  return (
    <div
      className="rounded-lg border border-surface-line bg-surface-panel p-3 shadow-panel"
      style={{ width: w, borderTop: `2px solid ${rc}` }}
    >
      {/* 헤더: 평점 + 이름/포지션 */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md" style={{ background: `${rc}1f` }}>
          <span className="metric-num font-display text-xl font-bold leading-none" style={{ color: rc }}>
            {player.rating}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wide text-ink-muted">OVR</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {flag && <span className="text-sm">{flag}</span>}
            <span className="metric-num rounded bg-surface-line px-1.5 py-0.5 text-[10px] font-bold text-ink-secondary">{player.num}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{player.role}</span>
            {player.legend && <span className="text-xs">⭐</span>}
          </div>
          <div className="mt-0.5 truncate font-display text-base font-bold leading-tight text-ink-primary">{name}</div>
        </div>
      </div>

      {/* 6대 지표 — 미니 바 */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {(Object.keys(stats) as (keyof CardStats)[]).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-[9px] font-bold uppercase text-ink-muted">{STAT_LABELS[k]}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-line">
              <span className="block h-full rounded-full" style={{ width: `${stats[k]}%`, background: ratingColor(stats[k]) }} />
            </span>
            <span className="metric-num w-5 text-right text-[10px] font-bold text-ink-secondary">{stats[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
