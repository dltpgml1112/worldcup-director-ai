"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt, simulateAlternate, type AlternateResult } from "@/lib/matchEngine";
import {
  startCrowd,
  stopCrowd,
  pauseCrowd,
  resumeCrowd,
  setCrowdLevel,
  goalRoar,
  whistle,
  kickoffWhistle,
  cardSound,
} from "@/lib/audio";
import { t, type Lang } from "@/lib/i18n";
import type { MatchEvent } from "@/lib/types";
import LangToggle from "@/components/LangToggle";
import GoalMoment from "@/components/GoalMoment";
import Scoreboard from "@/components/Scoreboard";
import TeamComparison from "@/components/TeamComparison";
import MomentumBar from "@/components/MomentumBar";
import WinProbChart from "@/components/WinProbChart";
import EventFeed from "@/components/EventFeed";
import TacticalBoard from "@/components/TacticalBoard";
import TacticalControls from "@/components/TacticalControls";
import AICoachPanel from "@/components/AICoachPanel";
import SubAdvisor from "@/components/SubAdvisor";
import DataProvenance from "@/components/DataProvenance";
import SubstitutionPanel from "@/components/SubstitutionPanel";
import PostMatchReport from "@/components/PostMatchReport";
import CardToast from "@/components/CardToast";
import Tutorial, { TutorialButton } from "@/components/Tutorial";
import PlayerDetailCard from "@/components/PlayerDetailCard";
import MatchProgress from "@/components/MatchProgress";
import TacticImpact from "@/components/TacticImpact";
import TacticPresets from "@/components/TacticPresets";
import CampaignBracket from "@/components/CampaignBracket";
import RoundBriefing from "@/components/RoundBriefing";

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
  const finishRound = useGame((s) => s.finishRound);
  const replayRound = useGame((s) => s.replayRound);

  const [reportOpen, setReportOpen] = useState(false);
  const reportShownFor = useRef<number>(-1);
  const [celebration, setCelebration] = useState<MatchEvent | null>(null);
  const celebFor = useRef<number>(-1);
  const resumeAfterCeleb = useRef(false);
  const whistleFor = useRef<number>(-1);
  const [cardEvent, setCardEvent] = useState<MatchEvent | null>(null);
  const cardFor = useRef<number>(-1);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const match = getMatch(matchId);
  const end = match?.timeline[match.timeline.length - 1]?.minute ?? 90;
  const isFT = minute >= end;
  // 캠페인 라운드인지, 결승 다시보기 같은 단독 재생인지
  const isCampaign = matchId.startsWith("campaign-");

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

  // 경기가 멈추면 사운드도 같이 멈춘다 (재생 중일 때만 소리가 난다)
  useEffect(() => {
    if (!sound) return;
    if (playing) resumeCrowd();
    else pauseCrowd();
  }, [sound, playing]);

  // 전-경기 리셋 시 리포트/세리머니 상태 초기화
  useEffect(() => {
    if (minute === 0) {
      setReportOpen(false);
      reportShownFor.current = -1;
      setCelebration(null);
      celebFor.current = -1;
      whistleFor.current = -1;
      setCardEvent(null);
      cardFor.current = -1;
    }
  }, [minute]);

  // 심판 호루라기 — 킥오프는 길게 + 관중 환호, 전·후반 종료는 두 번
  useEffect(() => {
    if (!match || !sound) return;
    const ev = match.timeline.find((e) => e.minute === minute && e.type === "whistle");
    const kickoff = minute === 1;
    if ((ev || kickoff) && whistleFor.current !== minute) {
      whistleFor.current = minute;
      if (kickoff) kickoffWhistle();
      else whistle(true);
    }
  }, [minute, match, sound]);

  /*
   * 카드 — 휘슬 + 관중 야유, 방송 로어서드 토스트.
   *
   * 타이머를 cleanup으로 취소하면 안 된다. minute이 바뀔 때마다 effect가 재실행되면서
   * 타이머가 죽어, 한 번 뜬 카드 팝업이 경기 끝까지 사라지지 않는다.
   */
  useEffect(() => {
    if (!match) return;
    const ev = match.timeline.find((e) => e.minute === minute && e.type === "card");
    if (!ev || cardFor.current === minute) return;
    cardFor.current = minute;
    setCardEvent(ev);
    if (sound) cardSound(ev.card === "red");
    if (cardTimer.current) clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => {
      setCardEvent(null);
      cardTimer.current = null;
    }, 3200);
    // sound는 트리거 시점 값만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, match]);

  // 언마운트 시에만 카드 타이머 정리
  useEffect(() => () => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
  }, []);

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
    // 시계는 즉시 멈춘다 (안 그러면 배속에서 분이 계속 넘어간다)
    if (playing) pause();
    /*
     * 배너·함성은 슛이 골망에 닿은 뒤에 나온다.
     * 즉시 띄우면 공이 아직 골대에서 먼데 '골'이 선언돼 무슨 일이 일어났는지 알 수 없다.
     * Pitch3D가 같은 1초 동안 시뮬레이션을 계속 돌려 슛을 보여준다.
     */
    // Pitch3D의 SHOT_WINDOW와 맞춰야 한다 (패스 → 마무리 → 골망)
    const SHOT_MS = 1900;
    const shotId = setTimeout(() => {
      setCelebration(goal);
      if (sound) goalRoar();
    }, SHOT_MS);
    const id = setTimeout(() => {
      setCelebration(null);
      if (resumeAfterCeleb.current) play();
    }, SHOT_MS + 4800);
    goalTimers.current.push(shotId, id);
    // 타이머는 cleanup으로 취소하지 않는다 — 취소되면 세리머니가 영영 안 끝난다
    // playing/sound는 트리거 시점 값만 사용 — minute/match 변화에만 반응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, match]);

  // 언마운트 시에만 골 타이머 정리
  useEffect(() => () => {
    goalTimers.current.forEach(clearTimeout);
  }, []);

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
  const won = match.penalties
    ? match.penalties[0] > match.penalties[1]
    : match.finalScore[0] > match.finalScore[1];

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
          <TutorialButton lang={lang} />
          <LangToggle />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* 좌: 방송 그래픽 */}
        <div className="space-y-4 xl:col-span-4">
          <Scoreboard match={match} snap={snap} />
          {isCampaign && <CampaignBracket />}
          <WinProbChart match={match} tactics={tactics} minute={minute} />
          <MomentumBar momentum={snap.momentum} homeCode={match.home.code} awayCode={match.away.code} />
          <TeamComparison match={match} snap={snap} minute={minute} />
          <AlternateHistory
            lang={lang}
            realScore={match.finalScore}
            alt={alt}
            narrative={lang === "ko" && match.realNarrativeKo ? match.realNarrativeKo : match.realNarrative}
          />
        </div>

        {/* 중: 재생 + 택티컬 보드 */}
        <div className="space-y-4 xl:col-span-4">
          {/* 재생 컨트롤을 보드 위에 — 가장 먼저 누르게 되는 조작이다 */}
          <div className="glass-strong space-y-3 rounded-2xl p-4" data-tour="playback">
            {/* 전·후반과 남은 시간을 먼저 보여준다 */}
            <MatchProgress />
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

          <TacticalBoard />
        </div>

        {/* 우: 전술 · 스쿼드 · 중계를 한 화면에 (탭으로 나눴다가 되돌림 — 클릭 전환이 불편) */}
        <div className="space-y-4 xl:col-span-4">
          <div data-tour="tactics" className="space-y-3">
            {/* 이름 있는 전술을 먼저 — 슬라이더만 있으면 뭘 만져야 할지 모른다 */}
            <TacticPresets />
            {/* 조정하면 승리 확률·예상 스코어가 즉시 반응한다는 걸 눈으로 보여준다 */}
            <TacticImpact />
            <TacticalControls />
          </div>
          <div data-tour="coach">
            <AICoachPanel match={match} snap={snap} tactics={tactics} formation={formation} />
          </div>
          <SubAdvisor match={match} snap={snap} minute={minute} />
          <SubstitutionPanel />
          <EventFeed match={match} minute={minute} />
          <DataProvenance match={match} minute={minute} />
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

      {/*
        캠페인 진행 바 — 경기가 끝나면 진출/재도전을 여기서 정한다.
        리포트를 닫아야 보이게 해서 두 개가 겹치지 않도록 한다.
      */}
      {isCampaign && isFT && !reportOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4">
          <div className="glass-strong flex flex-wrap items-center justify-center gap-3 rounded-2xl px-5 py-3">
            <span className="text-sm font-semibold text-ink-secondary">
              {won
                ? lang === "ko" ? "이겼다. 다음 라운드로." : "You won. Next round."
                : lang === "ko" ? "여기서 끝낼 수는 없다." : "You can't leave it here."}
            </span>
            <button onClick={finishRound} className="btn-primary !py-2 !text-sm">
              <span className="relative z-10">
                {won ? (lang === "ko" ? "다음 라운드" : "Next round") : (lang === "ko" ? "결과 확정" : "Accept result")}
              </span>
            </button>
            <button
              onClick={replayRound}
              className="chip bg-white/10 px-4 py-2 text-white/80 hover:bg-white/20"
            >
              {lang === "ko" ? "전술 바꿔 다시" : "Retry with new tactics"}
            </button>
          </div>
        </div>
      )}

      {/* 라운드 브리핑 · 캠페인 결말 */}
      <RoundBriefing />

      {/* 골 모먼트 — 방송 그래픽 + 3D 카메라 연출과 동시에 '다음 전술' 제안 */}
      <GoalMoment
        goal={celebration ?? undefined}
        match={match}
        snap={snap}
        minute={celebFor.current}
        lang={lang}
      />

      {/* 카드 알림 (방송 오버레이) */}
      <CardToast event={cardEvent} lang={lang} home={match.home} away={match.away} />

      {/* 교체 알림 (방송 로어서드) */}
      <SubToast lang={lang} />

      {/* 선수 상세 — 경기장에서 선수를 짧게 클릭하면 열린다 */}
      <PlayerDetailCard />

      {/* 첫 방문 온보딩 — 헤더의 '?' 버튼으로 언제든 다시 볼 수 있다 */}
      <Tutorial />
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
  alt,
  narrative,
}: {
  lang: Lang;
  realScore: [number, number];
  alt: AlternateResult;
  narrative: string;
}) {
  const altScore = alt.score;
  const changed = realScore[0] !== altScore[0] || realScore[1] !== altScore[1];
  const winLine = lang === "ko" ? `당신의 전술은 ` : `Your tactics project a `;
  return (
    <div className="panel rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">🦋</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">{t(lang, "alt.title")}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-surface-line bg-surface-panel p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-ink-muted">{t(lang, "alt.real")}</div>
          <div className="metric-num font-display text-3xl font-bold text-ink-secondary">{realScore[0]}–{realScore[1]}</div>
        </div>
        <div className="rounded-md border border-team-home/40 bg-team-home/10 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-team-home">{t(lang, "alt.your")}</div>
          <div className="metric-num font-display text-3xl font-bold text-team-home">{altScore[0]}–{altScore[1]}</div>
          {/* 표본 하나가 아니라 '가장 확률이 높은 스코어'임을 밝힌다 */}
          <div className="metric-num text-[10px] text-ink-muted">
            {lang === "ko" ? "최빈 스코어" : "most likely"} · {alt.scorelineProb}%
          </div>
        </div>
      </div>

      {/* 승/무/패 — 포아송 결합행렬을 영역별로 합산한 값 */}
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-panel">
        <div style={{ width: `${alt.homeWinProb}%` }} className="bg-status-good" />
        <div style={{ width: `${alt.drawProb}%` }} className="bg-ink-muted/50" />
        <div style={{ width: `${alt.awayWinProb}%` }} className="bg-status-critical" />
      </div>
      <div className="metric-num mt-1 flex justify-between text-[10px] text-ink-muted">
        <span className="text-status-good">{lang === "ko" ? "승" : "W"} {alt.homeWinProb}%</span>
        <span>{lang === "ko" ? "무" : "D"} {alt.drawProb}%</span>
        <span className="text-status-critical">{lang === "ko" ? "패" : "L"} {alt.awayWinProb}%</span>
      </div>

      <div className="mt-2 rounded-md bg-surface-panel px-3 py-2 text-center text-xs leading-relaxed text-ink-secondary">
        {winLine}
        <span className="metric-num rounded bg-team-home/15 px-1.5 py-0.5 font-bold text-team-home">
          {alt.xg[0].toFixed(2)}–{alt.xg[1].toFixed(2)}
        </span>
        {lang === "ko" ? " 기대득점" : " expected goals"}
        {changed ? (
          <span className="ml-1 font-semibold text-status-good">· {t(lang, "alt.rewritten")}</span>
        ) : (
          <span className="ml-1 text-ink-muted">· {t(lang, "alt.same")}</span>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">{narrative}</p>
    </div>
  );
}
