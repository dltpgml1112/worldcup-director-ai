/**
 * 시뮬레이션 엔진 점검 (일회성 검증 스크립트).
 *   npx tsx scripts/check-sim.mts
 *
 * 확인하는 것:
 *  1. 스코어가 월드컵에서 나올 법한 분포에 들어오는가 (대량 득점이 흔하면 실패)
 *  2. 전술을 바꾸면 결과가 실제로 움직이는가
 *  3. 같은 입력이면 같은 결과인가 (결정론)
 *  4. 토너먼트 경기가 무승부로 끝나지 않는가
 */
import { MATCHES } from "../data/matches";
import { DEFAULT_TACTICS } from "../lib/matchEngine";
import { simulateTimeline, teamAttack, teamDefence } from "../lib/simulateMatch";
import type { Tactics } from "../lib/types";

const KOR = MATCHES[0].homeXI;
const RSA = MATCHES[0].awayXI;
const ARG = MATCHES[1].homeXI;
const FRA = MATCHES[1].awayXI;

const balanced: Tactics = { ...DEFAULT_TACTICS };
const allOut: Tactics = { ...DEFAULT_TACTICS, attack: 100, line: 90, tempo: 95, press: 90, highPress: true };
const parkBus: Tactics = { ...DEFAULT_TACTICS, attack: 5, line: 12, tempo: 25, press: 20 };
const counter: Tactics = { ...DEFAULT_TACTICS, attack: 40, line: 28, counter: true };

console.log("팀 전력 (공격/수비)");
for (const [n, xi] of [["한국", KOR], ["남아공", RSA], ["아르헨티나", ARG], ["프랑스", FRA]] as const) {
  console.log(`  ${n.padEnd(8)} ${teamAttack(xi).toFixed(1)} / ${teamDefence(xi).toFixed(1)}`);
}

console.log("\n전술별 결과 (한국 vs 남아공, 토너먼트 규칙)");
for (const [label, t] of [["균형", balanced], ["총공격", allOut], ["버스", parkBus], ["역습", counter]] as const) {
  const r = simulateTimeline({
    matchId: "test-kor-rsa",
    homeXI: KOR, awayXI: RSA,
    homeTactics: t, awayTactics: balanced,
    needsWinner: true,
  });
  const pen = r.penalties ? ` (승부차기 ${r.penalties[0]}-${r.penalties[1]})` : "";
  console.log(
    `  ${label.padEnd(6)} ${r.finalScore[0]}-${r.finalScore[1]}${pen}` +
      `  λ ${r.lambda[0]}-${r.lambda[1]}  이벤트 ${r.timeline.length}개`
  );
}

console.log("\n결정론 검사");
const a = simulateTimeline({ matchId: "det", homeXI: KOR, awayXI: RSA, homeTactics: balanced, awayTactics: balanced });
const b = simulateTimeline({ matchId: "det", homeXI: KOR, awayXI: RSA, homeTactics: balanced, awayTactics: balanced });
console.log(`  동일 입력 두 번: ${JSON.stringify(a.finalScore)} vs ${JSON.stringify(b.finalScore)} → ${
  JSON.stringify(a.timeline) === JSON.stringify(b.timeline) ? "OK (완전 동일)" : "실패"
}`);

console.log("\n스코어 분포 (한국 vs 각 상대, 경기 id를 200번 바꿔가며)");
for (const [oppName, opp] of [["남아공", RSA], ["프랑스", FRA], ["아르헨티나", ARG]] as const) {
  const tally = new Map<string, number>();
  let totalGoals = 0;
  let blowouts = 0;
  for (let i = 0; i < 200; i++) {
    const r = simulateTimeline({
      matchId: `dist-${oppName}-${i}`,
      homeXI: KOR, awayXI: opp,
      homeTactics: balanced, awayTactics: balanced,
    });
    const k = `${r.finalScore[0]}-${r.finalScore[1]}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
    totalGoals += r.finalScore[0] + r.finalScore[1];
    if (Math.abs(r.finalScore[0] - r.finalScore[1]) >= 4) blowouts++;
  }
  const top = [...tally.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
  console.log(
    `  vs ${oppName.padEnd(7)} 평균 ${(totalGoals / 200).toFixed(2)}골/경기, 4골차 이상 ${blowouts}회` +
      `\n     흔한 스코어: ${top.map(([k, v]) => `${k}(${v})`).join("  ")}`
  );
}
