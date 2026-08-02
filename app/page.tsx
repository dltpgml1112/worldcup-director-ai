"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import CrowdCanvas from "@/components/CrowdCanvas";

/**
 * three.js는 브라우저 전용이고 무겁다 — 지연 로드해서 히어로 텍스트가 먼저 뜨게 하고,
 * 로딩 중에는 기존 관중 캔버스가 배경을 채운다.
 */
const HeroPitch3D = dynamic(() => import("@/components/HeroPitch3D"), {
  ssr: false,
  loading: () => null,
});
import LangToggle from "@/components/LangToggle";
import { MATCHES, getMatch } from "@/data/matches";
import { CAMPAIGN_ROUNDS } from "@/data/wc2026";
import { REAL_OPENER_ID } from "@/lib/campaign";
import { useGame, loadCampaign, clearCampaign } from "@/lib/store";
import { sourceBadge } from "@/lib/provenance";
import { orientFixture, orientedScore } from "@/lib/fixture";
import { t, stageLabel } from "@/lib/i18n";

/**
 * 홈 = 캠페인 입구.
 *
 * 예전에는 나라·상대·연도를 자유 조합하게 했는데, 실제 데이터가 있는 대진은 몇 개뿐이라
 * 없는 조합을 고르면 조용히 다른 경기가 열렸다. 지금은 실제로 열린 경기만 들어간다.
 */
