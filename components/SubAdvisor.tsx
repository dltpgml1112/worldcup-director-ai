"use client";

import { useMemo } from "react";
import type { MatchData } from "@/lib/types";
import type { MatchSnapshot } from "@/lib/matchEngine";
import { subRecommendations, squadLoad, STAMINA_FLOOR } from "@/lib/analytics";
import { useGame } from "@/lib/store";
import { t, displayName } from "@/lib/i18n";

const URGENCY: Record<string, { color: string; k: string }> = {
  now: { color: "#d03b3b", k: "adv.now" }, // status.critical
  soon: { color: "#fab219", k: "adv.soon" }, // status.warning
  monitor: { color: "#6b7686", k: "adv.monitor" }, // muted
};

function staminaColor(s: number): string {
  if (s >= 70) return "#0ca30c";
  if (s >= STAMINA_FLOOR) return "#fab219";
  return "#d03b3b";
}

/**
 * 교체 추천 + 스쿼드 부하.
 * 실제 코칭 스태프가 쓰는 로드 매니지먼트처럼 — 체력/출전시간/임계 도달 시점을
 * 근거로 "누구를 언제, 누구로" 교체할지 제안한다.
 */
export default function SubAdvisor({ match, snap, minute }: { match: MatchData; snap: MatchSnapshot; minute: number }) {
  const players = useGame((s) => s.players);
  const bench = useGame((s) => s.bench);
  const tactics = useGame((s) => s.tactics);
  const subsUsed = useGame((s) => s.subsUsed);
  const makeSub = useGame((s) => s.makeSub);
  const lang = useGame((s) => s.lang);
  const legendMode = useGame((s) => s.legendMode);

  // 추천도 현재 투입 가능한 선수만 대상으로 한다 (레전드 OFF면 가상 편성 제외)
  const availableBench = useMemo(
    () => bench.filter((b) => legendMode || !b.legend),
    [bench, legendMode]
  );

  const load = squadLoad(players, minute, tactics);
  const recs = subRecommendations(players, availableBench, minute, tactics, snap, subsUsed, lang);
  const exhausted = subsUsed >= 5;

  return (
    <div className="panel-raised rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-team-home/15 text-xs">📋</span>
        <div>
          <div className="font-display text-sm font-bold uppercase tracking-wide text-ink-primary">{t(lang, "adv.title")}</div>
          <div className="text-[10px] text-ink-muted">{t(lang, "adv.sub")}</div>
        </div>
        <span className="ml-auto chip bg-surface-line text-ink-secondary">{subsUsed}/5</span>
      </div>

      {/* 스쿼드 부하 요약 (스탯 타일 3개) */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <LoadTile label={t(lang, "load.avgMin")} value={`${load.avgMinutes}`} unit={t(lang, "load.min")} />
        <LoadTile label={t(lang, "load.avgStam")} value={`${load.avgStamina}`} unit="%" color={staminaColor(load.avgStamina)} />
        <LoadTile
          label={t(lang, "load.atRisk")}
          value={`${load.atRisk}`}
          unit={t(lang, "load.people")}
          color={load.atRisk > 0 ? "#d03b3b" : "#0ca30c"}
        />
      </div>

      {/* 추천 목록 */}
      {exhausted ? (
        <div className="rounded-md border border-surface-line bg-surface-panel px-3 py-2 text-center text-xs text-ink-muted">
          {t(lang, "adv.exhausted")}
        </div>
      ) : recs.length === 0 ? (
        <div className="rounded-md border border-surface-line bg-surface-panel px-3 py-2 text-center text-xs text-ink-muted">
          ✓ {t(lang, "adv.none")}
        </div>
      ) : (
        <div className="space-y-2">
          {recs.map((r) => {
            const u = URGENCY[r.urgency];
            const offNm = displayName(lang, r.off.name, r.off.nameKo);
            const onNm = r.on ? displayName(lang, r.on.name, r.on.nameKo) : null;
            return (
              <div key={r.off.id} className="rounded-md border border-surface-line bg-surface-panel p-2.5" style={{ borderLeft: `2px solid ${u.color}` }}>
                <div className="mb-1 flex items-center gap-2">
                  {/* 상태 배지 — 색+라벨(색 단독 아님) */}
                  <span className="chip" style={{ background: `${u.color}22`, color: u.color }}>
                    ● {t(lang, u.k)}
                  </span>
                  <span className="text-sm font-semibold text-ink-primary">{offNm}</span>
                  {onNm && (
                    <span className="text-xs text-ink-secondary">
                      {lang === "ko" ? `→ ${onNm}` : `${t(lang, "adv.replace")} ${onNm}`}
                    </span>
                  )}
                  <span className="metric-num ml-auto text-xs font-bold" style={{ color: staminaColor(r.staminaNow) }}>
                    {Math.round(r.staminaNow)}%
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-ink-secondary">{r.reason}</p>
                {r.on && (
                  <button
                    onClick={() => makeSub(r.off.id, r.on!.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-team-home/40 bg-team-home/10 py-1.5 text-xs font-semibold text-team-home transition hover:bg-team-home/20"
                  >
                    {t(lang, "adv.apply")}
                    <span className="text-status-critical">{offNm} OUT</span>
                    <span className="text-ink-muted">➔</span>
                    <span className="text-status-good">{onNm} IN</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoadTile({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-panel px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="metric-num font-display text-lg font-bold leading-none" style={{ color: color ?? "#e8ecf1" }}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-semibold text-ink-secondary">{unit}</span>}
      </div>
    </div>
  );
}
