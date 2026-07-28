export type Side = "home" | "away";

export interface Team {
  id: string;
  name: string;
  nameKo: string;
  code: string; // 3-letter
  flag: string; // emoji
  primary: string;
  secondary: string;
}

export interface Player {
  id: string;
  name: string;
  nameKo?: string;
  num: number;
  role: string; // GK, CB, LB, CM, RW ...
  x: number; // 0-100 (pitch width)
  y: number; // 0-100 (own goal 0 -> opponent goal 100)
  rating: number; // 0-100
  stamina: number; // 0-100 (초기값; 실시간 소모는 lib/stamina.ts에서 계산)
  onAt?: number; // 교체 투입된 분 (선발은 0)
  /**
   * 역대 스타 = 실제 스쿼드가 아닌 가상 편성.
   * 기본(분석 도구 모드)에서는 벤치에 노출되지 않고, '레전드 모드'를 켠 경우에만 등장한다.
   * 실측/가상을 구조적으로 분리하기 위한 플래그 — 현역 선수에는 절대 붙이지 않는다.
   */
  legend?: boolean;
}

export type EventType =
  | "goal"
  | "shot"
  | "save"
  | "chance"
  | "corner"
  | "card"
  | "sub"
  | "whistle";

export interface MatchEvent {
  minute: number;
  side: Side;
  type: EventType;
  player?: string;
  detail: string;
  detailKo?: string;
  xg?: number;
  /** type: "card"일 때 카드 색 */
  card?: "yellow" | "red";
}

export type FormationKey = "433" | "4231" | "352" | "343" | "541";

export interface Tactics {
  attack: number; // 0-100
  line: number; // defensive line height 0-100
  press: number; // 0-100
  tempo: number; // 0-100
  width: number; // 0-100
  counter: boolean;
  highPress: boolean;
  offsideTrap: boolean;
}

export interface MatchData {
  id: string;
  year: number;
  stage: string;
  venue: string;
  home: Team;
  away: Team;
  homeXI: Player[];
  awayXI: Player[];
  homeBench?: Player[]; // 사용자(홈) 교체 후보
  timeline: MatchEvent[];
  finalScore: [number, number]; // regulation/ET
  penalties?: [number, number];
  realNarrative: string;
  realNarrativeKo?: string;
  weakFlank: "left" | "right"; // opponent's vulnerable side (for AI coach demo)
  dataSource?: "real" | "scenario"; // 'scenario' = 실측 아님(가상 시나리오)
}
