import type { MatchData, Player, Side, Tactics } from "./types";
import { snapshotAt } from "./matchEngine";

/**
 * 2D 보드와 3D 뷰가 공유하는 배치 계산.
 *
 * 좌표계(절대 피치 좌표, 홈팀 기준):
 *   x = 0(좌측 터치라인) ~ 100(우측 터치라인)
 *   y = 0(우리 골문) ~ 100(상대 골문)
 * 2D는 top = 100 - y로 화면에 투영하고, 3D는 toWorld()로 미터 단위로 변환한다.
 * 두 뷰가 같은 함수를 쓰기 때문에 뷰를 전환해도 선수/공 위치가 어긋나지 않는다.
 */

/** 실제 경기장 규격(m) — 3D 씬의 기준 */
export const PITCH = { length: 105, width: 68 };

export interface PitchPoint {
  x: number;
  y: number;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 절대 피치 좌표 → three.js 월드 좌표(m). 공격 방향은 -Z */
export function toWorld(p: PitchPoint): { x: number; z: number } {
  return {
    x: ((p.x - 50) / 100) * PITCH.width,
    z: ((50 - p.y) / 100) * PITCH.length,
  };
}

/** three.js 월드 좌표 → 절대 피치 좌표 (드래그 레이캐스트용) */
export function fromWorld(wx: number, wz: number): PitchPoint {
  return {
    x: (wx / PITCH.width) * 100 + 50,
    y: 50 - (wz / PITCH.length) * 100,
  };
}

/**
 * 어느 팀이 공을 가지고 있는지.
 *
 * 최근 이벤트의 팀을 그대로 쓰면 점유가 거의 바뀌지 않는다 — 타임라인이 한쪽 팀
 * 이벤트로 치우쳐 있으면 상대가 공을 잡는 장면이 아예 안 나온다.
 * 그래서 이벤트 직후 2분만 그 팀에 고정하고, 그 외에는 기세로 편향된 교대 파형을 쓴다.
 * (난수가 아니라 분의 함수라 재현성은 유지된다)
 */
export function possessionOf(
  match: MatchData | undefined,
  minute: number,
  momentum: number
): Side {
  const last = match ? [...match.timeline].reverse().find((e) => e.minute <= minute) : undefined;
  if (last && last.type !== "whistle" && minute - last.minute <= 2) {
    // 슈팅/코너/골 직후엔 그 팀이 계속 몰아친다고 본다
    return last.side;
  }
  // 약 8분 주기로 교대하되, 기세를 잡은 쪽이 더 오래 점유한다
  const wave = Math.sin(minute * 0.8) + Math.sin(minute * 0.31 + 2.1) * 0.5;
  return wave + clamp(momentum / 100, -1, 1) * 0.65 >= 0 ? "home" : "away";
}

/** 공 목표 위치 — 재생 전/정지 시 정중앙, 재생 중엔 최근 이벤트 기반 위치 */
export function ballTarget(
  match: MatchData | undefined,
  minute: number,
  momentum: number,
  playing: boolean
): PitchPoint {
  if (!match || !playing || minute <= 0) return { x: 50, y: 50 };
  let y = 50 + momentum * 0.28; // 기세: 홈 우위 → 상대 골문 쪽
  // 좌우로 전개되는 폭을 실제 경기처럼 넓게 — 두 개의 주기를 겹쳐 단조로운 왕복을 깬다
  let x = 50 + Math.sin(minute * 0.9) * 16 + Math.sin(minute * 0.37 + 1.1) * 9;
  const last = [...match.timeline].reverse().find((e) => e.minute <= minute);
  if (last) {
    const home = last.side === "home";
    switch (last.type) {
      case "goal":
        y = home ? 93 : 7;
        x = 50;
        break;
      case "shot":
        y = home ? 80 : 20;
        break;
      case "chance":
        y = home ? 70 : 30;
        break;
      case "corner":
        y = home ? 88 : 12;
        x = 86;
        break;
      case "whistle":
        y = 50;
        x = 50;
        break;
    }
  }
  return { x: clamp(x, 8, 92), y: clamp(y, 5, 95) };
}

/** 최근 이벤트 종류 — 3D에서 공의 높이(로빙/슛 궤적)를 결정 */
export function ballFlight(match: MatchData | undefined, minute: number, playing: boolean): number {
  if (!match || !playing || minute <= 0) return 0.11;
  const last = [...match.timeline].reverse().find((e) => e.minute <= minute);
  if (!last) return 0.11;
  if (last.type === "goal") return 1.4;
  if (last.type === "shot") return 1.0;
  if (last.type === "corner") return 2.2;
  return 0.11;
}

/** 재생 중 선수 드리프트(살아있는 움직임) — 결정론적, 분+인덱스 기반 */
export function drift(seed: number, minute: number, roleGk: boolean): { dx: number; dy: number } {
  const amp = roleGk ? 0.6 : 3.6;
  const dx = Math.sin(minute * 0.4 + seed * 1.7) * amp;
  const dy = Math.cos(minute * 0.33 + seed * 2.3) * (roleGk ? 0.5 : 3.1);
  return { dx, dy };
}

/** 전술 슬라이더 계수 (-1 ~ +1) */
export function tacticFactors(tactics: Tactics) {
  return {
    widthF: (tactics.width - 50) / 50, // -1(좁게) ~ +1(넓게)
    lineF: (tactics.line - 50) / 50, // -1(깊게) ~ +1(높게)
    attackF: (tactics.attack - 50) / 50, // -1(신중) ~ +1(총공격)
  };
}

/** 전술값을 반영한 기준 위치 (드래그 좌표 위에 얹는 변형) */
export function tacticBase(p: Player, tactics: Tactics): PitchPoint {
  if (p.role.toUpperCase() === "GK") return { x: p.x, y: p.y };
  const { widthF, lineF, attackF } = tacticFactors(tactics);
  // 폭: 중앙에서 좌우로 벌리거나 좁힘 (측면 선수일수록 크게)
  const x = 50 + (p.x - 50) * (1 + widthF * 0.4);
  // 라인: 블록 전체 상하 + 공격 성향은 전방 선수를 더 끌어올림
  let y = p.y + lineF * 7;
  if (p.y > 55) y += attackF * 6;
  else if (p.y < 30) y += Math.min(0, lineF * 3); // 수비는 라인 낮출 때만 내려감
  return { x: clamp(x, 5, 95), y: clamp(y, 5, 95) };
}

export interface PlacedPlayer {
  player: Player;
  pos: PitchPoint;
  gk: boolean;
}

export interface PitchFrame {
  home: PlacedPlayer[];
  away: PlacedPlayer[];
  ball: PitchPoint;
  ballHeight: number;
  momentum: number;
  /** 홈 수비 라인 y (오프사이드/블록 오버레이용) */
  homeLine: number;
  /** 상대 최종 수비 라인 y */
  awayLine: number;
  live: boolean;
  /** 공 점유 팀 */
  possession: Side;
  /**
   * 공 반응을 적용하기 **전**의 배치.
   * 3D 뷰는 이 기준 위에 매 프레임 실제 공 위치로 반응을 다시 계산한다
   * (분 단위로 굳은 좌표를 쓰면 화면의 공과 어긋난다).
   */
  homeBase: PlacedPlayer[];
  awayBase: PlacedPlayer[];
}

/**
 * 공 중심 팀 이동 (ball-oriented shifting).
 *
 * 실제 경기에서 블록 전체는 공을 기준으로 움직인다. 이 함수가 없으면 선수들이
 * 공과 무관하게 제자리에서 흔들리기만 해서 '전술 보드'가 아니라 '배치도'로 보인다.
 *
 *  1) 볼사이드 횡이동 — 블록 전체가 공 쪽으로 슬라이드, 반대편 선수는 안으로 좁힌다
 *  2) 종압축 — 공 높이 쪽으로 팀 간격을 줄인다
 *  3) 압박 수렴 — 공에 가장 가까운 2명이 강하게 달라붙는다 (수비 팀이 더 강함)
 *  4) 침투 — 공을 가진 팀이 최종 3분의 1에 들어가면 전방 선수가 골문 쪽으로 뛴다
 *  5) GK — 공 좌우를 따라가고, 공이 멀면 라인을 나온다
 */
export interface ReactionInput {
  id: string;
  pos: PitchPoint;
  gk: boolean;
}

export interface ReactionOpts {
  press: number;
  hasBall: boolean;
  attackingUp: boolean;
}

/** 공에 반응해 실제로 달라붙는 인원 수 */
const CONVERGING = 3;

/**
 * 기준 배치 → 공 반응 후 좌표. 오프셋이 아니라 결과 좌표를 돌려준다.
 *
 * 3D 뷰는 이 함수를 **매 프레임 실제 공 위치로** 호출한다. 분 단위로 계산하면
 * 선수가 화면의 공이 아니라 보이지 않는 앵커로 수렴해서 '공을 따라간다'로 보이지 않는다.
 */
export function ballReactionPositions(
  players: ReactionInput[],
  ball: PitchPoint,
  opts: ReactionOpts
): Map<string, PitchPoint> {
  const { press, hasBall, attackingUp } = opts;
  const sideSign = ball.x - 50;
  const result = new Map<string, PitchPoint>();

  // 공까지 거리 순위 (필드 플레이어만) — 압박/지원 인원 선정
  const ranked = players
    .filter((p) => !p.gk)
    .map((p) => ({ id: p.id, d: Math.hypot(p.pos.x - ball.x, p.pos.y - ball.y) }))
    .sort((a, b) => a.d - b.d);
  const closest = new Map<string, number>();
  ranked.slice(0, CONVERGING).forEach((r, rank) => closest.set(r.id, rank));

  // 공을 뺏으러 가는 팀이 더 강하게 수렴한다
  const pressGain = (hasBall ? 0.20 : 0.38) + (press / 100) * (hasBall ? 0.08 : 0.30);

  for (const p of players) {
    let { x, y } = p.pos;

    if (p.gk) {
      x += sideSign * 0.12;
      // 공이 우리 골문에서 멀면 골키퍼가 라인을 올린다 (스위퍼 키퍼)
      const ballDepth = attackingUp ? ball.y : 100 - ball.y;
      if (ballDepth > 65) y += (attackingUp ? 1 : -1) * Math.min(6, (ballDepth - 65) * 0.22);
      result.set(p.id, { x: clamp(x, 5, 95), y: clamp(y, 2, 98) });
      continue;
    }

    // 1) 볼사이드 횡이동 + 반대편 좁히기
    x += sideSign * 0.34;
    if (Math.sign(x - 50) !== Math.sign(sideSign) && sideSign !== 0) {
      x += sideSign * 0.16;
    }

    // 2) 종압축
    y += (ball.y - y) * 0.08;

    // 3) 압박/지원 수렴 — 가까운 순서대로 약해진다
    const rank = closest.get(p.id);
    if (rank !== undefined) {
      const k = pressGain * [1, 0.62, 0.34][rank];
      x += (ball.x - x) * k;
      y += (ball.y - y) * k;
    }

    // 4) 최종 3분의 1 침투
    if (hasBall) {
      const ballDepth = attackingUp ? ball.y : 100 - ball.y;
      const playerDepth = attackingUp ? y : 100 - y;
      if (ballDepth > 66 && playerDepth > 58) {
        y += (attackingUp ? 1 : -1) * 5;
      }
    }

    result.set(p.id, { x: clamp(x, 3, 97), y: clamp(y, 3, 97) });
  }

  return result;
}

function applyBallReaction(
  placed: PlacedPlayer[],
  ball: PitchPoint,
  opts: ReactionOpts
): PlacedPlayer[] {
  const moved = ballReactionPositions(
    placed.map((p) => ({ id: p.player.id, pos: p.pos, gk: p.gk })),
    ball,
    opts
  );
  return placed.map((p) => ({ ...p, pos: moved.get(p.player.id) ?? p.pos }));
}

/**
 * 한 프레임(= 특정 분)의 전체 배치를 계산한다.
 * dragId가 지정된 선수는 커서 정확도를 위해 전술 변형/드리프트를 적용하지 않는다.
 */
export function pitchFrame(params: {
  match: MatchData | undefined;
  players: Player[];
  tactics: Tactics;
  minute: number;
  playing: boolean;
  dragId?: string | null;
  /**
   * 분 단위 드리프트를 생략한다.
   * 3D 뷰는 매 프레임 연속 시간으로 드리프트를 다시 주기 때문에, 여기서 분 단위로
   * 한 번 더 흔들면 배속에서 선수가 순간이동하는 것처럼 보인다.
   */
  smoothDrift?: boolean;
  /** 감독이 직접 옮긴 선수 — 전술 변형을 적용하지 않고 놓은 자리를 유지한다 */
  manualIds?: Set<string>;
}): PitchFrame {
  const {
    match, players, tactics, minute, playing,
    dragId = null, smoothDrift = false, manualIds,
  } = params;
  const momentum = match ? snapshotAt(match, minute, tactics).momentum : 0;
  const homeShift = clamp(momentum * 0.06, -7, 7);
  const awayShift = clamp(-momentum * 0.06, -7, 7);
  const live = playing && minute > 0;

  const ball = ballTarget(match, minute, momentum, playing);
  const possession = possessionOf(match, minute, momentum);

  const home: PlacedPlayer[] = players.map((p, i) => {
    const gk = p.role.toUpperCase() === "GK";
    /*
     * 감독이 직접 옮긴 선수는 그 자리를 그대로 지킨다.
     * 이전에는 드롭한 뒤 tacticBase()가 좌표를 다시 계산해서 선수가 딴 데로 튀었고,
     * "위치 변경이 안 먹힌다"로 느껴졌다. 수동 배치가 전술 변형보다 우선한다.
     */
    const manual = dragId === p.id || manualIds?.has(p.id);
    const b = manual ? { x: p.x, y: p.y } : tacticBase(p, tactics);
    if (!live || dragId === p.id) return { player: p, pos: b, gk };
    const { dx, dy } = smoothDrift ? { dx: 0, dy: 0 } : drift(i, minute, gk);
    return {
      player: p,
      pos: { x: clamp(b.x + dx, 3, 97), y: clamp(b.y + homeShift - dy, 3, 96) },
      gk,
    };
  });

  // 상대는 자기 골문이 y=100 쪽 — 절대 좌표로 뒤집어 보관
  const away: PlacedPlayer[] = (match?.awayXI ?? []).map((p, i) => {
    const gk = p.role.toUpperCase() === "GK";
    const base = { x: 100 - p.x, y: 100 - p.y };
    if (!live) return { player: p, pos: base, gk };
    const { dx, dy } = smoothDrift ? { dx: 0, dy: 0 } : drift(i + 20, minute, gk);
    return {
      player: p,
      pos: { x: clamp(base.x + dx, 3, 97), y: clamp(base.y - awayShift - dy, 3, 97) },
      gk,
    };
  });

  // 공 중심 이동은 재생 중에만 — 정지 상태에서는 편집한 배치를 그대로 보여준다.
  // 드래그 중인 선수는 커서를 정확히 따라야 하므로 반응에서 제외한다.
  const homeFinal = live
    ? applyBallReaction(home, ball, {
        press: tactics.press,
        hasBall: possession === "home",
        attackingUp: true,
      }).map((p, i) => (dragId && p.player.id === dragId ? home[i] : p))
    : home;

  const awayFinal = live
    ? applyBallReaction(away, ball, {
        press: tactics.press,
        hasBall: possession === "away",
        attackingUp: false,
      })
    : away;

  const outfieldHome = homeFinal.filter((h) => !h.gk);
  const outfieldAway = awayFinal.filter((a) => !a.gk);

  return {
    home: homeFinal,
    away: awayFinal,
    ball,
    ballHeight: ballFlight(match, minute, playing),
    momentum,
    homeLine: outfieldHome.length ? Math.min(...outfieldHome.map((h) => h.pos.y)) : 20,
    awayLine: outfieldAway.length ? Math.max(...outfieldAway.map((a) => a.pos.y)) : 80,
    live,
    possession,
    homeBase: home,
    awayBase: away,
  };
}

/** 볼록껍질 (Andrew monotone chain) — 팀 블록/컴팩트니스 폴리곤용 */
export function convexHull(points: PitchPoint[]): PitchPoint[] {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: PitchPoint, a: PitchPoint, b: PitchPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: PitchPoint[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: PitchPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** 팀 컴팩트니스(선수 간 평균 거리 기반, 0~100 — 높을수록 촘촘) */
export function compactness(placed: PlacedPlayer[]): number {
  const pts = placed.filter((p) => !p.gk).map((p) => p.pos);
  if (pts.length < 2) return 0;
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const spread =
    pts.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length;
  return Math.round(clamp(100 - spread * 2.6, 0, 100));
}
