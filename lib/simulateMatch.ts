import type { MatchEvent, Player, Side, Tactics } from "./types";
import { tacticalModifiers, poissonOutcome, type AlternateResult } from "./matchEngine";

/**
 * 경기 타임라인 생성기 — 캠페인의 척추.
 *
 * 이 앱의 모든 화면(스코어보드·이벤트피드·진행바·3D 대본 연결·경기후 리포트·데이터출처)은
 * `match.timeline` 하나에서 파생된다. 그래서 **실제로 열린 적 없는 경기도 타임라인만
 * 만들어주면** 나머지 스택이 그대로 돌아간다. 한국이 남아공을 이겼을 때 만나는 32강 캐나다전
 * 부터가 그런 경기다 — 상대와 대진 위치는 실측이지만, 그 경기 자체는 열린 적이 없다.
 *
 * 설계 원칙 두 가지:
 *
 * 1. **결정론.** 같은 전술·같은 라인업이면 항상 같은 경기가 나온다. 시드를 (경기 id + 전술 +
 *    선발)에서 해시로 뽑는다. 재생을 되감아도, 새로고침해도 결과가 변하지 않아야 감독의
 *    판단과 결과 사이의 인과가 성립한다. 기존 matchSim.ts의 원칙과 같다.
 *
 * 2. **현실적인 스코어.** 기대득점 λ를 월드컵 범위로 묶고, 골 수는 그 λ의 포아송에서 뽑는다.
 *    이벤트의 xg 합이 λ와 일치하도록 역산해서, snapshotAt·simulateAlternate가 이 타임라인을
 *    읽어도 같은 이야기를 하게 만든다.
 */

/* ───────────────────────── 결정론 난수 ───────────────────────── */

export function hashSeed(...parts: (string | number | boolean)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

/** mulberry32 — 짧고 분포가 고른 시드 PRNG */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────── 팀 강도 ───────────────────────── */

type Group = "GK" | "DEF" | "MID" | "FWD";

function group(role: string): Group {
  const r = role.toUpperCase();
  if (r === "GK") return "GK";
  if (r === "ST" || r === "LW" || r === "RW" || r === "CF") return "FWD";
  // LWB/RWB는 윙백이라 수비 라인으로 본다 (B 포함)
  if (r.includes("B")) return "DEF";
  return "MID";
}

function weightedMean(xi: Player[], weights: Record<Group, number>): number {
  let sum = 0;
  let w = 0;
  for (const p of xi) {
    const g = weights[group(p.role)];
    sum += p.rating * g;
    w += g;
  }
  return w ? sum / w : 75;
}

/** 공격력 — 전방이 결정하되 중원의 공급도 크게 본다 */
export function teamAttack(xi: Player[]): number {
  return weightedMean(xi, { GK: 0, DEF: 0.15, MID: 0.35, FWD: 0.5 });
}

/** 수비력 — 수비 라인 + 골키퍼 + 중원의 차단 */
export function teamDefence(xi: Player[]): number {
  return weightedMean(xi, { GK: 0.25, DEF: 0.5, MID: 0.25, FWD: 0 });
}

/**
 * 월드컵 한 팀의 경기당 평균 득점. 실제 대회 평균이 팀당 대략 1.2~1.4골이라
 * 여기를 기준선으로 잡고 전력 차·전술로 밀고 당긴다.
 */
const BASE_GOALS = 1.15;
/** 전력비의 민감도. 크게 잡으면 강팀이 매번 대량 득점해서 경기가 시시해진다. */
const STRENGTH_EXP = 3;
const LAMBDA_MIN = 0.25;
const LAMBDA_MAX = 3.0;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 한 팀의 기대득점 — 우리 공격력 대 상대 수비력, 그리고 전술 */
export function expectedGoalsFor(attackXI: Player[], defendXI: Player[], attacking: Tactics, defending: Tactics): number {
  const atk = teamAttack(attackXI);
  const def = teamDefence(defendXI);
  const a = tacticalModifiers(attacking);
  const d = tacticalModifiers(defending);

  const ratio = Math.pow(atk / def, STRENGTH_EXP);
  const lambda =
    BASE_GOALS *
    ratio *
    a.attackBoost *
    (1 + a.counterEdge) *
    // 상대가 라인을 올리고 공격적으로 나오면 우리에게 공간이 열린다
    d.defenseRisk *
    // 상대의 압박은 우리 전개를 끊는다
    (1 - d.pressGain * 0.35 + d.trapRisk);

  return clamp(lambda, LAMBDA_MIN, LAMBDA_MAX);
}

/**
 * 킥오프 전 예상 — 아직 경기가 만들어지지 않았을 때 쓴다.
 *
 * 전력과 전술만으로 기대득점을 내고 그 분포에서 최빈 스코어·승무패를 뽑는다.
 * 감독이 슬라이더를 움직이면 여기가 즉시 반응해야 한다 — 킥오프 전에 조작이
 * 결과에 어떻게 작용하는지 볼 수 있어야 전술을 짜는 의미가 있다.
 */
export function projectMatch(
  homeXI: Player[],
  awayXI: Player[],
  homeTactics: Tactics,
  awayTactics: Tactics
): AlternateResult {
  return poissonOutcome(
    expectedGoalsFor(homeXI, awayXI, homeTactics, awayTactics),
    expectedGoalsFor(awayXI, homeXI, awayTactics, homeTactics)
  );
}

function poissonDraw(lambda: number, rnd: () => number): number {
  // Knuth — λ가 3 이하라 반복이 짧다
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > L);
  return k - 1;
}

