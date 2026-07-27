import * as THREE from "three";
import { PITCH } from "./pitchPositions";

/**
 * 3D 씬에서 쓰는 텍스처를 캔버스로 직접 생성한다.
 * 외부 이미지/폰트 파일에 의존하지 않으므로 오프라인 시연에서도 그대로 뜬다.
 */

/** 잔디 바깥 여백(m) — 터치라인 밖 잔디 */
export const TURF_MARGIN = 6;
const TURF_W = PITCH.width + TURF_MARGIN * 2;
const TURF_L = PITCH.length + TURF_MARGIN * 2;
const PX_PER_M = 16;

const cache = new Map<string, THREE.Texture>();

function memo(key: string, make: () => THREE.Texture): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = make();
  cache.set(key, tex);
  return tex;
}

function canvas2d(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

/**
 * 잔디 + 라인 마킹 텍스처.
 * 라인을 개별 메시로 만들지 않고 한 장의 텍스처에 그려 드로우콜을 아낀다.
 */
export function turfTexture(): THREE.Texture {
  return memo("turf", () => {
    const W = Math.round(TURF_W * PX_PER_M);
    const H = Math.round(TURF_L * PX_PER_M);
    const { c, ctx } = canvas2d(W, H);

    // 월드 좌표(m) → 캔버스 픽셀. 캔버스 위쪽이 상대 골문(-Z)
    const X = (m: number) => (m + PITCH.width / 2 + TURF_MARGIN) * PX_PER_M;
    const Z = (m: number) => (m + PITCH.length / 2 + TURF_MARGIN) * PX_PER_M;
    const S = (m: number) => m * PX_PER_M;

    // 잔디 베이스
    ctx.fillStyle = "#1d3a28";
    ctx.fillRect(0, 0, W, H);

    // 잔디 깎은 줄무늬 (길이 방향 8분할)
    const bands = 8;
    const bandH = S(PITCH.length) / bands;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#22452e" : "#1b3725";
      ctx.fillRect(X(-PITCH.width / 2), Z(-PITCH.length / 2) + i * bandH, S(PITCH.width), bandH + 1);
    }

    // 미세한 노이즈로 단조로움 제거
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "#39603f" : "#12281c";
      ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
    }
    ctx.globalAlpha = 1;

    // 라인 마킹
    ctx.strokeStyle = "rgba(238,244,250,0.82)";
    ctx.lineWidth = Math.max(2, S(0.14));
    const rect = (x: number, z: number, w: number, l: number) =>
      ctx.strokeRect(X(x), Z(z), S(w), S(l));

    // 터치라인 · 골라인
    rect(-PITCH.width / 2, -PITCH.length / 2, PITCH.width, PITCH.length);
    // 하프라인
    ctx.beginPath();
    ctx.moveTo(X(-PITCH.width / 2), Z(0));
    ctx.lineTo(X(PITCH.width / 2), Z(0));
    ctx.stroke();
    // 센터서클 + 스팟
    ctx.beginPath();
    ctx.arc(X(0), Z(0), S(9.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(238,244,250,0.82)";
    ctx.beginPath();
    ctx.arc(X(0), Z(0), S(0.3), 0, Math.PI * 2);
    ctx.fill();

    // 양쪽 페널티 박스 / 골 에어리어 / 페널티 스팟 / D
    for (const sign of [-1, 1] as const) {
      const goalLine = (sign * PITCH.length) / 2;
      // 페널티 에어리어 16.5m x 40.32m
      rect(-20.16, sign === -1 ? goalLine : goalLine - 16.5, 40.32, 16.5);
      // 골 에어리어 5.5m x 18.32m
      rect(-9.16, sign === -1 ? goalLine : goalLine - 5.5, 18.32, 5.5);
      // 페널티 스팟 (골라인에서 11m)
      const spotZ = goalLine - sign * 11;
      ctx.beginPath();
      ctx.arc(X(0), Z(spotZ), S(0.3), 0, Math.PI * 2);
      ctx.fill();
      // 페널티 아크 (박스 밖 부분만)
      const arcStart = sign === -1 ? -Math.PI * 0.705 : Math.PI * 0.295;
      ctx.beginPath();
      ctx.arc(X(0), Z(spotZ), S(9.15), arcStart, arcStart + Math.PI * 0.41);
      ctx.stroke();
    }

    // 코너 아크
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        ctx.beginPath();
        ctx.arc(
          X((sx * PITCH.width) / 2),
          Z((sz * PITCH.length) / 2),
          S(1),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  });
}

/** 골네트 격자 (알파 텍스처) */
export function netTexture(): THREE.Texture {
  return memo("net", () => {
    const { c, ctx } = canvas2d(64, 64);
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i <= 64; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 64);
      ctx.moveTo(0, i);
      ctx.lineTo(64, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

/** 선수 발밑 그림자 (라디얼 그라디언트) */
export function shadowTexture(): THREE.Texture {
  return memo("shadow", () => {
    const { c, ctx } = canvas2d(128, 128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.6, "rgba(0,0,0,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  });
}

/** 축구공 패턴 */
export function ballTexture(): THREE.Texture {
  return memo("ball", () => {
    const { c, ctx } = canvas2d(256, 128);
    ctx.fillStyle = "#f7f9fc";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#1a1f27";
    const spots: [number, number, number][] = [
      [30, 30, 13],
      [96, 20, 11],
      [160, 34, 12],
      [222, 26, 11],
      [62, 78, 12],
      [128, 66, 14],
      [194, 82, 12],
      [30, 112, 10],
      [160, 112, 10],
    ];
    for (const [x, y, r] of spots) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export interface LabelOptions {
  num: number;
  name: string;
  color: string;
  textColor?: string;
  legend?: boolean;
  dim?: boolean;
}

/** 선수 번호 뱃지 + 이름 빌보드 (한글 폰트는 브라우저 기본 렌더링 사용) */
export function labelTexture(o: LabelOptions): THREE.Texture {
  const key = `label:${o.num}:${o.name}:${o.color}:${o.legend ? 1 : 0}:${o.dim ? 1 : 0}`;
  return memo(key, () => {
    const W = 320;
    const H = 180;
    const { c, ctx } = canvas2d(W, H);
    const cx = W / 2;

    // 번호 뱃지
    const r = 46;
    const cy = 56;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = o.color;
    ctx.globalAlpha = o.dim ? 0.85 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 6;
    ctx.strokeStyle = o.legend ? "#c98500" : "rgba(255,255,255,0.92)";
    ctx.stroke();

    ctx.fillStyle = o.textColor ?? "#ffffff";
    ctx.font = "bold 58px system-ui, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(o.num), cx, cy + 3);

    // 이름 라벨
    ctx.font = "600 40px system-ui, 'Segoe UI', 'Malgun Gothic', sans-serif";
    const name = o.name.length > 10 ? `${o.name.slice(0, 9)}…` : o.name;
    const tw = ctx.measureText(name).width;
    const bw = Math.min(W - 8, tw + 28);
    ctx.fillStyle = "rgba(8,11,15,0.78)";
    ctx.beginPath();
    const bx = cx - bw / 2;
    const by = 118;
    const bh = 50;
    const rad = 10;
    ctx.moveTo(bx + rad, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, rad);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, rad);
    ctx.arcTo(bx, by + bh, bx, by, rad);
    ctx.arcTo(bx, by, bx + bw, by, rad);
    ctx.fill();
    ctx.fillStyle = "#e8ecf1";
    ctx.fillText(name, cx, by + bh / 2 + 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** 관중석 좌석 패턴 (어두운 계단 + 좌석 점) */
export function standTexture(): THREE.Texture {
  return memo("stand", () => {
    const { c, ctx } = canvas2d(128, 128);
    ctx.fillStyle = "#0f141b";
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 6; y < 128; y += 12) {
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.fillRect(0, y, 128, 5);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export function disposeTextures() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}
