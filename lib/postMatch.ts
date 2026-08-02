import type { MatchData, Player, Tactics } from "./types";
import type { MatchSnapshot } from "./matchEngine";
import type { Lang } from "./i18n";
import { displayName } from "./i18n";
import { playerStamina } from "./stamina";

export interface PlayerRating {
  id: string;
  name: string;
  num: number;
  role: string;
  rating: number; // 5.0 - 10.0
  goals: number;
  note: string;
}

export interface MatchReport {
  ratings: PlayerRating[];
  motm: PlayerRating;
  grade: string;
  gradeScore: number;
  verdict: string;
  headlines: string[];
}

/** 이벤트가 특정 선수를 지칭하는지 (성 기준 부분일치) */
function mentions(eventPlayer: string | undefined, player: Player): boolean {
  if (!eventPlayer) return false;
  const last = player.name.split(" ").pop()?.replace(/[()]/g, "").toLowerCase() ?? "";
  return last.length > 2 && eventPlayer.toLowerCase().includes(last);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 경기 종료 리포트 생성 — 선수 평점, MOTM, 등급, AI 총평, 백페이지 헤드라인.
 * 평점 = 기본기량 + 골/관여 + 체력관리 보정. 결정론적이라 재현 가능.
 */
export function buildReport(
  match: MatchData,
  players: Player[],
  snap: MatchSnapshot,
  tactics: Tactics,
  coachName: string,
  alt: { score: [number, number]; homeWinProb: number },
  lang: Lang = "en"
): MatchReport {
  const ko = lang === "ko";
  const homeGoals = match.timeline.filter((e) => e.side === "home" && e.type === "goal");
  const homeInvolve = match.timeline.filter(
    (e) => e.side === "home" && (e.type === "goal" || e.type === "shot" || e.type === "chance")
  );

  const ratings: PlayerRating[] = players.map((p) => {
    const goals = homeGoals.filter((e) => mentions(e.player, p)).length;
    const involve = homeInvolve.filter((e) => mentions(e.player, p)).length;
    const stam = playerStamina(p, Math.min(snap.minute, 120), tactics);

    let score = p.rating / 10; // 8.7 base
    score += goals * 0.9;
    score += involve * 0.14;
    if (p.role.toUpperCase() === "GK") score += snap.score[1] === 0 ? 0.6 : snap.score[1] <= 1 ? 0.2 : -0.2;
    if (stam < 35) score -= 0.4;
    else if (stam < 50) score -= 0.15;
    score = Math.max(5.2, Math.min(10, score));

    const note = ko
      ? goals > 1
        ? `${goals}골 — 압도적`
        : goals === 1
        ? "득점 성공"
        : involve >= 2
        ? "꾸준히 기회 창출"
        : stam < 40
        ? "체력을 쏟아부었다"
        : "안정적인 활약"
      : goals > 1
      ? `${goals} goals — unplayable`
      : goals === 1
      ? "On the scoresheet"
      : involve >= 2
      ? "Kept creating"
      : stam < 40
      ? "Ran himself into the ground"
      : "Solid shift";

    return { id: p.id, name: displayName(lang, p.name, p.nameKo), num: p.num, role: p.role, rating: round1(score), goals, note };
  });

  const motm = [...ratings].sort((a, b) => b.rating - a.rating || b.goals - a.goals)[0];

  // 등급: 대체역사 승률 + 결과
  const [ug, og] = alt.score;
  const won = ug > og;
  const drew = ug === og;
  const gradeScore = Math.max(
    0,
    Math.min(100, alt.homeWinProb + (won ? 16 : drew ? 4 : -6) + (ug - og) * 5)
  );
  const grade =
    gradeScore >= 90
      ? "A+"
      : gradeScore >= 80
      ? "A"
      : gradeScore >= 70
      ? "B+"
      : gradeScore >= 60
      ? "B"
      : gradeScore >= 50
      ? "C+"
      : gradeScore >= 40
      ? "C"
      : "D";

  const homeName = ko ? match.home.nameKo : match.home.name;
  const oppName = ko ? match.away.nameKo : match.away.name;

  /*
   * 캠페인 맥락 — "4강 스페인전"과 "친선경기"는 같은 2-1이어도 무게가 다르다.
   * 라운드와 진출 여부를 총평 맨 앞에 세운다. 경기 데이터가 이미 라운드를 들고 있어서
   * (stage/stageKo) 별도 인자 없이 판단할 수 있다.
   */
  const isCampaign = match.id.startsWith("campaign-");
  const roundLabel = (ko ? match.stageKo : match.stage) ?? match.stage;
  const isFinalRound = /final/i.test(match.stage) && !/quarter|semi/i.test(match.stage);
  const throughByPens = match.penalties ? match.penalties[0] > match.penalties[1] : false;
  const wentThrough = match.finalScore[0] > match.finalScore[1] || throughByPens;

  const stakeLine = !isCampaign
    ? ""
    : ko
    ? wentThrough
      ? isFinalRound
        ? `${roundLabel}에서 이겼다. 대한민국이 세계 챔피언이다. `
        : `${roundLabel} 통과. `
      : `${roundLabel}에서 멈췄다. `
    : wentThrough
    ? isFinalRound
      ? `${roundLabel} won. Korea are world champions. `
      : `Through the ${roundLabel}. `
    : `Stopped in the ${roundLabel}. `;
  const realChanged =
    alt.score[0] !== match.finalScore[0] || alt.score[1] !== match.finalScore[1];
  const realStr = `${match.finalScore[0]}–${match.finalScore[1]}`;

  let verdict: string;
  let headlines: string[];

  if (ko) {
    const resultWord = won ? "이기고" : drew ? "비기며" : "패해";
    verdict =
      stakeLine +
      `등급 ${grade}. ${homeName}을(를) 이끈 ${coachName} 감독은 ${oppName}을(를) 상대로 ${ug}–${og}으로 ${resultWord} ` +
      `예상 승률 ${alt.homeWinProb}%를 기록했다. ` +
      (realChanged
        ? `이는 실제 결과 ${realStr}을(를) 뒤집은 것이다 — 당신의 전술이 역사를 바꿨다.`
        : `스코어는 실제와 같지만, 그 과정은 온전히 당신의 것이었다.`) +
      ` ${motm.name}이(가) 승부를 갈랐다.`;
    headlines = [
      isCampaign && wentThrough && isFinalRound
        ? `${homeName}, 월드컵을 들어올리다 — ${coachName} 감독의 대관식`
        : isCampaign && wentThrough
        ? `${homeName} ${roundLabel} 돌파 — ${coachName} 감독이 역사를 다시 썼다`
        : won
        ? `${coachName} 감독의 ${homeName}, 세계를 놀라게 하다`
        : drew
        ? `${homeName}, 값진 승점 1점 — ${coachName} 감독의 뚝심`
        : `${coachName} 감독의 아쉬움 — ${oppName}에 석패`,
      `${motm.name} 원맨쇼 — 평점 ${motm.rating.toFixed(1)}, MOTM 선정`,
      realChanged
        ? `나비효과: 과감한 전술이 ${realStr}을 뒤집다`
        : `같은 결과, 새로운 전설: ${coachName}만의 방식으로 경기를 지배`,
    ];
  } else {
    const resultWord = won ? "beat" : drew ? "drew with" : "fell to";
    verdict =
      stakeLine +
      `Grade ${grade}. Directing ${homeName}, ${coachName} ${resultWord} ${oppName} ${ug}–${og} ` +
      `on a projected ${alt.homeWinProb}% win probability. ` +
      (realChanged
        ? `That rewrites the real ${realStr} — history bent to your tactics.`
        : `The scoreline mirrors reality, but the process behind it was all yours.`) +
      ` ${motm.name} was the difference-maker.`;
    headlines = [
      won
        ? `${coachName.toUpperCase()}'S ${homeName.toUpperCase()} STUN THE WORLD`
        : drew
        ? `${homeName.toUpperCase()} DIG IN AS ${coachName.toUpperCase()} EARNS A POINT ON THE BIGGEST STAGE`
        : `HEARTBREAK FOR ${coachName.toUpperCase()} AS ${oppName.toUpperCase()} EDGE IT`,
      `${motm.name} runs the show — ${motm.rating.toFixed(1)}/10 and the Man of the Match award`,
      realChanged
        ? `Butterfly effect: bold tactics turn the ${realStr} on its head`
        : `Same result, new legend: ${coachName} controls the game his own way`,
    ];
  }

  return { ratings, motm, grade, gradeScore: Math.round(gradeScore), verdict, headlines };
}
