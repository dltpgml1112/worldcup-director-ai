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

  /**
   * 벤치 드래그 교체 상태.
   * 스토어에 두면 2D 보드·3D 뷰·벤치 스트립이 prop 없이 같은 드래그를 공유한다.
   */
  benchDrag: string | null; // 끌고 있는 벤치 선수 id
  subTarget: string | null; // 현재 조준 중인 필드 선수 id

  /** 상세 카드를 띄울 선수 id (양 팀 모두 가능) */
  selectedPlayer: string | null;
  setSelectedPlayer: (id: string | null) => void;

  /**
   * 감독이 직접 옮긴 선수들.
   * 이 선수들은 전술 슬라이더의 배치 변형을 받지 않고 놓은 자리를 지킨다 —
   * "내 마음대로 배치"가 성립하려면 수동 배치가 자동 계산보다 우선해야 한다.
   * 포메이션/프리셋을 바꾸면 초기화된다.
   */
  manualPositions: string[];
  clearManualPositions: () => void;

  setLang: (l: Lang) => void;
  setLegendMode: (v: boolean) => void;
  startBenchDrag: (benchId: string) => void;
  setSubTarget: (playerId: string | null) => void;
  /** 조준한 선수가 있으면 교체 실행. 반환값은 실제 교체 여부 */
  dropBenchDrag: () => boolean;
  cancelBenchDrag: () => void;
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
  benchDrag: null,
  subTarget: null,
  selectedPlayer: null,
  manualPositions: [],

  setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),
  clearManualPositions: () => set({ manualPositions: [] }),

  setLang: (lang) => set({ lang }),

  setLegendMode: (legendMode) => set({ legendMode }),

  startBenchDrag: (benchId) => set({ benchDrag: benchId, subTarget: null }),

  setSubTarget: (playerId) => set((s) => (s.benchDrag ? { subTarget: playerId } : {})),

  dropBenchDrag: () => {
    const { benchDrag, subTarget, makeSub } = get();
    if (!benchDrag || !subTarget) {
      set({ benchDrag: null, subTarget: null });
      return false;
    }
    const before = get().subsUsed;
    makeSub(subTarget, benchDrag);
    const done = get().subsUsed > before;
    set({ benchDrag: null, subTarget: null });
    return done;
  },

  cancelBenchDrag: () => set({ benchDrag: null, subTarget: null }),

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
      manualPositions: [],
      selectedPlayer: null,
    });
  },

  // 포메이션을 새로 적용하면 수동 배치는 버린다 (그게 '새 배치를 적용'의 의미다)
  setFormation: (f) =>
    set((s) => ({ formation: f, players: applyFormation(s.players, f), manualPositions: [] })),

  setTactic: (k, v) => set((s) => ({ tactics: { ...s.tactics, [k]: v } })),

  applyAdvice: ({ formation, tactics }) =>
    set((s) => ({
      formation: formation ?? s.formation,
      players: formation ? applyFormation(s.players, formation) : s.players,
      tactics: tactics ? { ...s.tactics, ...tactics } : s.tactics,
      manualPositions: formation ? [] : s.manualPositions,
    })),

  setPlayerPos: (id, x, y) =>
    set((s) => ({
      players: s.players.map((p) => (p.id === id ? { ...p, x, y } : p)),
      // 직접 옮긴 선수로 기록 — 이후 전술 변형이 이 자리를 덮어쓰지 않는다
      manualPositions: s.manualPositions.includes(id)
        ? s.manualPositions
        : [...s.manualPositions, id],
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
