import { create } from "zustand";
import type { FormationKey, Player, Tactics } from "./types";
import type { Lang } from "./i18n";
import { DEFAULT_TACTICS } from "./matchEngine";
import { applyFormation } from "./formations";
import { getMatch } from "@/data/matches";

const DEFAULT_MATCH = "kor-rsa-2026";

export interface SubLogEntry {
  minute: number;
  offName: string;
  offNameKo?: string;
  offNum: number;
  onName: string;
  onNameKo?: string;
  onNum: number;
}

interface GameState {
  coachName: string;
  matchId: string;
  formation: FormationKey;
  tactics: Tactics;
  players: Player[]; // 사용자(홈) 팀 배치 (편집 가능)
  bench: Player[]; // 교체 후보
  subsUsed: number;
  subLog: SubLogEntry[];
  minute: number;
  playing: boolean;
  speed: number; // 분/초
  sound: boolean;
  lang: Lang;
  /** 역대 스타(가상 편성) 벤치 노출 여부. 기본 OFF = 현역 선수만 (분석 도구 모드) */
  legendMode: boolean;

  setLang: (l: Lang) => void;
  setLegendMode: (v: boolean) => void;
  setup: (p: { coachName: string; matchId: string }) => void;
  setFormation: (f: FormationKey) => void;
  setTactic: <K extends keyof Tactics>(k: K, v: Tactics[K]) => void;
  applyAdvice: (advice: { formation?: FormationKey; tactics?: Partial<Tactics> }) => void;
  setPlayerPos: (id: string, x: number, y: number) => void;
  makeSub: (offId: string, onId: string) => void;
  setSound: (v: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setMinute: (m: number) => void;
  tick: () => void;
  resetClock: () => void;
}

const MAX_SUBS = 5;

export const useGame = create<GameState>((set, get) => ({
  coachName: "",
  matchId: DEFAULT_MATCH,
  formation: "433",
  tactics: { ...DEFAULT_TACTICS },
  players: getMatch(DEFAULT_MATCH)?.homeXI ?? [],
  bench: getMatch(DEFAULT_MATCH)?.homeBench ?? [],
  subsUsed: 0,
  subLog: [],
  minute: 0,
  playing: false,
  speed: 6,
  sound: false,
  lang: "ko",
  legendMode: false,

  setLang: (lang) => set({ lang }),

  setLegendMode: (legendMode) => set({ legendMode }),

  setup: ({ coachName, matchId }) => {
    const match = getMatch(matchId);
    set({
      coachName,
      matchId,
      players: match ? match.homeXI.map((p) => ({ ...p, onAt: 0 })) : [],
      bench: match?.homeBench ? match.homeBench.map((p) => ({ ...p })) : [],
      subsUsed: 0,
      subLog: [],
      minute: 0,
      playing: false,
      formation: "433",
      tactics: { ...DEFAULT_TACTICS },
    });
  },

  setFormation: (f) => set((s) => ({ formation: f, players: applyFormation(s.players, f) })),

  setTactic: (k, v) => set((s) => ({ tactics: { ...s.tactics, [k]: v } })),

  applyAdvice: ({ formation, tactics }) =>
    set((s) => ({
      formation: formation ?? s.formation,
      players: formation ? applyFormation(s.players, formation) : s.players,
      tactics: tactics ? { ...s.tactics, ...tactics } : s.tactics,
    })),

  setPlayerPos: (id, x, y) =>
    set((s) => ({
      players: s.players.map((p) => (p.id === id ? { ...p, x, y } : p)),
    })),

  makeSub: (offId, onId) =>
    set((s) => {
      if (s.subsUsed >= MAX_SUBS) return {} as Partial<GameState>;
      const off = s.players.find((p) => p.id === offId);
      const on = s.bench.find((p) => p.id === onId);
      if (!off || !on) return {} as Partial<GameState>;
      // 레전드 모드가 꺼져 있으면 가상 편성 선수는 투입 불가 (UI를 우회한 호출 방어)
      if (on.legend && !s.legendMode) return {} as Partial<GameState>;
      const incoming: Player = { ...on, x: off.x, y: off.y, role: off.role, onAt: s.minute };
      return {
        players: s.players.map((p) => (p.id === offId ? incoming : p)),
        bench: s.bench.filter((p) => p.id !== onId),
        subsUsed: s.subsUsed + 1,
        subLog: [
          ...s.subLog,
          {
            minute: s.minute,
            offName: off.name,
            offNameKo: off.nameKo,
            offNum: off.num,
            onName: on.name,
            onNameKo: on.nameKo,
            onNum: on.num,
          },
        ],
      };
    }),

  setSound: (sound) => set({ sound }),

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
  setMinute: (minute) => set({ minute }),

  tick: () => {
    const { minute, matchId } = get();
    const match = getMatch(matchId);
    const end = match?.timeline[match.timeline.length - 1]?.minute ?? 90;
    if (minute >= end) {
      set({ playing: false });
      return;
    }
    set({ minute: minute + 1 });
  },

  resetClock: () => set({ minute: 0, playing: false }),
}));
