import type { MatchData, Player, Tactics } from "./types";
import { pitchFrame, tacticFactors, type PitchPoint } from "./pitchPositions";

/**
 * 전술 분석 레이어 — 점유 히트맵 · 패스 네트워크.
 *
 * 두 레이어 모두 결정론적이다: 같은 (경기, 전술, 배치, 분)이면 항상 같은 결과가 나온다.
 * 시연 재현성이 이 앱의 핵심 원칙이라 난수를 쓰지 않는다.
 *
 * ⚠️ 데이터 성격
 *  - 히트맵: 엔진이 계산한 선수 위치를 분 단위로 누적한 것 → 앱 내부 모델의 산출물
 *  - 패스 네트워크: 실측 패스 데이터가 없으므로 배치·전술에서 유도한 **추정 모델**
 *    (UI에서 반드시 '추정'으로 표기한다 — provenance.ts와 동일한 원칙)
 */

/** 히트맵 격자 해상도 (폭 x 길이) */
export const HEAT_NX = 34;
export const HEAT_NY = 52;

export interface OccupancyResult {
  /** HEAT_NY * HEAT_NX, 0~1 정규화 */
  grid: Float32Array;
  /** 선수별 평균 위치 (패스 네트워크 노드) */
  avg: Map<string, PitchPoint>;
  /** 선수별 총 이동 거리(피치 단위) — 노드 크기/활동량 지표 */
  distance: Map<string, number>;
  samples: number;
}

/** 가우시안 스플랫 반경(격자 셀) */
const KERNEL = 3;

/**
 * 0분부터 upTo분까지 매 분 배치를 재계산해 점유를 누적한다.
 * playerId를 주면 그 선수만, 없으면 홈 필드 플레이어 전원.
 */
export function occupancy(params: {
  match: MatchData | undefined;
  players: Player[];
  tactics: Tactics;
  upTo: number;
  playerId?: string | null;
  includeGk?: boolean;
}): OccupancyResult {
  const { match, players, tactics, upTo, playerId = null, includeGk = false } = params;
  const grid = new Float32Array(HEAT_NX * HEAT_NY);
  const sum = new Map<string, { x: number; y: number; n: number }>();
  const distance = new Map<string, number>();
  const prev = new Map<string, PitchPoint>();

  const end = Math.max(0, Math.min(upTo, 130));
  let samples = 0;

  for (let m = 0; m <= end; m++) {
    // playing: true — 재생 중 드리프트를 포함한 '실제로 움직인' 궤적을 누적한다
    const frame = pitchFrame({ match, players, tactics, minute: m, playing: true });
    for (const placed of frame.home) {
      if (!includeGk && placed.gk) continue;
      if (playerId && placed.player.id !== playerId) continue;

      const { x, y } = placed.pos;
      splat(grid, x, y);
      samples++;

      const s = sum.get(placed.player.id) ?? { x: 0, y: 0, n: 0 };
      s.x += x;
      s.y += y;
      s.n++;
      sum.set(placed.player.id, s);

      const p = prev.get(placed.player.id);
      if (p) {
        distance.set(
          placed.player.id,
          (distance.get(placed.player.id) ?? 0) + Math.hypot(x - p.x, y - p.y)
        );
      }
      prev.set(placed.player.id, { x, y });
    }
  }

  // 0~1 정규화 (최댓값 기준)
  let max = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  if (max > 0) for (let i = 0; i < grid.length; i++) grid[i] /= max;

  const avg = new Map<string, PitchPoint>();
  sum.forEach((s, id) => avg.set(id, { x: s.x / s.n, y: s.y / s.n }));

  return { grid, avg, distance, samples };
}

/** 피치 좌표(0~100)를 격자에 가우시안으로 뿌린다 */
function splat(grid: Float32Array, px: number, py: number) {
  const cx = (px / 100) * (HEAT_NX - 1);
  const cy = (py / 100) * (HEAT_NY - 1);
  const x0 = Math.max(0, Math.floor(cx) - KERNEL);
  const x1 = Math.min(HEAT_NX - 1, Math.ceil(cx) + KERNEL);
  const y0 = Math.max(0, Math.floor(cy) - KERNEL);
  const y1 = Math.min(HEAT_NY - 1, Math.ceil(cy) + KERNEL);
  const twoSigmaSq = 2 * 1.6 * 1.6;

  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const dx = gx - cx;
      const dy = gy - cy;
      grid[gy * HEAT_NX + gx] += Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
    }
  }
}

/* ───────────────────────── 히트맵 색 계조 ───────────────────────── */

/**
 * 단일 색상(파랑) 시퀀셜 램프. 낮음 → 높음으로 명도와 알파가 함께 올라간다.
 *
 * 중계 방송의 무지개(파랑→초록→노랑→빨강) 히트맵을 쓰지 않는 이유:
 *  1) 무지개 램프는 값의 크기 순서를 색만 보고 복원할 수 없다
 *  2) 녹색 잔디 위의 적/녹 구간은 적록색약에서 잔디와 구분되지 않는다
 * 파랑 단일 계조는 녹색 표면 위에서 모든 색각 유형에 분리된다.
 */
const RAMP: { t: number; r: number; g: number; b: number; a: number }[] = [
  { t: 0.0, r: 22, g: 64, b: 122, a: 0 },
  { t: 0.18, r: 22, g: 64, b: 122, a: 0.34 },
  { t: 0.45, r: 47, g: 111, b: 196, a: 0.6 },
  { t: 0.75, r: 90, g: 163, b: 238, a: 0.8 },
  { t: 1.0, r: 203, g: 230, b: 255, a: 0.93 },
];

