import type { Side, Tactics } from "./types";
import { clamp, type PitchPoint } from "./pitchPositions";

/**
 * 경기 시뮬레이션 — 공과 선수의 실시간 상호작용.
 *
 * 이전 모델의 한계는 "인과가 없다"는 것이었다:
 *  - 공이 선수 발에 붙지 않아 허공에 떠 있는 것처럼 보였고
 *  - 점유가 사인파 타이머로 바뀌어, 상대가 옆에 있어도 아무 일이 없다가 갑자기 넘어갔고
 *  - 전원이 같은 계수로 슬라이드해 역할 구분이 없었다.
 *
 * 여기서는 공을 **한 선수가 소유**하고, 소유는 **실제 태클/인터셉트**로만 넘어간다.
 * 선수는 역할(GK/DEF/MID/FWD)에 따라 다르게 움직인다.
 * 난수는 (분, 시퀀스) 해시라 같은 경기를 다시 돌리면 같은 결과가 나온다.
 */

export type RoleGroup = "GK" | "DEF" | "MID" | "FWD";

export function roleGroup(role: string): RoleGroup {
  const r = role.toUpperCase();
  if (r === "GK") return "GK";
  if (r.includes("B")) return "DEF"; // CB, LB, RB, LWB, RWB
  if (r === "ST" || r === "LW" || r === "RW") return "FWD";
  return "MID"; // DM, CM, AM, LM, RM
}

export interface SimPlayer {
  id: string;
  /** 전술이 정한 기준 위치 */
  base: PitchPoint;
  role: string;
  rating: number;
  side: Side;
  group: RoleGroup;
}

export interface SimCtx {
  players: SimPlayer[];
  tactics: Tactics;
  minute: number;
  /** 타임라인이 지시하는 국면 — 골/슛 직전에는 그 팀 쪽으로 몰아준다 */
  scriptedSide: Side;
  /** 공이 대략 있어야 할 세로 위치(0~100, 홈 기준) */
  scriptedY: number;
  /** 이 분에 슛/골이 예정돼 있는가 */
  scriptedShot: boolean;
  /**
   * 이 분에 득점이 예정된 선수.
   *
   * 이게 없으면 화면과 기록이 따로 논다 — "23분 Foster 골"이 발표되는데 정작 공은
   * 반대편 미드필드에 있고 Foster는 화면에 없는 상황이 된다.
   * 예정된 순간에는 이 선수에게 공을 넘겨 실제로 슛을 쏘게 한다.
   */
  scriptedScorerId: string | null;
  /** 득점 예정 분 — 분마다 한 번만 개입하기 위한 키 */
  scriptedGoalMinute: number | null;
}

export type BallMode = "carry" | "pass" | "loose";

export interface SimState {
  mode: BallMode;
  side: Side;
  carrierId: string | null;
  targetId: string | null;
  pos: PitchPoint;
  height: number;
  from: PitchPoint;
  /** 패스·슛의 도착점 (비행 중에만 유효) */
  to: PitchPoint;
  t: number;
  dur: number;
  apex: number;
  /** 소유 후 남은 드리블 시간 */
  hold: number;
  /** 태클 판정 쿨다운 — 매 프레임 판정하면 공이 핑퐁이 된다 */
  duelCool: number;
  /**
   * 루즈볼을 쫓는 선수 (팀당 1명).
   * 압박 이동은 기준 위치에서의 비례 오프셋이라 공에 점근할 뿐 도달하지 못한다.
   * 그래서 최근접 선수만 예외적으로 공 위치를 그대로 목표로 삼는다.
   */
  chase: string[];
  /** 이미 개입한 득점 분 — 같은 골에 두 번 개입하지 않는다 */
  scriptedDone: number | null;
  seq: number;
}

export function createSim(): SimState {
  return {
    mode: "loose",
    side: "home",
    carrierId: null,
    targetId: null,
    pos: { x: 50, y: 50 },
    height: 0,
    from: { x: 50, y: 50 },
    to: { x: 50, y: 50 },
    t: 0,
    dur: 1,
    apex: 0,
    hold: 0,
    duelCool: 0,
    chase: [],
    scriptedDone: null,
    seq: 0,
  };
}

