"use client";

import type { MatchData } from "@/lib/types";
import { sceneProvenance, sourceBadge } from "@/lib/provenance";
import { useGame } from "@/lib/store";
import { t } from "@/lib/i18n";

/**
 * 장면별 데이터 근거·한계 자막.
 * 현재 경기 장면에서 "무엇이 어떤 데이터로 계산됐고, 무엇이 빠졌는지"를
 * 사용(초록)/제외·한계(주황) 칩으로 함께 보여준다 — 심사자용 데이터 투명성.
 */
export default function DataProvenance({ match, minute }: { match: MatchData; minute: number }) {
  const lang = useGame((s) => s.lang);
  const tactics = useGame((s) => s.tactics);
  const p = sceneProvenance(match, minute, tactics, lang);

  return (
    <div className="panel rounded-lg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          🎬 {t(lang, "prov.title")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="chip bg-surface-line text-ink-secondary">{p.sceneLabel}</span>
          <span className={`chip ${sourceBadge(p.source).cls}`}>
            {t(lang, sourceBadge(p.source).key)}
          </span>
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-wide text-status-good">✓ {t(lang, "prov.used")}</span>
          <span className="flex flex-wrap gap-1">
            {p.used.map((u) => (
              <span key={u} className="rounded bg-status-good/12 px-1.5 py-0.5 text-[10px] text-status-good">{u}</span>
            ))}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-wide text-status-serious">⚠ {t(lang, "prov.excluded")}</span>
          <span className="flex flex-wrap gap-1">
            {p.excluded.map((e) => (
              <span key={e} className="rounded bg-status-serious/12 px-1.5 py-0.5 text-[10px] text-status-serious">{e}</span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
