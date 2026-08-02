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

  // 킥오프해야 경기가 생성된다 (그 전에는 결과가 없는 게 정상)
  s().kickoff();
  const match = getMatch(s().matchId);
  if (!match) {
    console.log("경기를 찾지 못했다:", s().matchId);
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
    s().kickoff();
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
s().kickoff();
for (let i = 0; i < 60; i++) {
  const m = getMatch(s().matchId)!;
  if (m.finalScore[0] < m.finalScore[1]) break;
  s().setTactic("attack", Math.max(0, s().tactics.attack - 1));
  s().setTactic("line", Math.max(0, s().tactics.line - 1));
  s().replayRound();
  s().kickoff();
}
const opener = getMatch(s().matchId)!;
console.log(`A조 3차전 결과 ${opener.finalScore[0]}-${opener.finalScore[1]}`);
s().finishRound();
console.log(`탈락 처리: ${s().eliminated ? "OK" : "안 됨 (다음 라운드로 넘어감)"}`);

console.log("\n=== 킥오프 전 결과 노출 / 전술 반응 ===");
{
  const { projectMatch } = await import("../lib/simulateMatch");
  s().resetCampaign();
  s().setup({ coachName: "테스트" });
  s().finishRound(); // 어떤 결과든 다음 라운드로 (통과 못하면 아래에서 걸러짐)

  const st = s();
  const m = getMatch(st.matchId)!;
  const round = CAMPAIGN_ROUNDS.find((r) => r.id === st.roundId)!;

  console.log(`  현재 라운드: ${round.stageKo} vs ${round.opponent.nameKo}`);
  console.log(
    `  킥오프 전 타임라인 ${m.timeline.length}개, finalScore ${m.finalScore.join("-")}, pending=${m.pending}` +
      (m.pending && m.timeline.length === 0 ? "  ✓ 결과 미확정" : "  ❌ 경기 전에 결과가 정해져 있다")
  );

  // 전술을 바꾸면 예상이 실제로 움직이는가
  const at = (attack: number) => {
    s().setTactic("attack", attack);
    const t = s().tactics;
    const p = projectMatch(s().players, round.opponentXI, t, round.opponentTactics);
    return `${p.score.join("-")} (승 ${p.homeWinProb}% · xG ${p.xg.join("-")})`;
  };
  const low = at(10);
  const mid = at(55);
  const high = at(100);
  console.log(`  공격 10  → ${low}`);
  console.log(`  공격 55  → ${mid}`);
  console.log(`  공격 100 → ${high}`);
  console.log(`  ${low !== high ? "✓ 전술이 예상을 바꾼다" : "❌ 전술을 바꿔도 그대로다"}`);

  // 킥오프하면 그 시점 전술로 경기가 만들어지는가
  s().setTactic("attack", 55);
  s().play();
  const played = getMatch(s().matchId)!;
  console.log(
    `  킥오프 후: 타임라인 ${played.timeline.length}개, 결과 ${played.finalScore.join("-")}, pending=${played.pending ?? false}` +
      (!played.pending && played.timeline.length > 0 ? "  ✓" : "  ❌")
  );
}

console.log("\n=== 브리핑/튜토리얼 순서 ===");
{
  // 캠페인 시작 시점에 briefingOpen이 이미 true여야 튜토리얼이 먼저 열리지 않는다
  s().resetCampaign();
  s().setup({ coachName: "테스트" });
  const onCampaign = s().briefingOpen;
  s().setup({ coachName: "테스트", matchId: "final-2022" });
  const onReplay = s().briefingOpen;
  console.log(`  캠페인 시작 시 briefingOpen=${onCampaign} ${onCampaign ? "✓" : "❌ 튜토리얼이 먼저 열린다"}`);
  console.log(`  단독 재생 시 briefingOpen=${onReplay} ${!onReplay ? "✓" : "❌ 튜토리얼이 영영 안 열린다"}`);

  // 원정팀 선택 시 내 팀이 바뀌는지
  s().setup({ coachName: "테스트", matchId: "final-2022", side: "away" });
  const away = getMatch(s().matchId);
  console.log(`  프랑스로 2022 결승: 내 팀 ${away?.home.nameKo} / 벤치 ${s().bench.length}명 ${away?.home.code === "FRA" && s().bench.length > 0 ? "✓" : "❌"}`);
}

console.log("\n=== 스쿼드 검증 (등번호 중복·인원) ===");
{
  const { KOR_2026, KOR_2026_BENCH } = await import("../data/matches");
  const squad = [...KOR_2026, ...KOR_2026_BENCH];
  const seen = new Map<number, string[]>();
  for (const p of squad) {
    seen.set(p.num, [...(seen.get(p.num) ?? []), `${p.nameKo ?? p.name}${p.legend ? "(레전드)" : ""}`]);
  }
  const dupes = [...seen.entries()].filter(([, names]) => names.length > 1);
  console.log(`  한국 선발 ${KOR_2026.length} + 벤치 ${KOR_2026_BENCH.length}`);
  if (dupes.length) {
    for (const [num, names] of dupes) console.log(`  ⚠️ ${num}번 중복: ${names.join(", ")}`);
  } else {
    console.log("  등번호 중복 없음 ✓");
  }

  for (const r of CAMPAIGN_ROUNDS) {
    const nums = r.opponentXI.map((p) => p.num);
    const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
    if (r.opponentXI.length !== 11 || dup.length) {
      console.log(`  ⚠️ ${r.stageKo} ${r.opponent.nameKo}: ${r.opponentXI.length}명, 중복번호 ${dup.join(",")}`);
    }
  }
}

console.log("\n=== 대진 검증 ===");
CAMPAIGN_ROUNDS.forEach((r) => {
  console.log(`  ${r.stageKo.padEnd(5)} ${r.opponent.flag} ${r.opponent.nameKo.padEnd(8)} 선발 ${r.opponentXI.length}명 (${r.opponentShape})`);
});