/* ───────────────────────── 결정론 난수 ───────────────────────── */

function rand(minute: number, seq: number, salt = 0): number {
  let h = (minute * 73856093) ^ (seq * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const dist = (a: PitchPoint, b: PitchPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** 홈 기준 y를 그 팀의 '전진 깊이'로 바꾼다 (0=자기 골문, 100=상대 골문) */
const depthFor = (side: Side, y: number) => (side === "home" ? y : 100 - y);
/** 전진 방향 부호 */
const fwdSign = (side: Side) => (side === "home" ? 1 : -1);

/* ───────────────────────── 역할별 움직임 ───────────────────────── */

const TACKLE_M = 3.2; // 피치 단위 (약 2.2m)
const PRESS_RANGE = 22;
/** 루즈볼을 잡을 수 있는 거리 — 이 안에 들어와야 소유가 된다 */
const PICKUP_R = 2.6;

/**
 * 선수 한 명의 목표 위치.
 *
 * 공 중심 이동을 역할별로 나눈다:
 *  GK  골문 앞을 지키며 공 좌우만 따라간다. 공이 멀면 라인을 올린다.
 *  DEF 라인을 맞춰 서고 볼사이드로 슬라이드. 풀백은 우리 공격 시 자기 사이드로 오버래핑.
 *  MID 공 근처에서 지원/압박. 소유 중엔 패스 각을 만들고, 아니면 공으로 달려든다.
 *  FWD 소유 중엔 상대 골문 쪽으로 침투해 폭을 벌리고, 아니면 전방에서 지연한다.
 */
export function roleTarget(
  p: SimPlayer,
  ball: PitchPoint,
  ctx: SimCtx,
  hasBall: boolean,
  chasing = false
): PitchPoint {
  // 루즈볼 추격자는 공까지 끝까지 간다 (비례 이동으로는 영원히 못 닿는다)
  if (chasing && p.group !== "GK") {
    return { x: clamp(ball.x, 3, 97), y: clamp(ball.y, 3, 97) };
  }

  // 득점 예정자는 골문 앞으로 — 기록된 골이 실제로 그 자리에서 나와야 한다
  if (ctx.scriptedScorerId === p.id && ctx.scriptedGoalMinute !== null) {
    const goalY = p.side === "home" ? 88 : 12;
    return { x: clamp(50 + (p.base.x - 50) * 0.35, 30, 70), y: goalY };
  }
  const { tactics } = ctx;
  const sign = fwdSign(p.side);
  const lineF = (tactics.line - 50) / 50;
  const widthF = (tactics.width - 50) / 50;
  const attackF = (tactics.attack - 50) / 50;
  const pressF = tactics.press / 100;

  let { x, y } = p.base;
  const ballDepth = depthFor(p.side, ball.y);
  const sideSign = ball.x - 50;

  if (p.group === "GK") {
    x = 50 + sideSign * 0.16;
    // 공이 멀수록 라인을 올린다 (스위퍼 키퍼)
    const advance = Math.max(0, ballDepth - 55) * 0.14;
    y = p.base.y + sign * advance;
    return { x: clamp(x, 30, 70), y: clamp(y, 2, 98) };
  }

  // 폭 조정은 공통
  x = 50 + (x - 50) * (1 + widthF * 0.4);
  // 볼사이드 슬라이드 — 전 라인 공통이지만 강도는 역할마다 다르다
  const slide = p.group === "DEF" ? 0.26 : p.group === "MID" ? 0.34 : 0.28;
  x += sideSign * slide;

  if (p.group === "DEF") {
    // 수비 라인 — 공 깊이에 따라 오르내린다
    const lineDepth = clamp(18 + lineF * 16 + (ballDepth - 50) * 0.28, 8, 62);
    y = p.base.y + sign * (lineDepth - depthFor(p.side, p.base.y)) * 0.55;
    // 풀백 오버래핑: 우리가 공을 갖고 공이 그 사이드 전방에 있을 때
    const isFullBack = p.role.toUpperCase() !== "CB";
    const sameSide = Math.sign(p.base.x - 50) === Math.sign(sideSign);
    if (hasBall && isFullBack && sameSide && ballDepth > 45) {
      y += sign * (12 + attackF * 8);
      x += sideSign * 0.18;
    }
  } else if (p.group === "MID") {
    if (hasBall) {
      // 패스 각을 만든다 — 공 쪽으로 붙되 너무 겹치지 않게
      const d = dist(p.base, ball);
      const pull = d > 26 ? 0.22 : 0.08;
      x += (ball.x - x) * pull;
      y += (ball.y - y) * pull;
      y += sign * attackF * 5;
    } else {
      // 압박 — 공에 가까울수록 강하게 달려든다
      const d = dist({ x, y }, ball);
      if (d < PRESS_RANGE) {
        const k = (0.18 + pressF * 0.34) * (1 - d / PRESS_RANGE);
        x += (ball.x - x) * k;
        y += (ball.y - y) * k;
      }
    }
  } else {
    // FWD
    if (hasBall) {
      // 뒷공간 침투 — 공이 올라올수록 더 깊이 뛴다
      const run = clamp((ballDepth - 40) * 0.35, 0, 22) * (1 + attackF * 0.5);
      y += sign * run;
      // 폭 유지 (측면 공격수는 벌리고 ST는 중앙)
      if (p.role.toUpperCase() !== "ST") x += Math.sign(p.base.x - 50) * (4 + widthF * 6);
    } else {
      // 수비 시엔 내려와 지연
      y -= sign * (6 - pressF * 4);
      const d = dist({ x, y }, ball);
      if (d < PRESS_RANGE * 0.7) {
        const k = 0.12 + pressF * 0.22;
        x += (ball.x - x) * k;
        y += (ball.y - y) * k;
      }
    }
  }

  return { x: clamp(x, 3, 97), y: clamp(y, 3, 97) };
}

/* ───────────────────────── 공 시뮬레이션 ───────────────────────── */

/** 소유 중 공은 발 앞에 붙어 있다 */
const FOOT_OFFSET = 1.1;

export interface StepResult {
  /** 이번 프레임에 소유가 넘어갔는가 (연출용) */
  turnover: boolean;
}

/**
 * 공 상태를 한 프레임 진행한다.
 * live에는 이번 프레임의 **실제 선수 위치**를 넘겨야 한다 — 그래야 공이 발에 붙는다.
 */
export function stepBall(
  s: SimState,
  dt: number,
  live: Map<string, PitchPoint>,
  ctx: SimCtx
): StepResult {
  const step = Math.min(dt, 0.05);
  s.duelCool = Math.max(0, s.duelCool - step);
  let turnover = false;

  const at = (id: string | null) => (id ? live.get(id) : undefined);
  const squad = (side: Side) => ctx.players.filter((p) => p.side === side && p.group !== "GK");

  // 소유자가 사라졌으면(교체 등) 다시 잡는다
  if (s.mode === "carry" && !at(s.carrierId)) s.mode = "loose";
  if (s.mode !== "loose") s.chase = [];

  /*
   * 대본 개입 — 기록된 골과 화면을 맞춘다.
   *
   * 자유 시뮬레이션만 돌리면 "23분 Foster 골"이 발표되는 순간 공은 반대편에 있고
   * Foster는 화면에도 없다. 기록을 재생하는 프로그램에서 그건 치명적이다.
   * 그래서 득점 예정 분에 딱 한 번, 득점자에게 공을 넘기고 골문 앞에 세운다.
   */
  if (
    ctx.scriptedGoalMinute !== null &&
    s.scriptedDone !== ctx.scriptedGoalMinute &&
    ctx.scriptedScorerId
  ) {
    const scorer = ctx.players.find((p) => p.id === ctx.scriptedScorerId);
    const sp = at(ctx.scriptedScorerId);
    if (scorer && sp) {
      s.scriptedDone = ctx.scriptedGoalMinute;
      s.mode = "carry";
      s.side = scorer.side;
      s.carrierId = scorer.id;
      s.targetId = null;
      s.pos = { ...sp };
      s.height = 0;
      // 짧게 잡았다가 곧바로 슛 — 세리머니 타이밍과 맞는다
      s.hold = 0.35;
      s.duelCool = 1.2; // 이 순간엔 뺏기지 않는다
      return { turnover: true };
    }
  }

  if (s.mode === "loose") {
    /*
     * 루즈볼 — 공은 그 자리에 있고 선수들이 달려온다.
     * 예전에는 '가장 가까운 선수'를 바로 소유자로 지정했는데, 그 선수가 멀리 있으면
     * 공이 발에서 떨어진 채 소유 표시만 뜨는 이상한 그림이 됐다.
     * 실제로 공에 닿아야(PICKUP_R) 소유가 된다.
     */
    s.height = Math.max(0, s.height - step * 6);

    // 팀당 최근접 1명을 추격자로 지정 — 다음 프레임에 공까지 달려간다
    const nearest: Record<Side, { id: string; d: number } | null> = { home: null, away: null };
    let best: SimPlayer | null = null;
    let bestD = Infinity;
    for (const p of ctx.players) {
      if (p.group === "GK") continue;
      const lp = at(p.id);
      if (!lp) continue;
      const raw = dist(lp, s.pos);
      const cur = nearest[p.side];
      if (!cur || raw < cur.d) nearest[p.side] = { id: p.id, d: raw };
      const bias = p.side === ctx.scriptedSide ? 0.8 : 1;
      const d = raw * bias;
      if (d < bestD) {
        bestD = raw;
        best = p;
      }
    }
    s.chase = [nearest.home?.id, nearest.away?.id].filter(Boolean) as string[];

    if (best && bestD < PICKUP_R) {
      s.mode = "carry";
      s.side = best.side;
      s.carrierId = best.id;
      s.targetId = null;
      s.hold = 0.5 + rand(ctx.minute, s.seq++, 3) * 0.7;
      s.height = 0;
      // 잡는 순간 공을 그 선수 발로 옮긴다
      const lp = at(best.id)!;
      s.pos = { ...lp };
    }
    return { turnover };
  }

  if (s.mode === "carry") {
    const carrier = ctx.players.find((p) => p.id === s.carrierId)!;
    const cp = at(s.carrierId)!;
    const sign = fwdSign(s.side);

    // 공은 소유자 발 앞에 붙는다 (전진 방향으로 살짝)
    s.pos = { x: cp.x, y: clamp(cp.y + sign * FOOT_OFFSET, 2, 98) };
    s.height = 0;
    s.hold -= step;

    // ── 태클 판정: 상대가 태클 거리에 들어오면 실제로 뺏긴다
    if (s.duelCool <= 0) {
      const opp = ctx.players.find((p) => {
        if (p.side === s.side || p.group === "GK") return false;
        const lp = at(p.id);
        return !!lp && dist(lp, cp) < TACKLE_M;
      });
      if (opp) {
        s.duelCool = 0.8;
        // 압박이 높을수록, 소유자 능력치가 낮을수록 잘 뺏긴다
        const p =
          0.24 + ctx.tactics.press / 100 * 0.3 + (opp.rating - carrier.rating) / 200;
        if (rand(ctx.minute, s.seq++, 11) < clamp(p, 0.05, 0.75)) {
          s.mode = "carry";
          s.side = opp.side;
          s.carrierId = opp.id;
          s.targetId = null;
          s.hold = 0.5 + rand(ctx.minute, s.seq++, 5) * 0.6;
          // 뺏은 선수 발로 공을 즉시 옮긴다 (안 그러면 한 프레임 동안 떨어져 보인다)
          s.pos = { ...at(opp.id)! };
          return { turnover: true };
        }
      }
    }

    if (s.hold > 0) return { turnover };

    // ── 다음 행동: 슛 또는 패스
    const depth = depthFor(s.side, s.pos.y);
    // 대본상 득점자가 공을 잡고 있으면 위치와 무관하게 반드시 슛한다
    const isScriptedScorer = !!ctx.scriptedScorerId && s.carrierId === ctx.scriptedScorerId;
    const wantShot =
      isScriptedScorer || (ctx.scriptedShot && ctx.scriptedSide === s.side && depth > 68);
    if (wantShot) {
      s.mode = "pass";
      s.from = { ...s.pos };
      s.pos = { ...s.pos };
      s.targetId = null; // 골문으로 — 아무도 받지 않는다
      // 골라인을 넘어 골망 안까지 보낸다 (선 앞에서 멈추면 들어간 게 안 보인다)
      const goalY = s.side === "home" ? 103 : -3;
      s.to = { x: 50 + (rand(ctx.minute, s.seq++, 7) - 0.5) * 9, y: goalY };
      s.dur = 0.62;
      s.apex = 1.1;
      s.t = 0;
      return { turnover };
    }

    // 패스 대상: 전진 + 적당한 거리 + 상대가 길목에 없는 선수
    const mates = squad(s.side).filter((p) => p.id !== s.carrierId);
    const opps = squad(s.side === "home" ? "away" : "home");
    let bestMate: SimPlayer | null = null;
    let bestScore = -Infinity;
    mates.forEach((m, i) => {
      const mp = at(m.id);
      if (!mp) return;
      const d = dist(cp, mp);
      if (d < 6 || d > 48) return;
      const forward = (depthFor(s.side, mp.y) - depth) / 100;
      // 패스 길목에 상대가 있으면 감점
      let blocked = 0;
      for (const o of opps) {
        const op = at(o.id);
        if (!op) continue;
        const t = ((op.x - cp.x) * (mp.x - cp.x) + (op.y - cp.y) * (mp.y - cp.y)) / (d * d);
        if (t < 0 || t > 1) continue;
        const px = cp.x + (mp.x - cp.x) * t;
        const py = cp.y + (mp.y - cp.y) * t;
        if (Math.hypot(op.x - px, op.y - py) < 4.5) blocked += 1;
      }
      const score =
        forward * 2.2 - blocked * 1.4 - Math.abs(d - 20) / 40 + rand(ctx.minute, s.seq + i, 13) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestMate = m;
      }
    });

    if (bestMate) {
      const mp = at((bestMate as SimPlayer).id)!;
      const d = dist(cp, mp);
      s.mode = "pass";
      s.from = { ...s.pos };
      s.to = { ...mp };
      s.targetId = (bestMate as SimPlayer).id;
      s.dur = clamp(d / 34, 0.28, 1.1);
      s.apex = d > 26 ? 1.6 + d * 0.06 : 0.12;
      s.t = 0;
      s.seq++;
    } else {
      // 받을 사람이 없으면 계속 드리블
      s.hold = 0.5;
    }
    return { turnover };
  }

  // ── pass / shot 비행 중
  s.t += step / s.dur;
  const t = Math.min(1, s.t);
  s.pos = {
    x: s.from.x + (s.to.x - s.from.x) * t,
    y: s.from.y + (s.to.y - s.from.y) * t,
  };
  s.height = 4 * s.apex * t * (1 - t);

  // 인터셉트 — 비행 중 상대가 공 근처에 있으면 끊는다
  if (s.duelCool <= 0 && t > 0.2 && t < 0.95 && s.height < 1.4) {
    for (const o of ctx.players) {
      if (o.side === s.side || o.group === "GK") continue;
      const op = at(o.id);
      if (op && dist(op, s.pos) < 2.6) {
        s.duelCool = 0.7;
        if (rand(ctx.minute, s.seq++, 17) < 0.45 + ctx.tactics.press / 100 * 0.25) {
          s.mode = "carry";
          s.side = o.side;
          s.carrierId = o.id;
          s.targetId = null;
          s.hold = 0.5;
          s.height = 0;
          s.pos = { ...op };
          return { turnover: true };
        }
        break;
      }
    }
  }

  if (t >= 1) {
    s.height = 0;
    if (s.targetId && at(s.targetId)) {
      s.mode = "carry";
      s.carrierId = s.targetId;
      // 패스가 날아가는 동안 수신자가 움직였을 수 있다 — 현재 위치로 맞춘다
      s.pos = { ...at(s.targetId)! };
      s.targetId = null;
      s.hold = 0.45 + rand(ctx.minute, s.seq++, 19) * 0.6;
    } else {
      // 슛/빗나간 패스 → 루즈볼
      s.mode = "loose";
      s.carrierId = null;
    }
  }
  return { turnover };
}
