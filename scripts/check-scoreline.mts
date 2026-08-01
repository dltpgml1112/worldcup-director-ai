/**
 * 스코어라인 현실성 점검 (일회성 검증 스크립트).
 *   npx tsx scripts/check-scoreline.mts
 *
 * "전술을 어떻게 밀어도 월드컵에서 나올 법한 스코어가 나오는가"를 확인한다.
 * 4-1 같은 결과가 기본값에서 튀어나오던 회귀를 다시 잡기 위한 것.
 */
import { MATCHES } from "../data/matches";
import { DEFAULT_TACTICS, simulateAlternate } from "../lib/matchEngine";
import type { Tactics } from "../lib/types";

const PRESETS: [string, Tactics][] = [
  ["기본", { ...DEFAULT_TACTICS }],
  ["극단 공격", { ...DEFAULT_TACTICS, attack: 100, line: 90, tempo: 100, press: 100, highPress: true, counter: true }],
  ["극단 수비", { ...DEFAULT_TACTICS, attack: 0, line: 10, tempo: 20, press: 10 }],
  ["역습", { ...DEFAULT_TACTICS, attack: 45, line: 30, counter: true }],
  ["게겐프레싱", { ...DEFAULT_TACTICS, attack: 75, line: 80, press: 95, highPress: true }],
];

for (const m of MATCHES) {
  console.log(`\n=== ${m.home.nameKo} vs ${m.away.nameKo} (실제 ${m.finalScore[0]}-${m.finalScore[1]}) ===`);
  for (const [label, tactics] of PRESETS) {
    const r = simulateAlternate(m, tactics);
    console.log(
      `  ${label.padEnd(12)} ${r.score[0]}-${r.score[1]}` +
        `  (최빈 ${String(r.scorelineProb).padStart(2)}%)` +
        `  xG ${r.xg[0].toFixed(2)}-${r.xg[1].toFixed(2)}` +
        `  승/무/패 ${r.homeWinProb}/${r.drawProb}/${r.awayWinProb}`
    );
  }
}
