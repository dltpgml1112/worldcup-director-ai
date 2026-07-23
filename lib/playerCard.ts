import type { Player } from "./types";

export type CardTier = "gold" | "silver" | "bronze";

/** 카드 등급: 스타/고평점=골드, 중간=실버, 그 외 브론즈 (FUT 스타일) */
export function cardTier(p: Pick<Player, "rating" | "legend">): CardTier {
  if (p.legend || p.rating >= 83) return "gold";
  if (p.rating >= 77) return "silver";
  return "bronze";
}

export interface CardStats {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

const STAT_KEYS: (keyof CardStats)[] = ["pac", "sho", "pas", "dri", "def", "phy"];

/** 이름 기반 결정론적 해시 (선수별 스탯 편차용) */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 역할별 스탯 프로파일 (base rating 대비 가감) */
const PROFILE: Record<string, Partial<CardStats>> = {
  GK: { pac: -8, sho: -30, pas: -6, dri: -18, def: 8, phy: 4 },
  CB: { pac: -6, sho: -26, pas: -6, dri: -14, def: 12, phy: 9 },
  LB: { pac: 6, sho: -12, pas: 2, dri: 2, def: 4, phy: 0 },
  RB: { pac: 6, sho: -12, pas: 2, dri: 2, def: 4, phy: 0 },
  LWB: { pac: 8, sho: -10, pas: 3, dri: 4, def: 2, phy: -2 },
  RWB: { pac: 8, sho: -10, pas: 3, dri: 4, def: 2, phy: -2 },
  DM: { pac: -4, sho: -6, pas: 4, dri: 2, def: 8, phy: 6 },
  CM: { pac: 0, sho: 0, pas: 6, dri: 4, def: 2, phy: 2 },
  AM: { pac: 3, sho: 3, pas: 7, dri: 8, def: -12, phy: -4 },
  LM: { pac: 7, sho: 0, pas: 4, dri: 6, def: -8, phy: -4 },
  RM: { pac: 7, sho: 0, pas: 4, dri: 6, def: -8, phy: -4 },
  LW: { pac: 9, sho: 3, pas: 3, dri: 8, def: -18, phy: -6 },
  RW: { pac: 9, sho: 3, pas: 3, dri: 8, def: -18, phy: -6 },
  ST: { pac: 5, sho: 9, pas: -2, dri: 5, def: -22, phy: 3 },
};

/** FUT식 6대 스탯 (PAC/SHO/PAS/DRI/DEF/PHY) — 결정론적 생성 */
export function cardStats(p: Pick<Player, "name" | "role" | "rating">): CardStats {
  const base = p.rating;
  const prof = PROFILE[p.role.toUpperCase()] ?? {};
  const h = hash(p.name);
  const out = {} as CardStats;
  STAT_KEYS.forEach((k, idx) => {
    const jitter = ((h >> (idx * 3)) & 7) - 3; // -3 ~ +4
    const v = base + (prof[k] ?? 0) + jitter;
    out[k] = Math.max(42, Math.min(99, Math.round(v)));
  });
  return out;
}

export const STAT_LABELS: Record<keyof CardStats, string> = {
  pac: "PAC",
  sho: "SHO",
  pas: "PAS",
  dri: "DRI",
  def: "DEF",
  phy: "PHY",
};
