"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { CAMPAIGN_ROUNDS } from "@/data/wc2026";

/**
 * 라운드 브리핑 + 캠페인 결말.
 *
 * 경기 전에는 "실제로 이 자리에서 무슨 일이 있었는지"를 먼저 읽힌다 — 상대가 왜 여기
 * 있는지 알아야 이기는 것의 의미가 생긴다. 경기 후에는 진출·탈락·우승을 가른다.
 */
export default function RoundBriefing() {
  const lang = useGame((s) => s.lang);
  const roundId = useGame((s) => s.roundId);
  const minute = useGame((s) => s.minute);
  const matchId = useGame((s) => s.matchId);
  const eliminated = useGame((s) => s.eliminated);
  const champion = useGame((s) => s.champion);
  const results = useGame((s) => s.campaignResults);
  const replayRound = useGame((s) => s.replayRound);
  const resetCampaign = useGame((s) => s.resetCampaign);
  const ko = lang === "ko";

  // 라운드가 바뀌면 브리핑을 다시 연다
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [roundId]);

  const round = CAMPAIGN_ROUNDS.find((r) => r.id === roundId);
  const match = getMatch(matchId);
  const isCampaign = matchId.startsWith("campaign-");
  const showBriefing = isCampaign && !!round && !dismissed && minute === 0 && !eliminated && !champion;

  /*
   * 브리핑이 떠 있는 동안에는 튜토리얼이 시작되지 않게 알린다.
   *
   * 여는 쪽은 loadRound()가 이미 briefingOpen: true 로 확정해 둔다 (첫 렌더 깜빡임 방지).
   * 여기서는 **닫히는 순간만** 알린다 — cleanup으로 false를 쏘면 의존성이 바뀔 때마다
   * true/false가 오가면서 튜토리얼이 한 프레임 열렸다 닫힌다.
   */
  const setBriefingOpen = useGame((s) => s.setBriefingOpen);
  useEffect(() => {
    if (!showBriefing) setBriefingOpen(false);
  }, [showBriefing, setBriefingOpen]);

  // 단독 재생(2022·2018 결승 다시보기)에는 캠페인 UI가 뜨지 않는다
  if (!match || !round || !isCampaign) return null;

  /* ── 결말: 탈락 / 우승 ── */
  if (eliminated || champion) {
    const last = results[results.length - 1];
    return (
      <Overlay>
        <div className="text-center">
          <div className="text-5xl">{champion ? "🏆" : "🇰🇷"}</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-primary">
            {champion
              ? ko ? "세계 챔피언" : "WORLD CHAMPIONS"
              : ko ? "여기까지" : "END OF THE ROAD"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
            {champion
              ? ko
                ? "결승에서 아르헨티나를 넘었다. 실제로는 스페인이 들어올린 트로피를, 당신의 대한민국이 가져갔다."
                : "You beat Argentina in the final. The trophy Spain actually lifted is yours."
              : ko
              ? `${last ? `${last.score[0]}-${last.score[1]}로 졌다. ` : ""}실제 역사에서도 한국은 여기서 멈췄다. 하지만 감독은 다시 설 수 있다.`
              : `${last ? `Beaten ${last.score[0]}–${last.score[1]}. ` : ""}Korea stopped here in real history too — but a manager gets another go.`}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {!champion && (
              <button onClick={replayRound} className="btn-primary !py-2">
                <span className="relative z-10">{ko ? "이 경기 다시 뛴다" : "Replay this match"}</span>
              </button>
            )}
            <button
              onClick={resetCampaign}
              className="chip bg-white/10 px-4 py-2 text-white/80 hover:bg-white/20"
            >
              {ko ? "처음부터" : "Restart campaign"}
            </button>
            <Link href="/" className="chip bg-white/5 px-4 py-2 text-white/60 hover:bg-white/10">
              {ko ? "홈" : "Home"}
            </Link>
          </div>
        </div>
      </Overlay>
    );
  }

  /* ── 경기 전 브리핑 ── */
  if (!showBriefing) return null;

  const opponent = round.opponent;
  const stage = ko ? round.stageKo : round.stage;
  const context = ko ? round.realContextKo : round.realContext;
  const stake =
    round.needsWinner === false
      ? ko
        ? "비기기만 해도 16강이다. 지면 실제 역사대로 탈락."
        : "A draw is enough to go through. Lose and you go out, exactly as it happened."
      : ko
      ? "이기면 다음 라운드. 비기면 연장·승부차기."
      : "Win to go through. A draw means extra time and penalties.";

  return (
    <Overlay>
      <div className="chip mx-auto mb-3 w-fit bg-white/10 text-white/70">
        2026 · {stage}
      </div>
      <div className="flex items-center justify-center gap-3">
        <span className="text-4xl">🇰🇷</span>
        <span className="font-display text-xl font-bold text-ink-muted">vs</span>
        <span className="text-4xl">{opponent.flag}</span>
      </div>
      <h2 className="mt-2 text-center font-display text-2xl font-bold text-ink-primary">
        {ko ? opponent.nameKo : opponent.name}
      </h2>
      <div className="mt-1 text-center text-[11px] uppercase tracking-widest text-ink-muted">
        {(ko && match.venueKo) || match.venue}
      </div>

      <div className="mt-4 rounded-lg border border-surface-line bg-surface-panel p-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          {ko ? "실제로는 이랬다" : "What actually happened here"}
        </div>
        <p className="text-xs leading-relaxed text-ink-secondary">{context}</p>
      </div>

      <p className="mt-3 text-center text-sm font-semibold text-team-home">{stake}</p>

      <button onClick={() => setDismissed(true)} className="btn-primary mt-5 w-full !py-2.5">
        <span className="relative z-10">{ko ? "전술을 짠다" : "Set up my tactics"}</span>
      </button>
      <p className="mt-2 text-center text-[10px] text-ink-muted">
        {ko
          ? "전술·라인업을 정한 뒤 재생을 누르면 그 선택대로 경기가 전개된다."
          : "Set tactics and lineup, then press play — the match plays out from your choices."}
      </p>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 24, scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
          className="glass-strong w-full max-w-lg rounded-2xl p-6"
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