/** 이 이상이면 '경기'가 아니라 참사 — 이 위로는 확률을 눌러준다 */
const TAIL_FROM = 4;

/**
 * 꼬리를 눌러 뽑은 포아송.
 *
 * 순수 포아송은 축구 스코어에 비해 위쪽 꼬리가 두껍다. λ=2에서도 5골이 4% 넘게 나오는데,
 * 실제 경기는 앞서가는 팀이 내려앉고 지는 팀이 무리하다가 균형이 잡혀서 그렇게까지 벌어지지
 * 않는다. 4골 이상이 나오면 한 번 더 뽑아 낮은 쪽을 쓴다 — 0~3 구간은 그대로 두고
 * 대량 득점만 절반으로 줄인다.
 */
function poissonSample(lambda: number, rnd: () => number): number {
  const k = poissonDraw(lambda, rnd);
  if (k < TAIL_FROM) return k;
  return Math.min(k, poissonDraw(lambda, rnd));
}

/* ───────────────────────── 이벤트 생성 ───────────────────────── */

/** 득점자 추첨 — 포지션 기여도 × 기량. GK는 넣지 않는다. */
function pickScorer(xi: Player[], rnd: () => number): Player | null {
  const ROLE_W: Record<Group, number> = { GK: 0, DEF: 0.12, MID: 0.3, FWD: 1 };
  const pool = xi
    .map((p) => ({ p, w: ROLE_W[group(p.role)] * Math.pow(p.rating / 75, 2) }))
    .filter((c) => c.w > 0);
  const total = pool.reduce((a, c) => a + c.w, 0);
  if (!total) return null;
  let r = rnd() * total;
  for (const c of pool) {
    r -= c.w;
    if (r <= 0) return c.p;
  }
  return pool[pool.length - 1].p;
}

/**
 * 서로 다른 분을 n개 뽑는다.
 * 실제 월드컵 득점은 후반, 특히 60분 이후에 몰린다 — 제곱근 편향으로 뒤쪽에 무게를 준다.
 */
function spreadMinutes(n: number, from: number, to: number, rnd: () => number, taken: Set<number>): number[] {
  const out: number[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const t = Math.sqrt(rnd()); // 0~1, 뒤쪽에 무게
    const m = Math.round(from + t * (to - from));
    if (m <= from || m > to || taken.has(m)) continue;
    taken.add(m);
    out.push(m);
  }
  return out.sort((a, b) => a - b);
}

const KO = {
  goal: (n: string, s: number, c: number) => `${n} 골! ${s}-${c}`,
  shot: "슈팅, 골문을 벗어난다",
  shotOn: "슈팅, 골키퍼가 막아낸다",
  chance: "기회를 만들어낸다",
  corner: "코너킥",
  yellow: (n: string) => `${n}, 경고`,
  ht: "전반 종료",
  ft: "경기 종료",
  etStart: "연장 시작",
  etEnd: "연장 종료 — 승부차기",
};

interface SimInput {
  /** 시드 안정성을 위한 식별자 (경기 id) */
  matchId: string;
  homeXI: Player[];
  awayXI: Player[];
  homeTactics: Tactics;
  awayTactics: Tactics;
  /** 무승부로 끝날 수 없는 경기(토너먼트)면 연장·승부차기까지 간다 */
  needsWinner?: boolean;
  /**
   * 경기 도중 전술을 바꿨을 때 — 이미 지나간 이벤트는 그대로 두고 **남은 분만** 다시 만든다.
   *
   * 감독이 60분에 전술을 바꿨는데 이미 넣은 골이 사라지면 그건 다른 경기다.
   * 지난 것은 역사고, 바꿀 수 있는 것은 앞으로뿐이다.
   */
  carryOver?: { events: MatchEvent[]; fromMinute: number };
}

