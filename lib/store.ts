import { create } from "zustand";
import type { FormationKey, Player, Tactics } from "./types";
import type { Lang } from "./i18n";
import { DEFAULT_TACTICS } from "./matchEngine";
import { applyFormation } from "./formations";
import { getMatch, registerMatch, KOREA, KOR_2026, KOR_2026_BENCH } from "@/data/matches";
import { CAMPAIGN_ROUNDS } from "@/data/wc2026";
import {
  REAL_OPENER_ID,
  FIRST_ROUND_ID,
  buildRoundMatch,
  outcomeOf,
  passesRound,
  type RoundResult,
} from "./campaign";

const DEFAULT_MATCH = REAL_OPENER_ID;

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

  /* ── 캠페인 (다시 쓰는 2026) ── */
  /**
   * 현재 라운드. null이면 출발점인 A조 3차전(남아공전, 실측 경기)이다.
   * 32강부터는 CAMPAIGN_ROUNDS의 id가 들어간다.
   */
  roundId: string | null;
  campaignResults: RoundResult[];
  /** 탈락 여부 — 진 순간 캠페인이 끝난다 (실제 역사대로) */
  eliminated: boolean;
  /** 결승까지 이기고 끝냈는가 */
  champion: boolean;
  /** 현재 라운드 결과를 기록하고, 이겼으면 다음 라운드로 넘어간다 */
  finishRound: () => void;
  /** 현재 라운드를 지금 전술로 다시 생성해 처음부터 (감독의 재도전) */
  replayRound: () => void;
  /** 캠페인을 처음부터 */
  resetCampaign: () => void;

  setLang: (l: Lang) => void;
  setLegendMode: (v: boolean) => void;
  startBenchDrag: (benchId: string) => void;
  setSubTarget: (playerId: string | null) => void;
  /** 조준한 선수가 있으면 교체 실행. 반환값은 실제 교체 여부 */
  dropBenchDrag: () => boolean;
  cancelBenchDrag: () => void;
  /** matchId를 생략하면 캠페인 시작, 주면 그 실측 경기만 단독 재생 */
  setup: (p: { coachName: string; matchId?: string }) => void;
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

/** 남아공전에서 한국이 실제로 쓴 대형 */
const KOREA_SHAPE = "3-4-3";

/** 라운드 순서: A조 3차전 → 32강 → 16강 → 8강 → 4강 → 결승 */
function nextRoundId(current: string | null): string | null {
  const i = CAMPAIGN_ROUNDS.findIndex((r) => r.id === current);
  return i >= 0 ? CAMPAIGN_ROUNDS[i + 1]?.id ?? null : null;
}

/**
 * 라운드 하나를 적재한다.
 *
 * 매 경기는 실제 선발 11명 + 완전한 벤치로 새로 시작한다 — 경기 사이에 선수는 회복하고
 * 교체 카드도 리셋되는 게 맞다. 감독이 이어가는 것은 전술이지 지친 다리가 아니다.
 *
 * 32강부터는 열린 적 없는 경기라 이 시점에 타임라인을 생성한다. 생성에 쓰이는 것은
 * **지금의 전술과 라인업**이라, 감독의 선택이 곧 경기 내용이 된다.
 */
function loadRound(roundId: string, tactics: Tactics, xiOverride?: Player[]) {
  const baseXI = xiOverride ?? KOR_2026;
  const baseBench = KOR_2026_BENCH;

  const round = CAMPAIGN_ROUNDS.find((r) => r.id === roundId) ?? CAMPAIGN_ROUNDS[0];
  const match = buildRoundMatch({
    round,
    korea: KOREA,
    koreaXI: baseXI,
    koreaBench: baseBench,
    koreaShape: KOREA_SHAPE,
    tactics,
  });
  registerMatch(match);
  const matchId = match.id;

  return {
    roundId: round.id,
    matchId,
    players: baseXI.map((p) => ({ ...p, onAt: 0, stamina: 100 })),
    bench: baseBench.map((p) => ({ ...p })),
    subsUsed: 0,
    subLog: [],
    minute: 0,
    playing: false,
    manualPositions: [],
    selectedPlayer: null,
  };
}

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

  roundId: null,
  campaignResults: [],
  eliminated: false,
  champion: false,

  setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),
  clearManualPositions: () => set({ manualPositions: [] }),

  /*
   * 경기가 끝났다. 결과를 기록하고 진출/탈락을 가른다.
   *
   * 지면 캠페인이 거기서 끝난다 — 그게 실제로 일어난 일이기 때문이다. 다만 감독에게는
   * replayRound()가 있어서, 전술을 바꿔 같은 경기를 다시 치를 수 있다.
   */
  finishRound: () =>
    set((s) => {
      const match = getMatch(s.matchId);
      const round = CAMPAIGN_ROUNDS.find((r) => r.id === s.roundId);
      // 캠페인이 아닌 단독 재생이면 아무 일도 하지 않는다
      if (!match || !round) return {} as Partial<GameState>;
      // 이미 기록한 라운드면 중복 기록하지 않는다
      if (s.campaignResults.some((r) => r.roundId === round.id)) return {} as Partial<GameState>;

      const result: RoundResult = {
        roundId: round.id,
        score: match.finalScore,
        penalties: match.penalties,
        outcome: outcomeOf(match.finalScore),
      };
      const results = [...s.campaignResults, result];

      if (!passesRound(round, result)) return { campaignResults: results, eliminated: true };

      const next = nextRoundId(s.roundId);
      if (next === null) return { campaignResults: results, champion: true };

      return { campaignResults: results, ...loadRound(next, s.tactics) };
    }),

  replayRound: () =>
    set((s) => {
      if (!s.roundId) return {} as Partial<GameState>;
      // 감독이 옮겨놓은 배치 그대로 다시 뛴다 — 그게 '전술을 바꿔 재도전'의 의미다
      return { ...loadRound(s.roundId, s.tactics, s.players), eliminated: false };
    }),

  resetCampaign: () =>
    set((s) => ({
      ...loadRound(FIRST_ROUND_ID, s.tactics),
      campaignResults: [],
      eliminated: false,
      champion: false,
      tactics: { ...DEFAULT_TACTICS },
      formation: "433",
    })),

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

  /**
   * 경기 시작.
   *  - matchId 없이 부르면 **캠페인 시작** (A조 3차전 남아공전부터)
   *  - matchId를 주면 그 실측 경기만 단독 재생 (2022·2018 결승 다시보기)
   */
  setup: ({ coachName, matchId }) => {
    if (!matchId) {
      set({
        coachName,
        ...loadRound(FIRST_ROUND_ID, DEFAULT_TACTICS),
        campaignResults: [],
        eliminated: false,
        champion: false,
        // 남아공전에서 한국이 실제로 쓴 대형
        formation: "343",
        tactics: { ...DEFAULT_TACTICS },
      });
      return;
    }

    const match = getMatch(matchId);
    set({
      coachName,
      matchId,
      roundId: null,
      campaignResults: [],
      eliminated: false,
      champion: false,
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
