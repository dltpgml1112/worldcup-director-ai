/**
 * 경기 중 전술 변경 점검 (일회성 검증 스크립트).
 *   npx tsx scripts/check-midmatch.mts
 *
 * 확인하는 것:
 *  1. 바꾼 시점 이전의 이벤트가 **그대로 보존**되는가 (이미 넣은 골이 사라지면 안 된다)
 *  2. 이후 구간이 실제로 달라지는가 (안 바뀌면 조작이 무의미하다)
 *  3. 공격적으로 바꾸면 남은 시간 득점 기대가 오르는가
 */
import { MATCHES } from "../data/matches";
import { DEFAULT_TACTICS } from "../lib/matchEngine";
import { simulateTimeline } from "../lib/simulateMatch";
import type { MatchEvent, Tactics } from "../lib/types";

const KOR = MATCHES[0].homeXI;
const RSA = MATCHES[0].awayXI;
const base: Tactics = { ...DEFAULT_TACTICS };
const attacking: Tactics = { ...DEFAULT_TACTICS, attack: 95, line: 80, tempo: 85 };

const first = simulateTimeline({
  matchId: "mid-test",
  homeXI: KOR, awayXI: RSA,
  homeTactics: base, awayTactics: base,
});

const CUT = 60;
const before = (evs: MatchEvent[]) => evs.filter((e) => e.minute <= CUT && e.type !== "whistle");
const scoreAt = (evs: MatchEvent[], m: number): [number, number] => {
  let h = 0, a = 0;
  for (const e of evs) if (e.minute <= m && e.type === "goal") (e.side === "home" ? h++ : a++);
  return [h, a];
};

const changed = simulateTimeline({
  matchId: "mid-test",
  homeXI: KOR, awayXI: RSA,
  homeTactics: attacking, awayTactics: base,
  carryOver: { events: first.timeline, fromMinute: CUT },
});

console.log(`원래 경기        최종 ${first.finalScore[0]}-${first.finalScore[1]}  (${CUT}분 시점 ${scoreAt(first.timeline, CUT).join("-")})`);
console.log(`${CUT}분에 총공격 전환  최종 ${changed.finalScore[0]}-${changed.finalScore[1]}  (${CUT}분 시점 ${scoreAt(changed.timeline, CUT).join("-")})`);

const a = JSON.stringify(before(first.timeline));
const b = JSON.stringify(before(changed.timeline));
console.log(`\n1) ${CUT}분 이전 보존: ${a === b ? "OK (완전 동일)" : "❌ 과거가 바뀌었다"}`);

const afterA = first.timeline.filter((e) => e.minute > CUT).length;
const afterB = changed.timeline.filter((e) => e.minute > CUT).length;
const sameAfter = JSON.stringify(first.timeline.filter((e) => e.minute > CUT)) ===
  JSON.stringify(changed.timeline.filter((e) => e.minute > CUT));
console.log(`2) 이후 전개 변화: ${sameAfter ? "❌ 안 바뀜" : `OK (이벤트 ${afterA}개 → ${afterB}개)`}`);

console.log("\n3) 남은 시간 기대득점 (여러 시드로 평균)");
for (const [label, t] of [["유지", base], ["총공격", attacking]] as const) {
  let goals = 0;
  const N = 100;
  for (let i = 0; i < N; i++) {
    const seedMatch = simulateTimeline({
      matchId: `mid-${i}`, homeXI: KOR, awayXI: RSA, homeTactics: base, awayTactics: base,
    });
    const r = simulateTimeline({
      matchId: `mid-${i}`, homeXI: KOR, awayXI: RSA, homeTactics: t, awayTactics: base,
      carryOver: { events: seedMatch.timeline, fromMinute: CUT },
    });
    goals += r.finalScore[0] - scoreAt(seedMatch.timeline, CUT)[0];
  }
  console.log(`   ${label.padEnd(6)} ${CUT}분 이후 평균 ${(goals / 100).toFixed(2)}골`);
}
