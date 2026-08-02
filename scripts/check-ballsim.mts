/**
 * 공 시뮬레이션 교착 점검 (일회성 검증 스크립트).
 *   npx tsx scripts/check-ballsim.mts
 *
 * 확인하는 것: **골이 들어간 뒤에도 경기가 계속 굴러가는가.**
 *
 * 슛은 골라인을 넘어 골망 안(y=103)까지 날아가는데 선수는 3~97 범위에 묶여 있다.
 * 그래서 예전에는 골 직후 공이 골대 뒤에 남고 아무도 닿지 못해, 다음 골의 대본 개입이
 * 있을 때까지 22명이 그대로 멈춰 있었다. 그 회귀를 잡기 위한 검사다.
 */
import { MATCHES } from "../data/matches";
import { DEFAULT_TACTICS } from "../lib/matchEngine";
import { createSim, roleGroup, roleTarget, stepBall, type SimCtx, type SimPlayer } from "../lib/matchSim";
import type { PitchPoint } from "../lib/pitchPositions";

const m = MATCHES[0];
const toSim = (xi: typeof m.homeXI, side: "home" | "away"): SimPlayer[] =>
  xi.map((p) => ({ id: p.id, base: { x: p.x, y: p.y }, role: p.role, rating: p.rating, side, group: roleGroup(p.role) }));

const players = [...toSim(m.homeXI, "home"), ...toSim(m.awayXI, "away")];
const live = new Map<string, PitchPoint>();
for (const p of players) live.set(p.id, { ...p.base });

const s = createSim();
const ctx: SimCtx = {
  players,
  tactics: { ...DEFAULT_TACTICS },
  minute: 10,
  scriptedSide: "home",
  scriptedY: 50,
  scriptedShot: false,
  scriptedScorerId: null,
  scriptedGoalMinute: null,
};

const DT = 1 / 60;
const step = () => {
  for (const p of players) {
    const t = roleTarget(p, s.pos, ctx, s.side === p.side, s.chase.includes(p.id));
    const cur = live.get(p.id)!;
    cur.x += (t.x - cur.x) * 0.1;
    cur.y += (t.y - cur.y) * 0.1;
  }
  stepBall(s, DT, live, ctx);
};

/** 공이 사실상 멈춰 있던 최장 구간(초) — 화면이 굳어 보이는지의 지표 */
function longestStall(frames: number): { stall: number; turnovers: number } {
  let stall = 0;
  let run = 0;
  let turnovers = 0;
  let side = s.side;
  let prev = { ...s.pos };
  for (let i = 0; i < frames; i++) {
    step();
    const d = Math.hypot(s.pos.x - prev.x, s.pos.y - prev.y);
    prev = { ...s.pos };
    if (d < 0.01) { run++; stall = Math.max(stall, run); } else run = 0;
    if (s.side !== side) { turnovers++; side = s.side; }
  }
  return { stall: stall / 60, turnovers };
}

// 1) 평상시 60초 — 공이 멎지 않고 계속 굴러가는가
const r1 = longestStall(60 * 60);
console.log(
  `1) 평상시 60초 — 최장 정지 ${r1.stall.toFixed(2)}초 ${r1.stall < 1.5 ? "✓" : "❌ 화면이 굳는다"}` +
    `, 소유권 전환 ${r1.turnovers}회, 공 (${s.pos.x.toFixed(1)}, ${s.pos.y.toFixed(1)}) mode=${s.mode}`
);
let turnovers = 0;
let prevSide = s.side;

// 2) 골 직후 상황 재현 — 공을 골망 안(y=103)에 두고 경기가 되살아나는지
s.mode = "loose";
s.carrierId = null;
s.targetId = null;
s.pos = { x: 50, y: 103 };
s.chase = [];

let recovered = -1;
for (let i = 0; i < 60 * 20; i++) {
  step();
  if (recovered < 0 && s.mode === "carry") recovered = i;
}
console.log(
  `2) 골 직후(공 y=103) — ${recovered >= 0 ? `${(recovered / 60).toFixed(2)}초 만에 소유 재개 ✓` : "❌ 20초간 아무도 공을 잡지 못함 (교착)"}`
);

// 3) 그 뒤로도 계속 굴러가는가
turnovers = 0;
prevSide = s.side;
let moved = 0;
let prev = { ...s.pos };
for (let i = 0; i < 60 * 30; i++) {
  step();
  moved += Math.hypot(s.pos.x - prev.x, s.pos.y - prev.y);
  prev = { ...s.pos };
  if (s.side !== prevSide) { turnovers++; prevSide = s.side; }
}
console.log(`3) 재개 후 30초 — 공 이동거리 ${moved.toFixed(0)} 단위, 소유권 전환 ${turnovers}회 ${moved > 100 ? "✓" : "❌ 거의 안 움직임"}`);
