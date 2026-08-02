/**
 * 경기후 리포트 점검 (일회성 검증 스크립트).
 *   npx tsx scripts/check-report.mts
 *
 * "2-1로 이겼는데 등급 D" 회귀를 잡는다. 등급은 예측 승률이 아니라
 * **실제로 낸 결과**를 따라야 한다.
 */
import { MATCHES } from "../data/matches";
import { DEFAULT_TACTICS } from "../lib/matchEngine";
import { snapshotAt } from "../lib/matchEngine";
import { buildReport, type MatchOutcome } from "../lib/postMatch";

const m = MATCHES[0];
const snap = snapshotAt(m, 90, DEFAULT_TACTICS);

const real = { score: [1, 0] as [number, number], order: "RSA–KOR" };

const cases: { label: string; o: MatchOutcome }[] = [
  { label: "캠페인 2-1 승 (승률 35%)", o: { score: [2, 1], projected: false, winProb: 35, real, campaign: true } },
  { label: "캠페인 1-0 승 (승률 55%)", o: { score: [1, 0], projected: false, winProb: 55, real, campaign: true } },
  { label: "캠페인 3-0 승 (승률 70%)", o: { score: [3, 0], projected: false, winProb: 70, real, campaign: true } },
  { label: "캠페인 1-1 무 (통과)", o: { score: [1, 1], projected: false, winProb: 45, real, campaign: true } },
  { label: "캠페인 0-0 승부차기 승", o: { score: [0, 0], penalties: [4, 3], projected: false, winProb: 48, real, campaign: true } },
  { label: "캠페인 0-2 패", o: { score: [0, 2], projected: false, winProb: 30, real, campaign: true } },
  { label: "재생 경기 예측 1-0", o: { score: [1, 0], projected: true, winProb: 58, real, campaign: false } },
];

console.log("등급 판정");
for (const { label, o } of cases) {
  const r = buildReport(m, m.homeXI, snap, DEFAULT_TACTICS, "테스트", o, "ko");
  const bad = o.campaign && (o.score[0] > o.score[1] || o.penalties) && r.gradeScore < 60;
  console.log(
    `  ${label.padEnd(26)} ${r.grade.padEnd(2)} (${String(r.gradeScore).padStart(3)}/100)` +
      (bad ? "   ❌ 이겼는데 등급이 낮다" : "")
  );
}

console.log("\n총평 첫 문장");
const win = buildReport(m, m.homeXI, snap, DEFAULT_TACTICS, "홍명보", cases[0].o, "ko");
console.log("  " + win.verdict.split(". ").slice(0, 2).join(". ") + ".");
console.log("  헤드라인: " + win.headlines[0]);
