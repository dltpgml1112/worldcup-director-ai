import type { MatchData, Player, Tactics } from "./types";
import type { MatchSnapshot } from "./matchEngine";
import type { Lang } from "./i18n";
import { displayName } from "./i18n";
import { playerStamina } from "./stamina";

/* ────────────────────────────── 출전 부하 / 체력 ────────────────────────────── */

export const STAMINA_FLOOR = 45; // 이 아래로 떨어지면 경기력 저하 구간

export function minutesPlayed(p: Player, minute: number): number {
  return Math.max(0, Math.min(minute, 120) - (p.onAt ?? 0));
}

/** 현재 전술 강도에서 분당 체력 소모율 (stamina.ts 모델과 동일 계수) */
export function drainRate(p: Player, tactics: Tactics): number {
  const played = 10;
  const s0 = playerStamina({ ...p, onAt: 0 }, 0, tactics);
  const s1 = playerStamina({ ...p, onAt: 0 }, played, tactics);
  return (s0 - s1) / played;
}

/** 특정 분에 예상되는 체력 */
export function projectedStamina(p: Player, atMinute: number, tactics: Tactics): number {
  return playerStamina(p, atMinute, tactics);
}

/**
 * 체력이 임계치 아래로 떨어지는 분 — "이 시점 전에 교체" 근거.
 * 소모율 0이면(사실상 GK) null.
 */
export function staminaCrossMinute(p: Player, tactics: Tactics, floor = STAMINA_FLOOR): number | null {
  const rate = drainRate(p, tactics);
  if (rate <= 0.001) return null;
  const minutesToFloor = (100 - floor) / rate;
  const m = Math.round((p.onAt ?? 0) + minutesToFloor);
  return m > 120 ? null : m;
}

/* ────────────────────────────── 교체 추천 ────────────────────────────── */

export interface SubRecommendation {
  off: Player;
  on: Player | null;
  urgency: "now" | "soon" | "monitor";
  staminaNow: number;
  minutes: number;
  crossAt: number | null;
  gain: number; // 교체 시 즉시 회복되는 체력 포인트
  reason: string;
  score: number; // 정렬용
}

/** 포지션 호환 그룹 — 같은 그룹이면 대체 가능 */
const GROUP: Record<string, string> = {
  GK: "GK",
  CB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF",
  DM: "MID", CM: "MID", AM: "MID", LM: "MID", RM: "MID",
  LW: "ATT", RW: "ATT", ST: "ATT",
};

function group(role: string): string {
  return GROUP[role.toUpperCase()] ?? "MID";
}

/** 벤치에서 최적 대체자 — 포지션 호환 우선, 그 다음 기량 */
export function bestReplacement(off: Player, bench: Player[]): Player | null {
  if (!bench.length) return null;
  const g = group(off.role);
  const ranked = [...bench].sort((a, b) => {
    const ga = group(a.role) === g ? 1 : 0;
    const gb = group(b.role) === g ? 1 : 0;
    if (ga !== gb) return gb - ga;
    return b.rating - a.rating;
  });
  return ranked[0] ?? null;
}

/**
 * 교체 추천 엔진.
 * 체력·출전시간·역할 부하·점수 상황을 종합해 우선순위를 매긴다.
 */
