import type { FormationKey } from "./types";

export interface Slot {
  role: string;
  x: number; // 0-100 width
  y: number; // 0-100 (own goal 0 -> attack 100)
}

/** 각 포메이션의 11개 슬롯 좌표 (홈팀이 위쪽으로 공격하는 기준) */
export const FORMATIONS: Record<FormationKey, Slot[]> = {
  "433": [
    { role: "GK", x: 50, y: 7 },
    { role: "LB", x: 16, y: 26 },
    { role: "CB", x: 38, y: 21 },
    { role: "CB", x: 62, y: 21 },
    { role: "RB", x: 84, y: 26 },
    { role: "CM", x: 34, y: 49 },
    { role: "CM", x: 50, y: 44 },
    { role: "CM", x: 66, y: 49 },
    { role: "LW", x: 19, y: 77 },
    { role: "ST", x: 50, y: 83 },
    { role: "RW", x: 81, y: 77 },
  ],
  "4231": [
    { role: "GK", x: 50, y: 7 },
    { role: "LB", x: 16, y: 26 },
    { role: "CB", x: 40, y: 21 },
    { role: "CB", x: 60, y: 21 },
    { role: "RB", x: 84, y: 26 },
    { role: "DM", x: 38, y: 42 },
    { role: "DM", x: 62, y: 42 },
    { role: "AM", x: 20, y: 65 },
    { role: "AM", x: 50, y: 61 },
    { role: "AM", x: 80, y: 65 },
    { role: "ST", x: 50, y: 84 },
  ],
  "352": [
    { role: "GK", x: 50, y: 7 },
    { role: "CB", x: 30, y: 21 },
    { role: "CB", x: 50, y: 19 },
    { role: "CB", x: 70, y: 21 },
    { role: "LWB", x: 12, y: 48 },
    { role: "CM", x: 36, y: 47 },
    { role: "CM", x: 50, y: 43 },
    { role: "CM", x: 64, y: 47 },
    { role: "RWB", x: 88, y: 48 },
    { role: "ST", x: 39, y: 80 },
    { role: "ST", x: 61, y: 80 },
  ],
  "343": [
    { role: "GK", x: 50, y: 7 },
    { role: "CB", x: 30, y: 21 },
    { role: "CB", x: 50, y: 19 },
    { role: "CB", x: 70, y: 21 },
    { role: "LM", x: 14, y: 50 },
    { role: "CM", x: 40, y: 47 },
    { role: "CM", x: 60, y: 47 },
    { role: "RM", x: 86, y: 50 },
    { role: "LW", x: 22, y: 79 },
    { role: "ST", x: 50, y: 83 },
    { role: "RW", x: 78, y: 79 },
  ],
  "541": [
    { role: "GK", x: 50, y: 7 },
    { role: "LWB", x: 12, y: 30 },
    { role: "CB", x: 32, y: 20 },
    { role: "CB", x: 50, y: 18 },
    { role: "CB", x: 68, y: 20 },
    { role: "RWB", x: 88, y: 30 },
    { role: "LM", x: 25, y: 52 },
    { role: "CM", x: 42, y: 50 },
    { role: "CM", x: 58, y: 50 },
    { role: "RM", x: 75, y: 52 },
    { role: "ST", x: 50, y: 82 },
  ],
};

export const FORMATION_KEYS: FormationKey[] = ["433", "4231", "352", "343", "541"];

/** 기존 선수 배열을 새 포메이션 슬롯에 매핑 (역할 유지하며 좌표 갱신) */
export function applyFormation<T extends { role: string; x: number; y: number }>(
  players: T[],
  key: FormationKey
): T[] {
  const slots = FORMATIONS[key];
  return players.map((p, i) => ({ ...p, x: slots[i]?.x ?? p.x, y: slots[i]?.y ?? p.y, role: slots[i]?.role ?? p.role }));
}
