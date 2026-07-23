"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt, simulateAlternate } from "@/lib/matchEngine";
import { startCrowd, stopCrowd, setCrowdLevel, goalRoar } from "@/lib/audio";
import { t, type Lang } from "@/lib/i18n";
import type { Player } from "@/lib/types";
import LangToggle from "@/components/LangToggle";
import GoalCelebration from "@/components/GoalCelebration";
import PlayerCard from "@/components/PlayerCard";
import Scoreboard from "@/components/Scoreboard";
import StatBars from "@/components/StatBars";
import MomentumBar from "@/components/MomentumBar";
import WinProbChart from "@/components/WinProbChart";
import EventFeed from "@/components/EventFeed";
import TacticalPitch from "@/components/TacticalPitch";
import TacticalControls from "@/components/TacticalControls";
import AICoachPanel from "@/components/AICoachPanel";
import SubstitutionPanel from "@/components/SubstitutionPanel";
import PostMatchReport from "@/components/PostMatchReport";

export default function MatchPage() {
  const coachName = useGame((s) => s.coachName);
  const matchId = useGame((s) => s.matchId);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const speed = useGame((s) => s.speed);
  const tactics = useGame((s) => s.tactics);
  const formation = useGame((s) => s.formation);
  const sound = useGame((s) => s.sound);
  const setSound = useGame((s) => s.setSound);
  const lang = useGame((s) => s.lang);
  const { togglePlay, setSpeed, tick, resetClock, setMinute } = useGame();

  const [reportOpen, setReportOpen] = useState(false);
  const reportShownFor = useRef<number>(-1);

  const match = getMatch(matchId);
  const end = match?.timeline[match.timeline.length - 1]?.minute ?? 90;
  const isFT = minute >= end;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => tick(), Math.max(60, 1000 / speed));
    return () => clearInterval(id);
  }, [playing, speed, tick]);

  // 사운드 토글 → 크라우드 앰비언스 시작/정지
  useEffect(() => {
    if (sound) startCrowd();
    else stopCrowd();
    return () => stopCrowd();
  }, [sound]);

  // 전-경기 리셋 시 리포트 상태 초기화
  useEffect(() => {
    if (minute === 0) {
      setReportOpen(false);
      reportShownFor.current = -1;
    }
  }, [minute]);

  // 크라우드 웅성거림을 모멘텀에 연동
  useEffect(() => {
    if (!sound || !match) return;
    const s = snapshotAt(match, minute, tactics);
    setCrowdLevel(Math.abs(s.momentum));
  }, [sound, match, minute, tactics]);

  // 골 발생 시 함성
  useEffect(() => {
    if (!match || !sound) return;
    const goal = match.timeline.find((e) => e.minute === minute && e.type === "goal");
    if (goal) goalRoar();
  }, [minute, match, sound]);

  // 풀타임 도달 시 리포트 자동 오픈 (한 번만)
  useEffect(() => {
    if (isFT && reportShownFor.current !== end) {
      reportShownFor.current = end;
      setReportOpen(true);
    }
  }, [isFT, end]);

  if (!match) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Link href="/" className="btn-primary">{t(lang, "common.home")}</Link>
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
        <Link href="/" className="chip bg-white/5 text-white/70 hover:bg-white/10">{t(lang, "common.home")}</Link>
        <div className="text-center">
          <div className="font-display text-sm font-bold uppercase tracking-widest text-white/80">
            {t(lang, "common.director")}: <span className="text-neon-grass">{coachName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFT && (
            <button onClick={() => setReportOpen(true)} className="chip bg-neon-gold/20 text-neon-gold hover:bg-neon-gold/30">
              {t(lang, "play.report")}
            </button>
          )}
          <button
            onClick={() => setSound(!sound)}
            className={`chip transition ${sound ? "bg-neon-grass/20 text-neon-grass" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
            title="Crowd ambience"
          >
            {sound ? "🔊" : "🔇"} {t(lang, "play.sound")}
          </button>
          <div className="chip bg-white/5 text-white/60">{formation} · {t(lang, "common.live")}</div>
          <LangToggle />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* 좌: 방송 그래픽 */}
        <div className="space-y-4 xl:col-span-4">
          <Scoreboard match={match} snap={snap} />
          <WinProbChart match={match} tactics={tactics} minute={minute} />
          <MomentumBar momentum={snap.momentum} homeCode={match.home.code} awayCode={match.away.code} />
          <StatBars match={match} snap={snap} />
          <AlternateHistory
            lang={lang}
            realScore={match.finalScore}
            altScore={alt.score}
            altWin={alt.homeWinProb}
            narrative={lang === "ko" && match.realNarrativeKo ? match.realNarrativeKo : match.realNarrative}
          />
        </div>

        {/* 중: 택티컬 보드 + 재생 */}
        <div className="space-y-4 xl:col-span-4">
          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">{t(lang, "board.title")}</span>
              <span className="text-[10px] text-white/40">{t(lang, "board.hint")}</span>
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
              <button onClick={resetClock} className="chip bg-white/5 text-white/70 hover:bg-white/10">{t(lang, "play.restart")}</button>
              <button onClick={togglePlay} className="btn-primary !py-2 !text-base">
                <span className="relative z-10">{playing ? t(lang, "play.pause") : t(lang, "play.play")}</span>
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

          <SubstitutionPanel />
        </div>

        {/* 우: 커맨더리 + AI 코치 + 컨트롤 */}
        <div className="space-y-4 xl:col-span-4">
          <AICoachPanel match={match} snap={snap} tactics={tactics} formation={formation} />
          <TacticalControls />
          <EventFeed match={match} minute={minute} />
        </div>
      </div>

      {/* 경기 후 리포트 */}
      <PostMatchReport
        match={match}
        snap={snap}
        tactics={tactics}
        alt={alt}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />

      {/* 골 세리머니 (컨페티 + 방사형 플래시) */}
      <GoalCelebration goal={goalNow} minute={minute} lang={lang} />

      {/* 교체 투입 선수 카드 공개 (FUT 팩 오픈 느낌) */}
      <SubReveal lang={lang} flag={match.home.flag} />
    </main>
  );
}

/** 교체로 방금 투입된 선수의 FUT 카드를 잠깐 공개 */
function SubReveal({ lang, flag }: { lang: Lang; flag: string }) {
  const players = useGame((s) => s.players);
  const subLog = useGame((s) => s.subLog);
  const [reveal, setReveal] = useState<Player | null>(null);
  const prevLen = useRef(subLog.length);

  useEffect(() => {
    if (subLog.length > prevLen.current) {
      const last = subLog[subLog.length - 1];
      const p = players.find((pl) => pl.num === last.onNum && pl.name === last.onName) ?? null;
      if (p) {
        setReveal(p);
        const id = setTimeout(() => setReveal(null), 2800);
        return () => clearTimeout(id);
      }
    }
    prevLen.current = subLog.length;
  }, [subLog, players]);

  return (
    <AnimatePresence>
      {reveal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[55] grid place-items-center"
          onClick={() => setReveal(null)}
        >
          <div className="absolute inset-0 bg-night-900/70" />
          <motion.div
            initial={{ scale: 0.6, rotateY: 90, opacity: 0 }}
            animate={{ scale: 1, rotateY: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
            className="relative"
          >
            <div className="mb-2 text-center font-display text-sm font-bold uppercase tracking-widest text-neon-grass">
              {lang === "ko" ? "🔁 교체 투입" : "🔁 SUBSTITUTION"}
            </div>
            <PlayerCard player={reveal} lang={lang} flag={flag} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AlternateHistory({
  lang,
  realScore,
  altScore,
  altWin,
  narrative,
}: {
  lang: Lang;
  realScore: [number, number];
  altScore: [number, number];
  altWin: number;
  narrative: string;
}) {
  const changed = realScore[0] !== altScore[0] || realScore[1] !== altScore[1];
  const winLine =
    lang === "ko"
      ? `당신의 전술은 `
      : `Your tactics project a `;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">🦋</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">{t(lang, "alt.title")}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-white/40">{t(lang, "alt.real")}</div>
          <div className="font-display text-3xl font-bold tabular-nums">{realScore[0]}–{realScore[1]}</div>
        </div>
        <div className="rounded-xl border border-neon-grass/40 bg-neon-grass/10 p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-neon-grass">{t(lang, "alt.your")}</div>
          <div className="font-display text-3xl font-bold tabular-nums text-neon-grass">{altScore[0]}–{altScore[1]}</div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-white/60">
        {winLine}<span className="font-bold text-neon-grass">{altWin}%</span>{lang === "ko" ? " 승리 확률을 만듭니다." : " win probability."}
        {changed ? ` ${t(lang, "alt.rewritten")}` : ` ${t(lang, "alt.same")}`}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/40">{narrative}</p>
    </div>
  );
}
