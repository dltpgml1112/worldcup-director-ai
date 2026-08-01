"use client";

import { useGame } from "@/lib/store";
import { CAMPAIGN_ROUNDS } from "@/data/wc2026";

/**
 * 캠페인 진행 브래킷.
 *
 * 한국이 실제로 탈락한 A조 3차전에서 출발해 결승까지. 각 라운드의 상대는 실제 2026
 * 대진표에서 그 자리에 있던 팀이라, 이 줄 자체가 "이겼다면 만났을 길"의 기록이 된다.
 */
export default function CampaignBracket() {
  const lang = useGame((s) => s.lang);
  const roundId = useGame((s) => s.roundId);
  const results = useGame((s) => s.campaignResults);
  const eliminated = useGame((s) => s.eliminated);
  const champion = useGame((s) => s.champion);
  const ko = lang === "ko";

  const steps = CAMPAIGN_ROUNDS.map((r) => ({
    key: r.id,
    label: ko ? r.stageKo : r.stage,
    flag: r.opponent.flag,
    name: ko ? r.opponent.nameKo : r.opponent.name,
  }));

  const currentKey = roundId;

  return (
    <div className="panel rounded-lg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          🏆 {ko ? "다시 쓰는 2026" : "Rewriting 2026"}
        </span>
        {champion && (
          <span className="chip bg-neon-gold/20 text-neon-gold">{ko ? "우승" : "CHAMPIONS"}</span>
        )}
        {eliminated && (
          <span className="chip bg-status-critical/15 text-status-critical">{ko ? "탈락" : "ELIMINATED"}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {steps.map((s) => {
          const done = results.find((r) => r.roundId === s.key);
          const isCurrent = s.key === currentKey && !done;
          const won = done && (done.penalties ? done.penalties[0] > done.penalties[1] : done.outcome === "win");

          return (
            <div
              key={s.key}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                isCurrent
                  ? "border border-team-home/50 bg-team-home/10"
                  : done
                  ? "bg-surface-panel"
                  : "opacity-40"
              }`}
            >
              <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">{s.label}</span>
              <span>{s.flag}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink-secondary">{s.name}</span>
              {done ? (
                <span
                  className={`metric-num font-bold ${won ? "text-status-good" : "text-status-critical"}`}
                >
                  {done.score[0]}–{done.score[1]}
                  {done.penalties ? ` (${done.penalties[0]}-${done.penalties[1]})` : ""}
                </span>
              ) : isCurrent ? (
                <span className="chip bg-team-home/20 text-team-home">{ko ? "지금" : "NOW"}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