export function subRecommendations(
  players: Player[],
  bench: Player[],
  minute: number,
  tactics: Tactics,
  snap: MatchSnapshot,
  subsUsed: number,
  lang: Lang
): SubRecommendation[] {
  const ko = lang === "ko";
  if (subsUsed >= 5 || minute <= 0) return [];
  const chasing = snap.score[0] < snap.score[1];

  // 1) 우선순위 점수 산출 (대체자 배정 전)
  const ranked = players
    .filter((p) => p.role.toUpperCase() !== "GK")
    .map((p) => {
      const staminaNow = playerStamina(p, minute, tactics);
      const mins = minutesPlayed(p, minute);
      const crossAt = staminaCrossMinute(p, tactics);
      let score = (100 - staminaNow) * 1.4 + mins * 0.35;
      if (crossAt !== null && minute >= crossAt) score += 25;
      if (chasing && group(p.role) === "ATT") score += 8;
      const urgency: SubRecommendation["urgency"] =
        staminaNow < STAMINA_FLOOR - 8 ? "now" : staminaNow < STAMINA_FLOOR + 8 ? "soon" : "monitor";
      return { p, staminaNow, mins, crossAt, score, urgency };
    })
    .sort((a, b) => b.score - a.score);

  const actionable = ranked.filter((r) => r.urgency !== "monitor");
  const shortlist = (actionable.length ? actionable : ranked.slice(0, 1)).slice(0, 3);

  // 2) 대체자 중복 없이 배정 (같은 후보가 여러 카드에 나오지 않도록 풀에서 제거)
  const pool = [...bench];
  const out: SubRecommendation[] = shortlist.map((r) => {
    const cand = bestReplacement(r.p, pool);
    if (cand) pool.splice(pool.findIndex((b) => b.id === cand.id), 1);
    const gain = cand ? Math.round(100 - r.staminaNow) : 0;
    if (cand && cand.rating > r.p.rating) r.score += 6;

    const cn = cand ? displayName(lang, cand.name, cand.nameKo) : null;
    const reason = ko
      ? [
          `${r.mins}분 소화, 체력 ${Math.round(r.staminaNow)}%`,
          r.crossAt !== null
            ? minute >= r.crossAt
              ? `${r.crossAt}분에 이미 ${STAMINA_FLOOR}% 아래로 진입`
              : `${r.crossAt}분에 ${STAMINA_FLOOR}% 도달 예상`
            : null,
          cn ? `${cn} 투입 시 체력 +${gain}p 회복` : "벤치 자원 없음",
          chasing && group(r.p.role) === "ATT" ? "추격 상황 — 전방 활력 필요" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : [
          `${r.mins} min played, ${Math.round(r.staminaNow)}% stamina`,
          r.crossAt !== null
            ? minute >= r.crossAt
              ? `dropped below ${STAMINA_FLOOR}% at ${r.crossAt}'`
              : `hits ${STAMINA_FLOOR}% around ${r.crossAt}'`
            : null,
          cn ? `${cn} restores +${gain}p of freshness` : "no bench option",
          chasing && group(r.p.role) === "ATT" ? "chasing — needs fresh legs up top" : null,
        ]
          .filter(Boolean)
          .join(" · ");

    return { off: r.p, on: cand, urgency: r.urgency, staminaNow: r.staminaNow, minutes: r.mins, crossAt: r.crossAt, gain, reason, score: r.score };
  });

  return out;
}

/* ────────────────────────────── 팀 비교 ────────────────────────────── */

export interface CompareRow {
  key: string;
  label: string;
  home: number;
  away: number;
  fmt: (n: number) => string;
}

/** 우리 팀 vs 상대 핵심 지표 비교 */
export function teamComparison(
  match: MatchData,
  snap: MatchSnapshot,
  minute: number,
  lang: Lang
): CompareRow[] {
  const ko = lang === "ko";
  const upTo = match.timeline.filter((e) => e.minute <= minute);
  const chances = (side: "home" | "away") =>
    upTo.filter((e) => e.side === side && (e.type === "chance" || e.type === "shot" || e.type === "goal")).length;

  const int1 = (n: number) => String(Math.round(n));
  const pct = (n: number) => `${Math.round(n)}%`;
  const dec2 = (n: number) => n.toFixed(2);

  const hShots = snap.shots[0] + snap.score[0];
  const aShots = snap.shots[1] + snap.score[1];

  return [
    { key: "poss", label: ko ? "점유율" : "Possession", home: snap.possession[0], away: snap.possession[1], fmt: pct },
    { key: "xg", label: ko ? "기대득점 xG" : "Expected goals", home: snap.xg[0], away: snap.xg[1], fmt: dec2 },
    { key: "shots", label: ko ? "슈팅" : "Shots", home: hShots, away: aShots, fmt: int1 },
    { key: "chances", label: ko ? "기회 생성" : "Chances created", home: chances("home"), away: chances("away"), fmt: int1 },
    { key: "corners", label: ko ? "코너킥" : "Corners", home: snap.corners[0], away: snap.corners[1], fmt: int1 },
    {
      key: "xgps",
      label: ko ? "슈팅당 xG" : "xG per shot",
      home: hShots ? snap.xg[0] / hShots : 0,
      away: aShots ? snap.xg[1] / aShots : 0,
      fmt: dec2,
    },
  ];
}

/** 스쿼드 부하 요약 — 평균 출전시간 / 평균 체력 / 위험 인원 */
export function squadLoad(players: Player[], minute: number, tactics: Tactics) {
  const outfield = players.filter((p) => p.role.toUpperCase() !== "GK");
  if (!outfield.length) return { avgMinutes: 0, avgStamina: 100, atRisk: 0 };
  const mins = outfield.map((p) => minutesPlayed(p, minute));
  const stam = outfield.map((p) => playerStamina(p, minute, tactics));
  return {
    avgMinutes: Math.round(mins.reduce((a, b) => a + b, 0) / outfield.length),
    avgStamina: Math.round(stam.reduce((a, b) => a + b, 0) / outfield.length),
    atRisk: stam.filter((s) => s < STAMINA_FLOOR).length,
  };
}