function rampAt(t: number) {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    const b = RAMP[i];
    if (v <= b.t) {
      const a = RAMP[i - 1];
      const k = (v - a.t) / (b.t - a.t || 1);
      return {
        r: Math.round(a.r + (b.r - a.r) * k),
        g: Math.round(a.g + (b.g - a.g) * k),
        b: Math.round(a.b + (b.b - a.b) * k),
        a: a.a + (b.a - a.a) * k,
      };
    }
  }
  const last = RAMP[RAMP.length - 1];
  return { r: last.r, g: last.g, b: last.b, a: last.a };
}

/**
 * 격자를 캔버스에 그린다. 저해상도 ImageData를 만든 뒤 스무딩 확대해
 * 셀 경계가 보이지 않는 부드러운 히트맵을 얻는다.
 *
 * 캔버스 0행 = 상대 골문(피치 y=100) — 잔디 텍스처와 같은 방향 규칙.
 */
export function paintHeatmap(canvas: HTMLCanvasElement, grid: Float32Array) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const small = document.createElement("canvas");
  small.width = HEAT_NX;
  small.height = HEAT_NY;
  const sctx = small.getContext("2d");
  if (!sctx) return;

  const img = sctx.createImageData(HEAT_NX, HEAT_NY);
  for (let gy = 0; gy < HEAT_NY; gy++) {
    const row = HEAT_NY - 1 - gy; // 피치 y가 클수록(상대 골문) 캔버스 위쪽
    for (let gx = 0; gx < HEAT_NX; gx++) {
      const c = rampAt(grid[gy * HEAT_NX + gx]);
      const o = (row * HEAT_NX + gx) * 4;
      img.data[o] = c.r;
      img.data[o + 1] = c.g;
      img.data[o + 2] = c.b;
      img.data[o + 3] = Math.round(c.a * 255);
    }
  }
  sctx.putImageData(img, 0, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
}

/** 범례용 색상 스톱 (UI에서 그라디언트로 표시) */
export function heatLegendStops(): string[] {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const c = rampAt(t);
    return `rgba(${c.r},${c.g},${c.b},${c.a.toFixed(2)})`;
  });
}

/* ───────────────────────── 패스 네트워크 (추정 모델) ───────────────────────── */

export interface PassLink {
  from: string;
  to: string;
  a: PitchPoint;
  b: PitchPoint;
  /** 0~1 정규화 강도 */
  weight: number;
}

export interface PassNode {
  id: string;
  pos: PitchPoint;
  /** 0~1 — 연결 총량(패스 관여도) */
  involvement: number;
  num: number;
  gk: boolean;
}

export interface PassNetwork {
  links: PassLink[];
  nodes: PassNode[];
}

/**
 * 평균 위치 · 전술 성향에서 패스 연결 강도를 유도한다.
 *
 * ⚠️ 실측 패스 이벤트가 아니다. 거리 감쇠 + 전진 성향 + 템포로 만든 추정 모델이며,
 * StatsBomb 패스 이벤트가 들어오면 이 함수만 교체하면 된다.
 */
export function passNetwork(params: {
  players: Player[];
  avg: Map<string, PitchPoint>;
  tactics: Tactics;
  maxLinks?: number;
}): PassNetwork {
  const { players, avg, tactics, maxLinks = 20 } = params;
  const { attackF } = tacticFactors(tactics);

  const pts = players
    .map((p) => ({ p, pos: avg.get(p.id), gk: p.role.toUpperCase() === "GK" }))
    .filter((n): n is { p: Player; pos: PitchPoint; gk: boolean } => !!n.pos);

  // 템포가 빠를수록 짧은 패스 위주 → 감쇠 폭을 좁힌다
  const sigma = 26 - (tactics.tempo / 100) * 8;
  const raw: PassLink[] = [];

  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i];
      const b = pts[j];
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
      let w = Math.exp(-(d * d) / (2 * sigma * sigma));

      // 전진 패스 성향: 공격 성향이 높을수록 앞쪽 연결에 가중
      const forward = Math.abs(b.pos.y - a.pos.y);
      w *= 1 + attackF * 0.3 * Math.min(1, forward / 30);

      // GK는 수비 라인과만 유의미하게 연결된다
      if (a.gk || b.gk) {
        const deepest = Math.min(a.pos.y, b.pos.y);
        w *= deepest < 35 ? 0.75 : 0.04;
      }

      raw.push({ from: a.p.id, to: b.p.id, a: a.pos, b: b.pos, weight: w });
    }
  }

  raw.sort((x, y) => y.weight - x.weight);
  const links = raw.slice(0, maxLinks);
  const max = links[0]?.weight ?? 1;
  for (const l of links) l.weight = max > 0 ? l.weight / max : 0;

  // 관여도 = 연결 강도 합
  const inv = new Map<string, number>();
  for (const l of links) {
    inv.set(l.from, (inv.get(l.from) ?? 0) + l.weight);
    inv.set(l.to, (inv.get(l.to) ?? 0) + l.weight);
  }
  let invMax = 0;
  inv.forEach((v) => (invMax = Math.max(invMax, v)));

  const nodes: PassNode[] = pts.map((n) => ({
    id: n.p.id,
    pos: n.pos,
    involvement: invMax > 0 ? (inv.get(n.p.id) ?? 0) / invMax : 0,
    num: n.p.num,
    gk: n.gk,
  }));

  return { links, nodes };
}
