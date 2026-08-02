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

/** 실제 홈팀 기준으로 정렬한 스코어 (예: [1, 0] = 남아공 1 - 대한민국 0) */
export function orientedScore(match: Pick<MatchData, "actualHome">, score: [number, number]): [number, number] {
  const { left, right } = orientFixture(match, score[0], score[1]);
  return [left, right];
}
