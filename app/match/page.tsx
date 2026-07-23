"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt, simulateAlternate } from "@/lib/matchEngine";
import Scoreboard from "@/components/Scoreboard";
import StatBars from "@/components/StatBars";
import MomentumBar from "@/components/MomentumBar";
import WinProbChart from "@/components/WinProbChart";
import EventFeed from "@/components/EventFeed";
import TacticalPitch from "@/components/TacticalPitch";
import TacticalControls from "@/components/TacticalControls";
import AICoachPanel from "@/components/AICoachPanel";

export default function MatchPage() {
  const coachName = useGame((s) => s.coachName);
  const matchId = useGame((s) => s.matchId);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const speed = useGame((s) => s.speed);
  const tactics = useGame((s) => s.tactics);
  const formation = useGame((s) => s.formation);
  const { togglePlay, setSpeed, tick, resetClock, setMinute } = useGame();

  const match = getMatch(matchId);
  const end = match?.timeline[match.timeline.length - 1]?.minute ?? 90;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => tick(), Math.max(60, 1000 / speed));
    return () => clearInterval(id);
  }, [playing, speed, tick]);

  if (!match) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Link href="/" className="btn-primary">Back to start</Link>
      </main>
    );
  }

  const snap = snapshotAt(match, minute, tactics);
  const alt = simulateAlternate(match, tactics);
  const goalNow = match.timeline.find((e) => e.minute === minute && e.type === "goal");

  return (
    <main className="min-h-screen px-4 py-4 lg:px-6">
      {/* 상단 바 */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="chip bg-white/5 text-white/70 hover:bg-white/10">← Home</Link>
        <div className="text-center">
          <div className="font-display text-sm font-bold uppercase tracking-widest text-white/80">
            Director: <span className="text-neon-grass">{coachName}</span>
          </div>
        </div>
        <div className="chip bg-white/5 text-white/60">{formation} · Live</div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* 좌: 방송 그래픽 */}
        <div className="space-y-4 xl:col-span-4">
          <Scoreboard match={match} snap={snap} />
          <WinProbChart match={match} tactics={tactics} minute={minute} />
          <MomentumBar momentum={snap.momentum} homeCode={match.home.code} awayCode={match.away.code} />
          <StatBars match={match} snap={snap} />
          <AlternateHistory realScore={match.finalScore} altScore={alt.score} altWin={alt.homeWinProb} narrative={match.realNarrative} />
        </div>

        {/* 중: 택티컬 보드 + 재생 */}
        <div className="space-y-4 xl:col-span-4">
          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">Tactical Board</span>
              <span className="text-[10px] text-white/40">drag players to reposition</span>
            </div>
            <TacticalPitch />
          </div>

          {/* 재생 컨트롤 */}
          <div className="glass-strong rounded-2xl p-4">
            <input
              type="range"
              min={0}
              max={end}
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="mb-3 w-full"
            />
            <div className="flex items-center justify-between gap-2">
              <button onClick={resetClock} className="chip bg-white/5 text-white/70 hover:bg-white/10">⟲ Restart</button>
              <button onClick={togglePlay} className="btn-primary !py-2 !text-base">
                <span className="relative z-10">{playing ? "❚❚ Pause" : "▶ Play"}</span>
              </button>
              <div className="flex items-center gap-1">
                {[3, 6, 12].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`rounded-lg px-2 py-1 text-xs font-bold ${speed === s ? "bg-neon-grass text-night-900" : "bg-white/5 text-white/60"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 우: 커맨더리 + AI 코치 + 컨트롤 */}
        <div className="space-y-4 xl:col-span-4">
          <AICoachPanel match={match} snap={snap} tactics={tactics} formation={formation} />
          <TacticalControls />
          <EventFeed match={match} minute={minute} />
        </div>
      </div>

      {/* 골 세리머니 오버레이 */}
      <AnimatePresence>
        {goalNow && (
          <motion.div
            key={`goal-${minute}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
          >
            <div className="absolute inset-0 bg-night-900/60" />
            <motion.div
              initial={{ scale: 0.6, rotate: -6 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              className="relative text-center"
            >
              <div className="font-display text-7xl font-bold uppercase tracking-tight text-neon-gold drop-shadow-[0_0_30px_rgba(255,213,74,0.7)] sm:text-9xl">
                Goal!
              </div>
              <div className="mt-2 text-xl font-semibold text-white">{goalNow.detail}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function AlternateHistory({
  realScore,
  altScore,
  altWin,
  narrative,
}: {
  realScore: [number, number];
  altScore: [number, number];
  altWin: number;
  narrative: string;
}) {
  const changed = realScore[0] !== altScore[0] || realScore[1] !== altScore[1];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">🦋</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">Alternate History</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Real History</div>
          <div className="font-display text-3xl font-bold tabular-nums">{realScore[0]}–{realScore[1]}</div>
        </div>
        <div className="rounded-xl border border-neon-grass/40 bg-neon-grass/10 p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-neon-grass">Your History</div>
          <div className="font-display text-3xl font-bold tabular-nums text-neon-grass">{altScore[0]}–{altScore[1]}</div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-white/60">
        Your tactics project a <span className="font-bold text-neon-grass">{altWin}%</span> win probability.
        {changed ? " History rewritten." : " Same result — for now."}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/40">{narrative}</p>
    </div>
  );
}
