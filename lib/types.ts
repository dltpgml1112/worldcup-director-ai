export type Side = "home" | "away";

export interface Team {
  id: string;
  name: string;
  code: string; // 3-letter
  flag: string; // emoji
  primary: string;
  secondary: string;
}

export interface Player {
  id: string;
  name: string;
  num: number;
  role: string; // GK, CB, LB, CM, RW ...
  x: number; // 0-100 (pitch width)
  y: number; // 0-100 (own goal 0 -> opponent goal 100)
  rating: number; // 0-100
  stamina: number; // 0-100
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
  xg?: number;
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
  timeline: MatchEvent[];
  finalScore: [number, number]; // regulation/ET
  penalties?: [number, number];
  realNarrative: string;
  weakFlank: "left" | "right"; // opponent's vulnerable side (for AI coach demo)
}
