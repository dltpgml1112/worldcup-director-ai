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
  /** 주장 완장 */
  captain?: boolean;
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

/**
 * 데이터 출처 — 화면에 상시 표기된다 (lib/provenance.ts).
 *  real      실제로 열린 경기의 실측 이벤트
 *  simulated 대진(상대·라운드)은 실측이지만 그 경기 자체는 열린 적 없음 → 내용은 시뮬레이션
 *  scenario  가상 시나리오
 */
export type DataSource = "real" | "simulated" | "scenario";

export interface MatchData {
  id: string;
  year: number;
  stage: string;
  stageKo?: string;
  venue: string;
  venueKo?: string;
  /** 킥오프 일자 (YYYY-MM-DD) */
  kickoff?: string;
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
  dataSource?: DataSource;
  /**
   * 이 경기 타임라인의 한계를 한 줄로. 데이터출처 패널에 그대로 노출된다.
   * 예) 스코어·득점자는 실측이지만 개별 슛의 시각·슈터는 공개 자료에 없어 총계에 맞춰 재구성함.
   */
  timelineNote?: string;
  timelineNoteKo?: string;
  /**
   * 실제 경기에서 홈이었던 쪽.
   *
   * 엔진은 "사용자 팀 = home 슬롯"으로 고정돼 있어서(store.ts, postMatch.ts), 실제로는
   * 원정이었던 경기도 사용자 팀을 home 슬롯에 넣는다. 그러면 스코어보드가 실제 홈/원정을
   * 거꾸로 표시하게 되므로, 진짜 홈이 어느 슬롯인지를 여기 따로 남겨 표기에만 쓴다.
   * 생략하면 home 슬롯이 실제 홈.
   */
  actualHome?: Side;
  /** 포메이션 표기 (실제 그 경기에서 쓴 대형) */
  homeShape?: string;
  awayShape?: string;
}
