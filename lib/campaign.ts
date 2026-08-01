import type { MatchData, Player, Tactics, Team } from "./types";
import { simulateTimeline } from "./simulateMatch";

/**
 * 캠페인 — "다시 쓰는 2026".
 *
 * 시작점은 실제로 열린 A조 3차전(남아공전)이다. 한국은 그 경기를 0-1로 지고 탈락했다.
 * 이기면 승점 6으로 A조 2위가 되어 **남아공이 차지했던 브래킷 자리를 승계**하고,
 * 그 뒤로는 실제 그 자리에 있었던 팀들과 차례로 만난다.
 *
 * 첫 경기(남아공전)만 실측 타임라인 재생이고, 32강부터는 열린 적 없는 경기라
 * lib/simulateMatch.ts가 전술·라인업에서 타임라인을 생성한다.
 */

export interface CampaignRound {
  id: string;
  /** 1부터. 남아공전(order 0)은 실측 경기라 CAMPAIGN_ROUNDS에 들어가지 않는다. */
  order: number;
  stage: string;
  stageKo: string;
  venue: string;
  venueKo: string;
  kickoff: string;
  opponent: Team;
  opponentXI: Player[];
  opponentShape: string;
  opponentTactics: Tactics;
  weakFlank: "left" | "right";
  /** 실제로 이 자리에서 벌어진 일 — 라운드 브리핑에 그대로 보여준다 */
  realContext: string;
  realContextKo: string;
  /**
   * 이 라운드에 대응하는 실측 경기가 MATCHES에 있으면 그 id.
   * 남아공전만 해당한다 — 실제로 열린 경기라 원본을 그대로 다시 볼 수 있다.
   */
  realMatchId?: string;
  /**
   * 토너먼트는 무승부로 끝날 수 없다 → 연장·승부차기.
   * 조별리그(group3)만 false. 3차전 직전 순위가 한국 3점 · 남아공 1점이었으므로
   * **비기기만 해도 한국이 A조 2위로 16강**이었다. 그래서 무승부도 통과로 친다.
   */
  needsWinner?: boolean;
}

/** 이 라운드를 통과했는가 — 조별리그는 무승부도 통과, 토너먼트는 승자만 */
export function passesRound(round: CampaignRound, result: RoundResult): boolean {
  if (round.needsWinner === false) return result.outcome !== "loss";
  return advanced(result);
}

/** 실제로 열린 A조 3차전 (실측 재생용) */
export const REAL_OPENER_ID = "kor-rsa-2026";

/** 캠페인의 첫 라운드 */
export const FIRST_ROUND_ID = "group3";

export type RoundOutcome = "win" | "draw" | "loss";

export interface RoundResult {
  roundId: string;
  score: [number, number];
  penalties?: [number, number];
  outcome: RoundOutcome;
}

/** 승부차기까지 반영한 최종 진출 여부 */
export function advanced(r: RoundResult): boolean {
  if (r.penalties) return r.penalties[0] > r.penalties[1];
  return r.score[0] > r.score[1];
}

export function outcomeOf(score: [number, number]): RoundOutcome {
  if (score[0] > score[1]) return "win";
  if (score[0] < score[1]) return "loss";
  return "draw";
}

/**
 * 캠페인 매치를 만든다.
 *
 * 사용자 팀은 항상 home 슬롯에 들어간다 — 엔진 전체가 "사용자 = home"으로 돼 있기
 * 때문이다 (lib/types.ts의 actualHome 주석 참고). 토너먼트는 무승부로 끝날 수 없으므로
 * needsWinner를 켜서 연장·승부차기까지 생성한다.
 */
export function buildRoundMatch(params: {
  round: CampaignRound;
  korea: Team;
  koreaXI: Player[];
  koreaBench: Player[];
  koreaShape: string;
  tactics: Tactics;
}): MatchData {
  const { round, korea, koreaXI, koreaBench, koreaShape, tactics } = params;

  const sim = simulateTimeline({
    matchId: `campaign-${round.id}`,
    homeXI: koreaXI,
    awayXI: round.opponentXI,
    homeTactics: tactics,
    awayTactics: round.opponentTactics,
    needsWinner: round.needsWinner !== false,
  });

  return {
    id: `campaign-${round.id}`,
    year: 2026,
    stage: round.stage,
    stageKo: round.stageKo,
    venue: round.venue,
    venueKo: round.venueKo,
    kickoff: round.kickoff,
    home: korea,
    away: round.opponent,
    homeXI: koreaXI,
    awayXI: round.opponentXI,
    homeBench: koreaBench,
    homeShape: koreaShape,
    awayShape: round.opponentShape,
    timeline: sim.timeline,
    finalScore: sim.finalScore,
    penalties: sim.penalties,
    weakFlank: round.weakFlank,
    dataSource: "simulated",
    timelineNoteKo:
      "이 경기는 실제로 열리지 않았다. 상대·라운드·상대 선발은 실측이지만, 경기 내용(골·슛·경고)은 전술과 라인업에서 생성된 시뮬레이션이다.",
    timelineNote:
      "This match never took place. The opponent, the round and their starting XI are real; the events (goals, shots, cards) are simulated from your tactics and lineup.",
    realNarrative: round.realContext,
    realNarrativeKo: round.realContextKo,
  };
}
