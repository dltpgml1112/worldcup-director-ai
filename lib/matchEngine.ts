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
 *
 * **모든 계수는 DEFAULT_TACTICS에서 중립(배율 1.0 / 가산 0)이 되도록 정규화한다.**
 * 이전에는 기본값에서 이미 attackBoost 1.195 · defenseRisk 1.235 · pressGain 0.2였다.
 * 즉 사용자가 아무것도 건드리지 않아도 실제 경기 대비 기대득점이 20% 부풀고 상대 실점
 * 위험이 24% 올라간 상태로 시작했다. 기준선이 틀리면 "내 조정이 만든 차이"를 읽을 수 없다.
 */
const ATTACK_AT_DEFAULT = 0.7 + (DEFAULT_TACTICS.attack / 100) * 0.9;
const DEFENSE_AT_DEFAULT =
  0.6 + (DEFAULT_TACTICS.attack / 100) * 0.7 + (DEFAULT_TACTICS.line / 100) * 0.5;

export function tacticalModifiers(t: Tactics) {
  // 곱셈 계수 — 기본 전술에서 정확히 1.0
  const attackBoost = (0.7 + (t.attack / 100) * 0.9) / ATTACK_AT_DEFAULT;
  const defenseRisk =
    (0.6 + (t.attack / 100) * 0.7 + (t.line / 100) * 0.5) / DEFENSE_AT_DEFAULT;
  // 가산 항 — 기본값(press 50, tempo 55, 토글 off)에서 0
  const pressGain = ((t.press - 50) / 100) * 0.4 + (t.highPress ? 0.15 : 0);
  const pressFatigue = ((t.press - 50) / 100) * 0.25 + (t.highPress ? 0.12 : 0);
  const tempoPoss = ((t.tempo - DEFAULT_TACTICS.tempo) / 100) * 24; // 점유율 편향
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

  /*
   * 승리확률 — 득점차 + 잔여 xG 우위 + 전술 기여분의 로지스틱.
   *
   * 이전에는 공격 성향(attackBoost)과 오프사이드 트랩만 반영해서, 압박·템포·역습·
   * 수비 라인을 아무리 움직여도 숫자가 그대로였다. 전술 도구에서 조작이 결과에
   * 안 나타나면 '다시보기'가 된다. 각 항이 무엇을 뜻하는지 아래에 남긴다.
   */
  const goalDiff = hs - as;
  const xgDiff = hx - ax;
  const timeLeft = Math.max(0, 90 - Math.min(minute, 90)) / 90;

  // 후반으로 갈수록 강한 압박의 체력 대가가 커진다
  const fatigue = mod.pressFatigue * (Math.max(0, minute - 60) / 30) * 0.7;

  const strength =
    goalDiff * 1.15 + // 실제 득점차가 가장 큰 요인
    xgDiff * 0.6 + // 기회의 질 우위
    (mod.attackBoost - 1) * 0.7 + // 공격 성향
    mod.pressGain * 0.75 + // 압박으로 높은 위치에서 회수
    mod.counterEdge * 0.6 + // 역습 옵션
    (tactics.tempo / 100 - 0.5) * 0.3 - // 템포로 경기 흐름 장악
    (mod.defenseRisk - 1) * 0.45 - // 라인·공격 과다로 내주는 뒷공간
    mod.trapRisk -
    fatigue;
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

/* ───────────────────────── 포아송 스코어라인 ───────────────────────── */

/** 월드컵 한 경기의 팀 기대득점 현실 범위. 이 밖은 경기가 아니라 버그다. */
const LAMBDA_MIN = 0.25;
const LAMBDA_MAX = 3.0;
/** 스코어라인 행렬 크기 — 한 팀 7골이면 사실상 확률 0 */
const MAX_GOALS = 7;

function poissonPmf(lambda: number, k: number): number {
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** 슛이 아닌 이벤트는 기대득점에 들어가지 않는다 (코너·경고·휘슬·기회) */
function expectedGoals(match: MatchData, side: Side): number {
  return match.timeline
    .filter((e) => e.side === side && (e.type === "goal" || e.type === "shot"))
    .reduce((a, e) => a + (e.xg ?? (e.type === "goal" ? 0.3 : 0.05)), 0);
}

export interface AlternateResult {
  /** 가장 확률이 높은 스코어라인 (최빈값) */
  score: [number, number];
  /** 그 스코어라인이 나올 확률 % */
  scorelineProb: number;
  /** 기대득점 λ — 소수점이 있는 '평균적으로 몇 골' */
  xg: [number, number];
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
}

/**
 * ALTERNATE HISTORY — 택틱을 반영한 기대득점 → 스코어라인 분포.
 *
 * 이전 구현은 포아송을 **한 번 뽑아서** 그 표본을 그대로 보여줬다. λ가 1.2여도 한 번
 * 뽑으면 4골이 나오고(확률 약 3%), 슬라이더를 조금만 움직여도 스코어가 널을 뛰었다.
 * 표본 하나는 예측이 아니다.
 *
 * 여기서는 양 팀 득점 분포의 **결합행렬을 전부 계산**해서
 *  - 가장 확률이 높은 스코어라인 (최빈값)
 *  - 승/무/패 확률 (행렬을 영역별로 합산 — 로지스틱 근사 아님)
 * 를 낸다. 결정론적이라 같은 전술이면 항상 같은 답이고, 근거를 그대로 설명할 수 있다.
 */
export function simulateAlternate(match: MatchData, tactics: Tactics): AlternateResult {
  const mod = tacticalModifiers(tactics);

  const lambdaHome = clamp(
    expectedGoals(match, "home") * mod.attackBoost * (1 + mod.counterEdge),
    LAMBDA_MIN,
    LAMBDA_MAX
  );
  const lambdaAway = clamp(
    expectedGoals(match, "away") * mod.defenseRisk * (1 - mod.pressGain * 0.4 + mod.trapRisk),
    LAMBDA_MIN,
    LAMBDA_MAX
  );
  return poissonOutcome(lambdaHome, lambdaAway);
}

/**
 * 양 팀 기대득점 → 스코어라인 분포.
 *
 * 킥오프 전 예상(전력·전술 기반)과 경기 중 대체역사(실제 xG 기반)가 **같은 계산**을
 * 쓰도록 분리했다. 두 화면이 다른 방식으로 확률을 내면 숫자가 어긋난다.
 */
export function poissonOutcome(lambdaHome: number, lambdaAway: number): AlternateResult {
  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(lambdaHome, k));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(lambdaAway, k));

  let best: [number, number] = [0, 0];
  let bestP = -1;
  let win = 0,
    draw = 0,
    loss = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph[h] * pa[a];
      if (p > bestP) {
        bestP = p;
        best = [h, a];
      }
      if (h > a) win += p;
      else if (h === a) draw += p;
      else loss += p;
    }
  }

  // 행렬이 MAX_GOALS에서 잘리므로 남은 꼬리를 정규화로 흡수한다
  const total = win + draw + loss || 1;

  return {
    score: best,
    scorelineProb: Math.round((bestP / total) * 100),
    xg: [Number(lambdaHome.toFixed(2)), Number(lambdaAway.toFixed(2))],
    homeWinProb: Math.round((win / total) * 100),
    drawProb: Math.round((draw / total) * 100),
    awayWinProb: Math.round((loss / total) * 100),
  };
}

export function eventColor(side: Side): string {
  return side === "home" ? "#42f59b" : "#ff5a6e";
}
