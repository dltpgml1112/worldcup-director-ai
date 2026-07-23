import type { MatchData, MatchEvent, Side, Tactics } from "./types";

export const DEFAULT_TACTICS: Tactics = {
  attack: 55,
  line: 50,
  press: 50,
  tempo: 55,
  width: 50,
  counter: false,
  highPress: false,
  offsideTrap: false,
};

/** 누적 상태 스냅샷 (특정 분까지 재생된 경기 상태) */
export interface MatchSnapshot {
  minute: number;
  score: [number, number];
  xg: [number, number];
  shots: [number, number];
  corners: [number, number];
  cards: [number, number];
  possession: [number, number]; // 합 100
  momentum: number; // -100(away) ~ +100(home)
  homeWinProb: number; // 0-100
  drawProb: number;
  awayWinProb: number;
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 택티컬 슬라이더/토글을 팀 강도 계수로 변환.
 * 공격↑ = 득점기대↑·실점위험↑, 라인↑ = 압박이득·뒷공간위험, 등.
 */
export function tacticalModifiers(t: Tactics) {
  const attackBoost = 0.7 + (t.attack / 100) * 0.9; // 0.7 ~ 1.6
  const defenseRisk = 0.6 + (t.attack / 100) * 0.7 + (t.line / 100) * 0.5;
  const pressGain = (t.press / 100) * 0.4 + (t.highPress ? 0.15 : 0);
  const pressFatigue = (t.press / 100) * 0.25 + (t.highPress ? 0.12 : 0);
  const tempoPoss = (t.tempo / 100 - 0.5) * 24; // 점유율 편향
  const counterEdge = t.counter ? 0.18 : 0;
  const trapRisk = t.offsideTrap ? 0.14 : 0;
  return { attackBoost, defenseRisk, pressGain, pressFatigue, tempoPoss, counterEdge, trapRisk };
}

/** 실제 타임라인을 특정 분까지 접어 스냅샷 생성 */
export function snapshotAt(match: MatchData, minute: number, tactics: Tactics): MatchSnapshot {
  const mod = tacticalModifiers(tactics);
  let hs = 0,
    as = 0,
    hx = 0,
    ax = 0,
    hShots = 0,
    aShots = 0,
    hCorners = 0,
    aCorners = 0,
    hCards = 0,
    aCards = 0;
  let momentum = 0;

  for (const e of match.timeline) {
    if (e.minute > minute) break;
    const home = e.side === "home";
    switch (e.type) {
      case "goal":
        home ? hs++ : as++;
        home ? (hx += e.xg ?? 0.6) : (ax += e.xg ?? 0.6);
        momentum += home ? 55 : -55;
        break;
      case "shot":
        home ? hShots++ : aShots++;
        home ? (hx += e.xg ?? 0.05) : (ax += e.xg ?? 0.05);
        momentum += home ? 12 : -12;
        break;
      case "chance":
        momentum += home ? 8 : -8;
        break;
      case "corner":
        home ? hCorners++ : aCorners++;
        momentum += home ? 5 : -5;
        break;
      case "card":
        home ? hCards++ : aCards++;
        break;
    }
    momentum *= 0.82; // 시간이 지나면 모멘텀 감쇠
  }

  // 택틱 반영: 사용자 팀(home)의 공격 성향이 xG 기대에 가중
  hx *= mod.attackBoost * (1 + mod.counterEdge * 0.5);
  hShots = Math.round(hShots * (0.9 + tactics.attack / 250));

  const base = 50 + mod.tempoPoss + (momentum > 0 ? 4 : -4);
  const homePoss = clamp(Math.round(base), 30, 70);

  // 승리확률: 득점차 + 잔여 xG 우위 기반 로지스틱
  const goalDiff = hs - as;
  const xgDiff = hx - ax;
  const timeLeft = Math.max(0, 90 - Math.min(minute, 90)) / 90;
  const strength = goalDiff * 1.15 + xgDiff * 0.6 + (mod.attackBoost - 1) * 0.8 - mod.trapRisk;
  const logistic = 1 / (1 + Math.exp(-strength));
  let homeWin = logistic * 100;
  // 남은 시간이 많을수록 무승부 확률↑
  let draw = 26 * timeLeft + 8;
  homeWin = clamp(homeWin - draw / 2, 3, 94);
  const awayWin = clamp(100 - homeWin - draw, 3, 94);
  const norm = homeWin + awayWin + draw || 1;

  return {
    minute,
    score: [hs, as],
    xg: [Number(hx.toFixed(2)), Number(ax.toFixed(2))],
    shots: [hShots, aShots],
    corners: [hCorners, aCorners],
    cards: [hCards, aCards],
    possession: [homePoss, 100 - homePoss],
    momentum: clamp(momentum, -100, 100),
    homeWinProb: Math.round((homeWin / norm) * 100),
    drawProb: Math.round((draw / norm) * 100),
    awayWinProb: Math.round((awayWin / norm) * 100),
  };
}

/** 승리확률 그래프용: 1~90분(연장 포함) 곡선 */
export function winProbCurve(match: MatchData, tactics: Tactics): { minute: number; home: number; draw: number; away: number }[] {
  const end = match.timeline[match.timeline.length - 1]?.minute ?? 90;
  const pts: { minute: number; home: number; draw: number; away: number }[] = [];
  for (let m = 0; m <= end; m += 3) {
    const s = snapshotAt(match, m, tactics);
    pts.push({ minute: m, home: s.homeWinProb, draw: s.drawProb, away: s.awayWinProb });
  }
  return pts;
}

/**
 * ALTERNATE HISTORY — 택틱을 반영한 포아송 재시뮬레이션.
 * 실제 xG 총합을 기대득점으로 삼고 택틱 계수로 조정 → 대체 스코어라인.
 */
export function simulateAlternate(match: MatchData, tactics: Tactics, seed = 42) {
  const mod = tacticalModifiers(tactics);
  const totalHx = match.timeline.filter((e) => e.side === "home").reduce((a, e) => a + (e.xg ?? 0.05), 0);
  const totalAx = match.timeline.filter((e) => e.side === "away").reduce((a, e) => a + (e.xg ?? 0.05), 0);

  const lambdaHome = totalHx * mod.attackBoost * (1 + mod.counterEdge);
  const lambdaAway = totalAx * mod.defenseRisk * (1 - mod.pressGain * 0.4 + mod.trapRisk);

  // 시드 기반 포아송 (재현 가능)
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const poisson = (lambda: number) => {
    const L = Math.exp(-lambda);
    let k = 0,
      p = 1;
    do {
      k++;
      p *= rnd();
    } while (p > L);
    return k - 1;
  };

  const hg = poisson(lambdaHome);
  const ag = poisson(lambdaAway);
  const winProb = 1 / (1 + Math.exp(-(lambdaHome - lambdaAway) * 1.1));
  return {
    score: [hg, ag] as [number, number],
    xg: [Number(lambdaHome.toFixed(2)), Number(lambdaAway.toFixed(2))] as [number, number],
    homeWinProb: Math.round(winProb * 100),
  };
}

export function eventColor(side: Side): string {
  return side === "home" ? "#42f59b" : "#ff5a6e";
}
