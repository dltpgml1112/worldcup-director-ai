import type { MatchData } from "./types";

/**
 * 표시 순서를 **실제 경기의 홈팀 기준**으로 되돌린다.
 *
 * 엔진은 사용자 팀을 항상 `home` 슬롯에 넣는다 (lib/types.ts의 `actualHome` 주석 참고).
 * 그래서 슬롯 순서 그대로 그리면, 실제로는 원정이었던 경기가 뒤집혀 보인다.
 * 2026 A조 3차전이 그렇다 — 공식 기록은 "남아공 1-0 대한민국"인데 슬롯 순서로는
 * "대한민국 0-1 남아공"으로 나온다. 값은 같지만 경기를 아는 사람에게는 틀려 보인다.
 *
 * 데이터는 그대로 두고 **표시 단계에서만** 순서를 맞춘다.
 */
export function orientFixture<T>(
  match: Pick<MatchData, "actualHome">,
  homeValue: T,
  awayValue: T
): { left: T; right: T; flipped: boolean } {
  const flipped = match.actualHome === "away";
  return {
    left: flipped ? awayValue : homeValue,
    right: flipped ? homeValue : awayValue,
    flipped,
  };
}

/**
 * 사용자가 **원정팀을 맡을 수 있게** 경기를 좌우로 뒤집는다.
 *
 * 엔진 전체가 "사용자 팀 = home 슬롯"으로 굳어 있어서(lib/types.ts의 actualHome 주석),
 * 아르헨티나-프랑스 결승에서 프랑스를 맡으려면 데이터 자체를 뒤집어 넘기는 수밖에 없다.
 * 리팩터링 없이 재생 경기에서 팀 선택을 열어주는 방법이다.
 *
 * 스코어·이벤트의 side·벤치·대형·실제 홈 표기까지 전부 함께 뒤집어야 한 군데도
 * 어긋나지 않는다.
 */
export function mirrorMatch(m: MatchData): MatchData {
  return {
    ...m,
    id: `${m.id}@away`,
    home: m.away,
    away: m.home,
    homeXI: m.awayXI,
    awayXI: m.homeXI,
    homeBench: m.awayBench,
    awayBench: m.homeBench,
    homeShape: m.awayShape,
    awayShape: m.homeShape,
    finalScore: [m.finalScore[1], m.finalScore[0]],
    penalties: m.penalties ? [m.penalties[1], m.penalties[0]] : undefined,
    timeline: m.timeline.map((e) => ({ ...e, side: e.side === "home" ? "away" : "home" })),
    // 피치가 좌우로 뒤집히므로 취약 사이드도 반대가 된다
    weakFlank: m.weakFlank === "left" ? "right" : "left",
    actualHome: (m.actualHome ?? "home") === "home" ? "away" : "home",
  };
}

/** 실제 홈팀 기준으로 정렬한 스코어 (예: [1, 0] = 남아공 1 - 대한민국 0) */
export function orientedScore(match: Pick<MatchData, "actualHome">, score: [number, number]): [number, number] {
  const { left, right } = orientFixture(match, score[0], score[1]);
  return [left, right];
}