export interface SimResult {
  timeline: MatchEvent[];
  finalScore: [number, number];
  penalties?: [number, number];
  /** 이번 경기에 쓰인 기대득점 — 리포트에서 "왜 이 결과인가"를 설명할 때 쓴다 */
  lambda: [number, number];
}

/**
 * 한 경기를 통째로 생성한다.
 *
 * 골을 먼저 정하고(포아송) 그 사이를 슛·기회·코너·경고로 채운다. 순서가 반대면
 * 슛이 골을 만들어버려서 스코어를 통제할 수 없다 — 재생 프로그램에서는 기록이 먼저다.
 */
export function simulateTimeline(input: SimInput): SimResult {
  const { matchId, homeXI, awayXI, homeTactics, awayTactics, needsWinner = false, carryOver } = input;

  // 이어받는 구간 — 여기까지는 손대지 않는다
  const from = carryOver ? Math.max(0, Math.min(89, carryOver.fromMinute)) : 0;
  const kept = carryOver ? carryOver.events.filter((e) => e.minute <= from && e.type !== "whistle") : [];
  const keptGoals = { home: 0, away: 0 };
  for (const e of kept) if (e.type === "goal") keptGoals[e.side]++;
  /** 남은 시간 비율 — 60분에 바꿨으면 남은 30분치만 생성한다 */
  const remain = (90 - from) / 90;

  /*
   * 시드는 경기 + 양 팀 전술 + 선발에서 뽑는다.
   * 선발을 시드에 넣어야 "누구를 넣느냐"가 결과를 바꾼다 — 교체가 의미를 가지려면 필요하다.
   */
  const seed = hashSeed(
    matchId,
    from, // 같은 전술이라도 몇 분에 바꿨는지가 다르면 다른 전개가 된다
    JSON.stringify(homeTactics),
    JSON.stringify(awayTactics),
    homeXI.map((p) => `${p.id}:${p.rating}`).join(","),
    awayXI.map((p) => p.id).join(",")
  );
  const rnd = mulberry32(seed);

  const lambdaHome = expectedGoalsFor(homeXI, awayXI, homeTactics, awayTactics);
  const lambdaAway = expectedGoalsFor(awayXI, homeXI, awayTactics, homeTactics);

  // 남은 시간분의 기대득점만 새로 뽑고, 이미 넣은 골은 그대로 더한다
  let hg = keptGoals.home + poissonSample(lambdaHome * remain, rnd);
  let ag = keptGoals.away + poissonSample(lambdaAway * remain, rnd);

  const taken = new Set<number>([45, 90, ...kept.map((e) => e.minute)]);
  const events: MatchEvent[] = [...kept];

  /** 골 이벤트를 만들고 누적 스코어를 붙인다 */
  const goalEvents = (side: Side, minutes: number[], xi: Player[]) => {
    for (const m of minutes) {
      const scorer = pickScorer(xi, rnd);
      const nameEn = scorer?.name ?? "—";
      const nameKo = scorer?.nameKo ?? nameEn;
      events.push({
        minute: m,
        side,
        type: "goal",
        player: nameEn,
        // xg는 아래에서 λ에 맞춰 다시 배분한다
        xg: 0.2 + rnd() * 0.25,
        detail: `${nameEn} scores`,
        detailKo: `${nameKo} 골!`,
      });
    }
  };

  // 새로 만드는 이벤트는 전부 `from` 이후 구간에만 놓는다
  goalEvents("home", spreadMinutes(hg - keptGoals.home, from, 90, rnd, taken), homeXI);
  goalEvents("away", spreadMinutes(ag - keptGoals.away, from, 90, rnd, taken), awayXI);

  /* ── 슛·기회·코너: 기대득점에 비례한 양 ── */
  const fill = (side: Side, lambda: number, goals: number) => {
    const shots = Math.max(goals, Math.round((lambda * 6 + rnd() * 4) * remain));
    const corners = Math.round((2 + lambda * 2 + rnd() * 2) * remain);
    for (const m of spreadMinutes(shots, from, 90, rnd, taken)) {
      const onTarget = rnd() < 0.38;
      events.push({
        minute: m,
        side,
        type: "shot",
        xg: 0.02 + rnd() * 0.12,
        detail: onTarget ? "Shot saved" : "Shot off target",
        detailKo: onTarget ? KO.shotOn : KO.shot,
      });
    }
    for (const m of spreadMinutes(corners, from, 90, rnd, taken)) {
      events.push({ minute: m, side, type: "corner", detail: "Corner", detailKo: KO.corner });
    }
  };
  fill("home", lambdaHome, hg - keptGoals.home);
  fill("away", lambdaAway, ag - keptGoals.away);

  /* ── 경고: 압박이 강할수록 늘어난다 ── */
  const cards = (side: Side, xi: Player[], tactics: Tactics) => {
    const n = Math.round((rnd() * 2 + tactics.press / 60) * remain);
    const outfield = xi.filter((p) => group(p.role) !== "GK");
    for (const m of spreadMinutes(n, Math.max(15, from), 90, rnd, taken)) {
      const p = outfield[Math.floor(rnd() * outfield.length)];
      if (!p) continue;
      events.push({
        minute: m,
        side,
        type: "card",
        card: "yellow",
        player: p.name,
        detail: `${p.name} booked`,
        detailKo: KO.yellow(p.nameKo ?? p.name),
      });
    }
  };
  cards("home", homeXI, homeTactics);
  cards("away", awayXI, awayTactics);

  events.push({ minute: 45, side: "home", type: "whistle", detail: "Half time", detailKo: KO.ht });

  /* ── 연장·승부차기: 토너먼트에서 무승부는 끝이 아니다 ── */
  let penalties: [number, number] | undefined;
  let endMinute = 90;

  if (needsWinner && hg === ag) {
    events.push({ minute: 90, side: "home", type: "whistle", detail: "Full time — to extra time", detailKo: `${KO.ft} — 연장전` });
    endMinute = 120;
    // 연장은 30분뿐이고 양 팀 모두 지쳐 있다 — 기대득점을 크게 낮춘다
    const etH = poissonSample(lambdaHome * 0.28, rnd);
    const etA = poissonSample(lambdaAway * 0.28, rnd);
    goalEvents("home", spreadMinutes(etH, 91, 120, rnd, taken), homeXI);
    goalEvents("away", spreadMinutes(etA, 91, 120, rnd, taken), awayXI);
    hg += etH;
    ag += etA;

    if (hg === ag) {
      // 승부차기 — 골키퍼 기량이 약간의 우위를 만든다
      const gk = (xi: Player[]) => xi.find((p) => group(p.role) === "GK")?.rating ?? 75;
      const edge = (gk(homeXI) - gk(awayXI)) / 200;
      const homeWins = rnd() < 0.5 + edge;
      const loser = 2 + Math.floor(rnd() * 2); // 2~3
      penalties = homeWins ? [loser + 1, loser] : [loser, loser + 1];
      events.push({ minute: 120, side: "home", type: "whistle", detail: "Extra time over — penalties", detailKo: KO.etEnd });
    } else {
      events.push({ minute: 120, side: "home", type: "whistle", detail: "Full time after extra time", detailKo: "연장 종료" });
    }
  } else {
    events.push({ minute: 90, side: "home", type: "whistle", detail: "Full time", detailKo: KO.ft });
  }

  events.sort((a, b) => a.minute - b.minute);

  /*
   * xg 재배분 — 각 팀 이벤트의 xg 합이 그 팀의 λ와 정확히 일치하게 맞춘다.
   * 이걸 안 하면 화면의 xG 지표와 실제로 나온 골 수가 서로 다른 이야기를 한다.
   */
  const keptSet = new Set(kept);
  for (const side of ["home", "away"] as Side[]) {
    // 이미 지나간 이벤트의 xG는 건드리지 않는다 — 그건 이미 일어난 일이다.
    // 새로 만든 구간만 '남은 시간분의 λ'에 맞춘다.
    const fresh = events.filter(
      (e) => e.side === side && (e.type === "goal" || e.type === "shot") && !keptSet.has(e)
    );
    const target = (side === "home" ? lambdaHome : lambdaAway) * remain;
    const sum = fresh.reduce((a, e) => a + (e.xg ?? 0), 0);
    if (sum > 0) for (const e of fresh) e.xg = Number(((e.xg ?? 0) * (target / sum)).toFixed(3));
  }

  // 골 이벤트 문구에 누적 스코어를 붙인다 (이벤트 피드에서 흐름이 읽혀야 한다)
  let rh = 0;
  let ra = 0;
  for (const e of events) {
    if (e.type !== "goal") continue;
    if (e.side === "home") rh++;
    else ra++;
    const ko = e.detailKo?.replace(" 골!", "") ?? "";
    e.detail = `${e.player} scores — ${rh}–${ra}`;
    e.detailKo = KO.goal(ko, rh, ra);
  }

  const last = events[events.length - 1];
  if (last?.type === "whistle" && last.minute === endMinute && !penalties) {
    last.detail = `Full time — ${hg}–${ag}`;
    last.detailKo = `${KO.ft} — ${hg}-${ag}`;
  }

  return {
    timeline: events,
    finalScore: [hg, ag],
    penalties,
    lambda: [Number(lambdaHome.toFixed(2)), Number(lambdaAway.toFixed(2))],
  };
}
