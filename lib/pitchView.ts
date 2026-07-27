/**
 * 3D 뷰 설정 타입/상수.
 * Pitch3D는 next/dynamic으로 지연 로드되므로, 부모가 참조하는 값은
 * three.js를 import하지 않는 이 모듈에 둔다 (three가 메인 번들에 딸려오지 않도록).
 */

export type CamKey = "behind" | "broadcast" | "tactical" | "touchline";

export const CAM_KEYS: CamKey[] = ["behind", "broadcast", "tactical", "touchline"];

/** 절대 피치 좌표 기준 카메라 위치/타깃 (m) */
export const CAM_PRESETS: Record<CamKey, { pos: [number, number, number]; target: [number, number, number] }> = {
  behind: { pos: [0, 20, 84], target: [0, 0, -6] },
  broadcast: { pos: [62, 32, 34], target: [0, 0, 0] },
  tactical: { pos: [0, 104, 22], target: [0, 0, 0] },
  touchline: { pos: [48, 6.5, 30], target: [0, 1.5, -10] },
};

export interface OverlayFlags {
  /** 양 팀 수비 라인 */
  line: boolean;
  /** 공 주변 압박 존 */
  press: boolean;
  /** 우리 팀 블록(볼록껍질) */
  block: boolean;
  /** 선수별 영향권 */
  influence: boolean;
}
