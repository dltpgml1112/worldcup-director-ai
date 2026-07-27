import type { MatchData, Player, Tactics } from "./types";
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

/** 공 목표 위치 — 재생 전/정지 시 정중앙, 재생 중엔 최근 이벤트 기반 위치 */
export function ballTarget(
  match: MatchData | undefined,
  minute: number,
  momentum: number,
  playing: boolean
): PitchPoint {
  if (!match || !playing || minute <= 0) return { x: 50, y: 50 };
  let y = 50 + momentum * 0.28; // 기세: 홈 우위 → 상대 골문 쪽
  let x = 50 + Math.sin(minute * 0.9) * 7;
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
}): PitchFrame {
  const { match, players, tactics, minute, playing, dragId = null } = params;
  const momentum = match ? snapshotAt(match, minute, tactics).momentum : 0;
  const homeShift = clamp(momentum * 0.06, -7, 7);
  const awayShift = clamp(-momentum * 0.06, -7, 7);
  const live = playing && minute > 0;

  const home: PlacedPlayer[] = players.map((p, i) => {
    const gk = p.role.toUpperCase() === "GK";
    const b = dragId === p.id ? { x: p.x, y: p.y } : tacticBase(p, tactics);
    if (!live || dragId === p.id) return { player: p, pos: b, gk };
    const { dx, dy } = drift(i, minute, gk);
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
    const { dx, dy } = drift(i + 20, minute, gk);
    return {
      player: p,
      pos: { x: clamp(base.x + dx, 3, 97), y: clamp(base.y - awayShift - dy, 3, 97) },
      gk,
    };
  });

  const outfieldHome = home.filter((h) => !h.gk);
  const outfieldAway = away.filter((a) => !a.gk);

  return {
    home,
    away,
    ball: ballTarget(match, minute, momentum, playing),
    ballHeight: ballFlight(match, minute, playing),
    momentum,
    homeLine: outfieldHome.length ? Math.min(...outfieldHome.map((h) => h.pos.y)) : 20,
    awayLine: outfieldAway.length ? Math.max(...outfieldAway.map((a) => a.pos.y)) : 80,
    live,
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
