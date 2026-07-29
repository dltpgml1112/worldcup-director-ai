import type { FormationKey, Tactics } from "./types";
import type { Lang } from "./i18n";

/**
 * 전술 프리셋 — 이름 있는 전술 정체성.
 *
 * 슬라이더만 있으면 처음 보는 사람은 무엇을 만져야 할지 모른다. Football Manager가
 * 강한 지점이 여기다: 전술에 이름이 있고, 그것이 무엇을 하고 무엇을 포기하는지
 * 명시된다. 각 프리셋은 **얻는 것과 내주는 것**을 함께 표기한다 — 공짜 전술은 없다.
 */

export interface Preset {
  id: string;
  icon: string;
  nameKo: string;
  nameEn: string;
  /** 한 줄 요약 */
  descKo: string;
  descEn: string;
  /** 이 전술이 내주는 것 — 트레이드오프를 숨기지 않는다 */
  costKo: string;
  costEn: string;
  formation: FormationKey;
  tactics: Partial<Tactics>;
}

export const PRESETS: Preset[] = [
  {
    id: "balanced",
    icon: "⚖️",
    nameKo: "균형",
    nameEn: "Balanced",
    descKo: "공수 균형. 상대를 파악할 때까지의 기본값.",
    descEn: "Even shape. The default while you read the opponent.",
    costKo: "어느 쪽에서도 수적 우위를 못 만든다.",
    costEn: "Creates no overload anywhere.",
    formation: "433",
    tactics: { attack: 55, line: 50, press: 50, tempo: 55, width: 50, counter: false, highPress: false, offsideTrap: false },
  },
  {
    id: "gegenpress",
    icon: "🔥",
    nameKo: "게겐프레싱",
    nameEn: "Gegenpress",
    descKo: "빼앗기면 즉시 되빼앗는다. 상대 진영에서 경기를 끝낸다.",
    descEn: "Win it back instantly. Play the game in their half.",
    costKo: "체력 소모가 가장 크고, 한 번 뚫리면 뒷공간이 그대로 열린다.",
    costEn: "Burns stamina fastest; one broken line concedes the space behind.",
    formation: "433",
    tactics: { attack: 76, line: 78, press: 92, tempo: 80, width: 58, counter: false, highPress: true, offsideTrap: true },
  },
  {
    id: "tiki",
    icon: "🎯",
    nameKo: "점유 축구",
    nameEn: "Possession",
    descKo: "짧은 패스로 공을 소유해 상대를 지치게 만든다.",
    descEn: "Short passing to keep the ball and drain them.",
    costKo: "폭이 좁아 측면을 내주고, 결정적 기회가 적다.",
    costEn: "Narrow shape concedes the flanks; fewer clear chances.",
    formation: "4231",
    tactics: { attack: 58, line: 62, press: 68, tempo: 78, width: 34, counter: false, highPress: false, offsideTrap: false },
  },
  {
    id: "counter",
    icon: "⚡",
    nameKo: "역습",
    nameEn: "Counter-attack",
    descKo: "내려서서 흡수한 뒤 한 번에 전진한다. 강팀 상대의 정석.",
    descEn: "Absorb deep, then break in one move. The classic underdog plan.",
    costKo: "점유율을 내주고, 선제 실점하면 계획이 무너진다.",
    costEn: "Cedes possession; conceding first breaks the plan.",
    formation: "541",
    tactics: { attack: 46, line: 30, press: 38, tempo: 72, width: 46, counter: true, highPress: false, offsideTrap: false },
  },
  {
    id: "wing",
    icon: "↔️",
    nameKo: "측면 폭격",
    nameEn: "Wing play",
    descKo: "폭을 최대로 벌려 윙어의 1대1과 크로스를 만든다.",
    descEn: "Maximum width to isolate wingers and cross.",
    costKo: "중앙이 비어 역습 시 미드필드를 통과당한다.",
    costEn: "Empty middle — counters run straight through midfield.",
    formation: "343",
    tactics: { attack: 72, line: 58, press: 55, tempo: 62, width: 92, counter: false, highPress: false, offsideTrap: false },
  },
  {
    id: "lowblock",
    icon: "🛡️",
    nameKo: "버스 세우기",
    nameEn: "Park the bus",
    descKo: "두 줄을 낮게 세워 공간을 없앤다. 리드를 지킬 때.",
    descEn: "Two banks, deep and compact. For protecting a lead.",
    costKo: "전방이 고립돼 공격 기회가 거의 사라진다.",
    costEn: "Strikers get isolated; you almost stop creating.",
    formation: "541",
    tactics: { attack: 26, line: 22, press: 32, tempo: 38, width: 30, counter: true, highPress: false, offsideTrap: false },
  },
];

export function presetName(p: Preset, lang: Lang) {
  return lang === "ko" ? p.nameKo : p.nameEn;
}
export function presetDesc(p: Preset, lang: Lang) {
  return lang === "ko" ? p.descKo : p.descEn;
}
export function presetCost(p: Preset, lang: Lang) {
  return lang === "ko" ? p.costKo : p.costEn;
}

/** 현재 전술이 어떤 프리셋에 가장 가까운지 (슬라이더를 직접 만졌을 때 표시용) */
export function closestPreset(tactics: Tactics, formation: FormationKey): { preset: Preset; exact: boolean } | null {
  let best: Preset | null = null;
  let bestD = Infinity;
  for (const p of PRESETS) {
    const t = p.tactics;
    const d =
      Math.abs((t.attack ?? 50) - tactics.attack) +
      Math.abs((t.line ?? 50) - tactics.line) +
      Math.abs((t.press ?? 50) - tactics.press) +
      Math.abs((t.tempo ?? 50) - tactics.tempo) +
      Math.abs((t.width ?? 50) - tactics.width) +
      (p.formation === formation ? 0 : 40);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (!best) return null;
  return { preset: best, exact: bestD <= 2 };
}
