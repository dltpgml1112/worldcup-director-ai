import { create } from "zustand";
import type { FormationKey, Player, Tactics } from "./types";
import { DEFAULT_TACTICS } from "./matchEngine";
import { applyFormation } from "./formations";
import { getMatch } from "@/data/matches";

interface GameState {
  coachName: string;
  matchId: string;
  formation: FormationKey;
  tactics: Tactics;
  players: Player[]; // 사용자(홈) 팀 배치 (편집 가능)
  minute: number;
  playing: boolean;
  speed: number; // 분/초

  setup: (p: { coachName: string; matchId: string }) => void;
  setFormation: (f: FormationKey) => void;
  setTactic: <K extends keyof Tactics>(k: K, v: Tactics[K]) => void;
  setPlayerPos: (id: string, x: number, y: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setMinute: (m: number) => void;
  tick: () => void;
  resetClock: () => void;
}

export const useGame = create<GameState>((set, get) => ({
  coachName: "",
  matchId: "final-2022",
  formation: "433",
  tactics: { ...DEFAULT_TACTICS },
  players: getMatch("final-2022")?.homeXI ?? [],
  minute: 0,
  playing: false,
  speed: 6,

  setup: ({ coachName, matchId }) => {
    const match = getMatch(matchId);
    set({
      coachName,
      matchId,
      players: match ? [...match.homeXI] : [],
      minute: 0,
      playing: false,
      formation: "433",
      tactics: { ...DEFAULT_TACTICS },
    });
  },

  setFormation: (f) => set((s) => ({ formation: f, players: applyFormation(s.players, f) })),

  setTactic: (k, v) => set((s) => ({ tactics: { ...s.tactics, [k]: v } })),

  setPlayerPos: (id, x, y) =>
    set((s) => ({
      players: s.players.map((p) => (p.id === id ? { ...p, x, y } : p)),
    })),

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
