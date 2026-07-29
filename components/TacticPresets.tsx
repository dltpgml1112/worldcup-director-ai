"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt } from "@/lib/matchEngine";
import { PRESETS, closestPreset, presetCost, presetDesc, presetName, type Preset } from "@/lib/presets";
import { t } from "@/lib/i18n";
import type { Tactics } from "@/lib/types";

/**
 * 전술 프리셋 — 이름 있는 전술을 한 번에 적용한다.
 *
 * 각 카드에 **적용 시 예상 승리 확률**을 미리 계산해 보여준다.
 * 슬라이더를 이것저것 만져보지 않아도 "이 전술이 지금 상황에 맞는가"를 바로 판단할 수 있다.
 * 트레이드오프(내주는 것)도 같이 표시한다 — 공짜 전술은 없다.
 */
export default function TacticPresets() {
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const formation = useGame((s) => s.formation);
  const minute = useGame((s) => s.minute);
  const lang = useGame((s) => s.lang);
  const applyAdvice = useGame((s) => s.applyAdvice);
  const match = getMatch(matchId);

  const [open, setOpen] = useState<string | null>(null);

  const current = useMemo(() => closestPreset(tactics, formation), [tactics, formation]);
  const nowWin = useMemo(
    () => (match ? snapshotAt(match, minute, tactics).homeWinProb : 0),
    [match, minute, tactics]
  );

  // 각 프리셋을 적용했을 때의 승리 확률 (결정론적이라 미리보기가 정확하다)
  const projected = useMemo(() => {
    const out = new Map<string, number>();
    if (!match) return out;
    for (const p of PRESETS) {
      const merged: Tactics = { ...tactics, ...p.tactics };
      out.set(p.id, snapshotAt(match, minute, merged).homeWinProb);
    }
    return out;
  }, [match, minute, tactics]);

  const apply = (p: Preset) => {
    applyAdvice({ formation: p.formation, tactics: p.tactics });
    setOpen(null);
  };

  return (
    <div className="panel rounded-lg p-3" data-tour="presets">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          {t(lang, "preset.title")}
        </span>
        {current && (
          <span className="chip bg-surface-panel text-[9px] text-ink-muted">
            {current.exact ? t(lang, "preset.active") : t(lang, "preset.closest")}:{" "}
            <span className="text-ink-secondary">{presetName(current.preset, lang)}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {PRESETS.map((p) => {
          const win = projected.get(p.id) ?? 0;
          const delta = win - nowWin;
          const active = current?.exact && current.preset.id === p.id;
          const tone = delta > 0 ? "#0ca30c" : delta < 0 ? "#d03b3b" : "#6b7686";
          return (
            <button
              key={p.id}
              onClick={() => setOpen(open === p.id ? null : p.id)}
              className={`rounded-md border px-1.5 py-1.5 text-left transition ${
                active
                  ? "border-team-home bg-team-home/12"
                  : open === p.id
                    ? "border-team-home/60 bg-surface-hover"
                    : "border-surface-line bg-surface-panel hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="text-[11px]">{p.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-ink-primary">
                  {presetName(p, lang)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="metric-num text-[11px] font-bold text-ink-secondary">{win}%</span>
                <span className="metric-num text-[9px] font-bold" style={{ color: tone }}>
                  {delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${delta}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 선택한 프리셋의 설명 + 트레이드오프 */}
      {open && (
        <div className="mt-2 rounded-md border border-surface-line bg-surface-panel p-2.5">
          {(() => {
            const p = PRESETS.find((x) => x.id === open)!;
            return (
              <>
                <div className="mb-1 flex items-center gap-1.5">
                  <span>{p.icon}</span>
                  <span className="text-xs font-bold text-ink-primary">{presetName(p, lang)}</span>
                  <span className="chip bg-surface-raised text-[9px] text-ink-muted">{p.formation}</span>
                </div>
                <p className="mb-1.5 text-[11px] leading-snug text-ink-secondary">{presetDesc(p, lang)}</p>
                <p className="mb-2 flex gap-1 text-[10px] leading-snug text-status-warning">
                  <span className="shrink-0">⚠</span>
                  <span>{presetCost(p, lang)}</span>
                </p>
                <button
                  onClick={() => apply(p)}
                  className="w-full rounded-md border border-team-home bg-team-home py-1.5 text-[11px] font-bold text-white transition hover:bg-team-home/85"
                >
                  {t(lang, "preset.apply")}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
