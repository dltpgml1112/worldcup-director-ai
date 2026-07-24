"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt, simulateAlternate } from "@/lib/matchEngine";
import { startCrowd, stopCrowd, setCrowdLevel, goalRoar } from "@/lib/audio";
import { t, type Lang } from "@/lib/i18n";
import type { MatchEvent } from "@/lib/types";
import LangToggle from "@/components/LangToggle";
import GoalCelebration from "@/components/GoalCelebration";
import Scoreboard from "@/components/Scoreboard";
import TeamComparison from "@/components/TeamComparison";
import MomentumBar from "@/components/MomentumBar";
import WinProbChart from "@/components/WinProbChart";
import EventFeed from "@/components/EventFeed";
import TacticalPitch from "@/components/TacticalPitch";
import TacticalControls from "@/components/TacticalControls";
import AICoachPanel from "@/components/AICoachPanel";
import SubAdvisor from "@/components/SubAdvisor";
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
  const { togglePlay, setSpeed, tick, resetClock, setMinute, play, pause } = useGame();

  const [reportOpen, setReportOpen] = useState(false);
  const reportShownFor = useRef<number>(-1);
  const [celebration, setCelebration] = useState<MatchEvent | null>(null);
  const celebFor = useRef<number>(-1);
  const resumeAfterCeleb = useRef(false);

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

  // 전-경기 리셋 시 리포트/세리머니 상태 초기화
  useEffect(() => {
    if (minute === 0) {
      setReportOpen(false);
      reportShownFor.current = -1;
      setCelebration(null);
      celebFor.current = -1;
    }
  }, [minute]);

  // 크라우드 웅성거림을 모멘텀에 연동
  useEffect(() => {
    if (!sound || !match) return;
    const s = snapshotAt(match, minute, tactics);
    setCrowdLevel(Math.abs(s.momentum));
  }, [sound, match, minute, tactics]);

  // 골 도달 시: 잠깐 정지 + 세리머니 2.6초 유지 후 재개 (빠른 배속에서도 확실히 보이게)
  useEffect(() => {
    if (!match) return;
    const goal = match.timeline.find((e) => e.minute === minute && e.type === "goal");
    if (!goal || celebFor.current === minute) return;
    celebFor.current = minute;
    resumeAfterCeleb.current = playing;
    setCelebration(goal);
    if (playing) pause();
    if (sound) goalRoar();
    const id = setTimeout(() => {
      setCelebration(null);
      if (resumeAfterCeleb.current) play();
    }, 2600);
    return () => clearTimeout(id);
    // playing/sound는 트리거 시점 값만 사용 — minute/match 변화에만 반응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, match]);

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
          <TeamComparison match={match} snap={snap} minute={minute} />
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

        {/* 우: 교체 추천(부하관리) + AI 코치 + 컨트롤 */}
        <div className="space-y-4 xl:col-span-4">
          <SubAdvisor match={match} snap={snap} minute={minute} />
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

      {/* 골 세리머니 (컨페티 + 선수 실루엣 등장) — 2.6초 유지 */}
      <GoalCelebration
        goal={celebration ?? undefined}
        minute={celebFor.current}
        lang={lang}
        accent={celebration?.side === "away" ? match.away.primary : match.home.primary}
      />

      {/* 교체 알림 (방송 로어서드) */}
      <SubToast lang={lang} />
    </main>
  );
}

/** 교체 발생 시 방송 스타일 토스트 (선수 IN/OUT) */
function SubToast({ lang }: { lang: Lang }) {
  const subLog = useGame((s) => s.subLog);
  const [toast, setToast] = useState<{ off: string; on: string; minute: number } | null>(null);
  const prevLen = useRef(subLog.length);

  useEffect(() => {
    if (subLog.length > prevLen.current) {
      const last = subLog[subLog.length - 1];
      const off = lang === "ko" && last.offNameKo ? last.offNameKo : last.offName;
      const on = lang === "ko" && last.onNameKo ? last.onNameKo : last.onName;
      setToast({ off, on, minute: last.minute });
      const id = setTimeout(() => setToast(null), 2600);
      prevLen.current = subLog.length;
      return () => clearTimeout(id);
    }
    prevLen.current = subLog.length;
  }, [subLog, lang]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="pointer-events-none fixed inset-x-0 bottom-8 z-[55] flex justify-center px-4"
        >
          <div className="flex items-center gap-3 rounded-lg border border-surface-line bg-surface-raised/95 px-5 py-3 shadow-xl backdrop-blur" style={{ borderLeft: "4px solid #3987e5" }}>
            <span className="font-display text-sm font-bold uppercase tracking-wide text-team-home">
              {lang === "ko" ? "교체" : "SUB"}
            </span>
            <span className="metric-num rounded bg-surface-panel px-2 py-0.5 font-display text-sm font-bold text-ink-secondary">{toast.minute}'</span>
            <span className="text-sm font-semibold text-status-critical">↓ {toast.off}</span>
            <span className="text-ink-muted">→</span>
            <span className="text-sm font-semibold text-status-good">↑ {toast.on}</span>
          </div>
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
