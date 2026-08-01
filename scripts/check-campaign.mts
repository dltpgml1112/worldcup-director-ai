/**
 * 캠페인 완주 점검 (일회성 검증 스크립트).
 *   npx tsx scripts/check-campaign.mts
 *
 * 확인하는 것:
 *  1. 남아공전 → 32강 → … → 결승까지 라운드가 실제로 이어지는가
 *  2. 토너먼트가 무승부로 끝나지 않는가 (연장·승부차기)
 *  3. 지면 캠페인이 거기서 멈추는가
 *  4. 상대가 실제 대진표 그대로인가
 */
import { useGame } from "../lib/store";
import { CAMPAIGN_ROUNDS } from "../data/wc2026";
import { getMatch } from "../data/matches";

const s = () => useGame.getState();

function labelOf(roundId: string | null) {
  return CAMPAIGN_ROUNDS.find((r) => r.id === roundId)?.stageKo ?? String(roundId);
}

/** 이 라운드를 통과했는가 — 조별리그는 무승부도 통과 */
function passed(roundId: string | null, score: [number, number], pen?: [number, number]) {
  const r = CAMPAIGN_ROUNDS.find((x) => x.id === roundId);
  if (r?.needsWinner === false) return score[0] >= score[1];
  return pen ? pen[0] > pen[1] : score[0] > score[1];
}

console.log("=== 캠페인 완주 (감독이 매 경기 이긴다고 가정) ===\n");

s().setup({ coachName: "테스트" });

for (let step = 0; step < 8; step++) {
  const st = s();
  if (st.champion || st.eliminated) break;

  const match = getMatch(st.matchId);
  if (!match) {
    console.log("경기를 찾지 못했다:", st.matchId);
    break;
  }

  const [h, a] = match.finalScore;
  const pen = match.penalties ? ` 승부차기 ${match.penalties[0]}-${match.penalties[1]}` : "";
  // 토너먼트는 무승부로 끝나면 안 된다 (조별리그는 정상)
  const round = CAMPAIGN_ROUNDS.find((r) => r.id === st.roundId);
  const badDraw = h === a && !match.penalties && round?.needsWinner !== false;
  console.log(
    `${labelOf(st.roundId).padEnd(10)} vs ${(match.away.nameKo ?? "").padEnd(10)} ` +
      `${h}-${a}${pen}  [${match.dataSource}] 이벤트 ${match.timeline.length}개` +
      (badDraw ? "   ⚠️ 토너먼트인데 승자가 안 정해짐!" : "")
  );

  // 지고 있으면 이길 때까지 전술을 바꿔 다시 (감독의 재도전)
  let tries = 0;
  while (tries < 60) {
    const m = getMatch(s().matchId)!;
    if (passed(s().roundId, m.finalScore, m.penalties)) break;
    // 전술을 조금씩 바꿔가며 다시 도전 (감독이 실제로 하는 일)
    const t = s().tactics;
    s().setTactic("attack", Math.min(100, t.attack + 2));
    s().setTactic("press", Math.min(100, t.press + 1));
    s().replayRound();
    tries++;
  }
  if (tries > 0) {
    const m = getMatch(s().matchId)!;
    const p = m.penalties ? ` 승부차기 ${m.penalties[0]}-${m.penalties[1]}` : "";
    console.log(`   └ ${tries}번 전술 조정 후 ${m.finalScore[0]}-${m.finalScore[1]}${p} 통과`);
  }

  s().finishRound();
}

const fin = s();
console.log(
  `\n결과: ${fin.champion ? "🏆 우승" : fin.eliminated ? "탈락" : "진행 중"} ` +
    `· 치른 경기 ${fin.campaignResults.length}개`
);
console.log("기록:", fin.campaignResults.map((r) => `${r.roundId} ${r.score[0]}-${r.score[1]}`).join(" | "));

console.log("\n=== 탈락 경로 (첫 경기에서 지면) ===");
s().resetCampaign();
s().setup({ coachName: "테스트" });
// 지는 시드가 나올 때까지 전술을 흔든다
for (let i = 0; i < 60; i++) {
  const m = getMatch(s().matchId)!;
  if (m.finalScore[0] < m.finalScore[1]) break;
  s().setTactic("attack", Math.max(0, s().tactics.attack - 1));
  s().setTactic("line", Math.max(0, s().tactics.line - 1));
  s().replayRound();
}
const opener = getMatch(s().matchId)!;
console.log(`A조 3차전 결과 ${opener.finalScore[0]}-${opener.finalScore[1]}`);
s().finishRound();
console.log(`탈락 처리: ${s().eliminated ? "OK" : "안 됨 (다음 라운드로 넘어감)"}`);

console.log("\n=== 대진 검증 ===");
CAMPAIGN_ROUNDS.forEach((r) => {
  console.log(`  ${r.stageKo.padEnd(5)} ${r.opponent.flag} ${r.opponent.nameKo.padEnd(8)} 선발 ${r.opponentXI.length}명 (${r.opponentShape})`);
});
