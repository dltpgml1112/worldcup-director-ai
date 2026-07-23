import type { Player, Tactics } from "./types";

/**
 * 결정론적 체력 모델.
 * 뛴 시간 × (역할 강도 × 전술 강도)로 스태미나를 소모한다.
 * 실시간으로 slider(Press/Tempo/High Press)를 올리면 소모율이 즉시 커진다.
 */

const HIGH_DRAIN = new Set(["LW", "RW", "LM", "RM", "LWB", "RWB", "ST", "CM", "AM"]);
const LOW_DRAIN = new Set(["GK", "CB"]);

function roleDrain(role: string): number {
  const r = role.toUpperCase();
  if (r === "GK") return 0.32;
  if (LOW_DRAIN.has(r)) return 0.72;
  if (HIGH_DRAIN.has(r)) return 1.25;
  return 1.0;
}

/** 현재 분 기준 선수 스태미나(0-100). 선발은 onAt=0, 교체 투입은 onAt=투입분. */
export function playerStamina(p: Player, minute: number, tactics: Tactics): number {
  const onAt = p.onAt ?? 0;
  const played = Math.max(0, Math.min(minute, 120) - onAt);
  const intensity =
    0.5 +
    (tactics.press / 100) * 0.35 +
    (tactics.tempo / 100) * 0.3 +
    (tactics.highPress ? 0.12 : 0);
  const drainPerMin = 0.62 * roleDrain(p.role) * intensity;
  return Math.max(0, Math.min(100, 100 - played * drainPerMin));
}

/** 스태미나 구간 → 색/라벨 (UI 공통) */
export function staminaTone(s: number): { color: string; label: string } {
  if (s >= 70) return { color: "#42f59b", label: "Fresh" };
  if (s >= 50) return { color: "#ffd54a", label: "Working" };
  if (s >= 32) return { color: "#ff9f43", label: "Tiring" };
  return { color: "#ff5a6e", label: "Gassed" };
}