export default function Home() {
  const router = useRouter();
  const setup = useGame((s) => s.setup);
  const resumeCampaign = useGame((s) => s.resumeCampaign);
  const lang = useGame((s) => s.lang);
  const [name, setName] = useState("");
  const ko = lang === "ko";

  /*
   * 저장된 캠페인 확인은 마운트 후에 한다 — localStorage는 서버에 없어서
   * 렌더 중에 읽으면 SSR 결과와 클라이언트가 어긋난다(hydration mismatch).
   */
  const [saved, setSaved] = useState<ReturnType<typeof loadCampaign>>(null);
  useEffect(() => setSaved(loadCampaign()), []);

  /*
   * 「이어하기」는 **진행이 실제로 있을 때만** 띄운다.
   *
   * 첫 라운드를 아직 안 끝냈으면 이어할 게 없는데도 카드가 떠서, 시연 녹화처럼 깨끗한
   * 첫 화면이 필요할 때 방해가 된다. 옆의 ✕로 기록을 지우면 즉시 사라진다.
   */
  const savedRound =
    saved && saved.campaignResults.length > 0
      ? CAMPAIGN_ROUNDS.find((r) => r.id === saved.roundId)
      : undefined;

  const resume = () => {
    if (resumeCampaign()) router.push("/match");
  };

  const discard = () => {
    clearCampaign();
    setSaved(null);
  };

  const opener = getMatch(REAL_OPENER_ID);
  const coach = () => name.trim() || (ko ? "감독" : "Coach");

  const startCampaign = () => {
    setup({ coachName: coach() });
    router.push("/match");
  };

  const startReplay = (matchId: string, side: "home" | "away") => {
    setup({ coachName: coach(), matchId, side });
    router.push("/match");
  };

  // 다시보기 = 실측 경기 전부 (남아공전 원본 + 2022·2018 결승)
  const replays = MATCHES;

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* 배경: 3D 경기장. 로드 전에는 관중 캔버스가 자리를 채운다 */}
      <CrowdCanvas className="absolute inset-0 h-full w-full opacity-20" />
      <div className="absolute inset-0">
        <HeroPitch3D />
      </div>
      {/* 텍스트 가독성 확보 — 위아래를 어둡게 눌러 카드/헤드라인이 뜨게 한다 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-base/85 via-surface-base/55 to-surface-base/95" />

      <div className="absolute right-4 top-4 z-20">
        <LangToggle />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <div className="chip mx-auto mb-4 bg-white/10 text-white/70">🏆 {t(lang, "home.badge")}</div>
          <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-tight text-ink-primary sm:text-7xl">
            World Cup <span className="text-team-home">Director</span> AI
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">{t(lang, "home.tagline")}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="glass-strong mt-10 w-full max-w-2xl rounded-3xl p-6 sm:p-8"
        >
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-white/50">
            {t(lang, "home.coachName")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(lang, "home.coachPlaceholder")}
            className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg outline-none focus:border-neon-grass"
          />

          {/* ── 이어하기 — 진행 중인 캠페인이 있으면 맨 위에 ── */}
          {savedRound && !saved?.champion && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-neon-grass/40 bg-neon-grass/10 px-4 py-3">
              <button onClick={resume} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-neon-grass">
                    {ko ? "진행 중인 캠페인" : "Campaign in progress"}
                  </span>
                  <span className="block truncate text-sm text-white/80">
                    {savedRound.opponent.flag} {ko ? savedRound.stageKo : savedRound.stage} ·{" "}
                    {ko ? savedRound.opponent.nameKo : savedRound.opponent.name}
                    <span className="text-white/50">
                      {" "}
                      · {ko ? `${saved!.campaignResults.length}경기 완료` : `${saved!.campaignResults.length} played`}
                    </span>
                  </span>
                </span>
                <span className="chip shrink-0 bg-neon-grass/20 text-neon-grass">{ko ? "이어하기" : "Resume"}</span>
              </button>
              {/* 기록 지우기 — 시연 녹화처럼 깨끗한 첫 화면이 필요할 때 */}
              <button
                onClick={discard}
                title={ko ? "저장된 기록 지우기" : "Discard saved run"}
                aria-label={ko ? "저장된 기록 지우기" : "Discard saved run"}
                className="shrink-0 rounded-lg px-2 py-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
              >
                ✕
              </button>
            </div>
          )}

          {/* ── 캠페인 브리핑 ── */}
          {opener && (
            <div className="rounded-2xl border border-team-home/40 bg-team-home/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="chip bg-white/10 text-white/70">
                  2026 · {stageLabel(lang, opener.stage, opener.stageKo)}
                </span>
                <span className={`chip ${sourceBadge("real").cls}`}>{t(lang, sourceBadge("real").key)}</span>
              </div>

              {/* 공식 기록 순서 — 실제 홈이었던 남아공이 왼쪽 */}
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="text-3xl">{orientFixture(opener, opener.home, opener.away).left.flag}</span>
                <span className="metric-num font-display text-2xl font-bold text-white/50">
                  {orientedScore(opener, opener.finalScore).join("–")}
                </span>
                <span className="text-3xl">{orientFixture(opener, opener.home, opener.away).right.flag}</span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {ko
                  ? "승점 3의 한국, 1의 남아공. 비기기만 해도 16강이었다. 점유율 68%에 슈팅 18개를 치고도 유효슈팅은 3개. 63분 한 방에 무너져 조 3위로 탈락했다."
                  : "Korea on 3 points, South Africa on 1 — a draw was enough. Korea had 68% of the ball and 18 shots, but only three on target. One 63rd-minute break ended it."}
              </p>
              <p className="mt-2 text-sm font-semibold text-team-home">
                {ko
                  ? "이제 당신이 감독이다. 통과하면 남아공의 자리를 그대로 이어받아 결승까지 간다."
                  : "Now you're the manager. Go through, and you inherit South Africa's bracket slot all the way to the final."}
              </p>

              {/* 이길 경우 만나게 될 실제 상대들 */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  {ko ? "그 앞에 있는 팀" : "The road ahead"}
                </span>
                {CAMPAIGN_ROUNDS.map((r) => (
                  <span key={r.id} className="chip bg-white/5 text-white/60">
                    {r.opponent.flag} {ko ? r.stageKo : r.stage}
                  </span>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={startCampaign} className="btn-primary mt-4 w-full !py-3">
                <span className="relative z-10">
                  {savedRound
                    ? ko ? "처음부터 새로 시작" : "Start over"
                    : ko ? "내 월드컵을 시작한다" : "Start my World Cup"}
                </span>
              </motion.button>
            </div>
          )}

          {/* ── 실측 경기 다시보기 ── */}
          <div className="mt-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">
              {ko ? "실제 경기 다시보기" : "Replay a real match"}
            </div>
            <p className="mb-2 text-[11px] text-white/40">
              {ko ? "맡고 싶은 팀을 고르세요." : "Pick the side you want to manage."}
            </p>
            <div className="space-y-2">
              {replays.map((m) => {
                const { left, right } = orientFixture(m, m.home, m.away);
                // 버튼은 팀별로 — 어느 쪽을 맡을지 고르게 한다
                const sideOf = (team: typeof m.home): "home" | "away" => (team.id === m.home.id ? "home" : "away");
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-2.5"
                  >
                    <div className="mb-1.5 flex items-center gap-2 text-[11px] text-white/40">
                      <span className="metric-num font-semibold text-white/60">
                        {orientedScore(m, m.finalScore).join("–")}
                      </span>
                      <span>
                        {m.year} {stageLabel(lang, m.stage, m.stageKo)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[left, right].map((team) => (
                        <button
                          key={team.id}
                          onClick={() => startReplay(m.id, sideOf(team))}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75 transition hover:border-neon-grass/50 hover:bg-neon-grass/10"
                        >
                          <span>{team.flag}</span>
                          <span className="font-semibold">{ko ? team.nameKo : team.name}</span>
                          <span className="text-[10px] text-white/40">{ko ? "감독" : "manage"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs text-white/40">
          {[t(lang, "home.f1"), t(lang, "home.f2"), t(lang, "home.f3"), t(lang, "home.f4"), t(lang, "home.f5")].map((f) => (
            <span key={f} className="chip bg-white/5">{f}</span>
          ))}
        </div>
      </div>
    </main>
  );
}
