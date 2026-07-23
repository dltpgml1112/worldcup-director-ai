import type { MatchData, Player, Tactics } from "./types";
import type { MatchSnapshot } from "./matchEngine";
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
  alt: { score: [number, number]; homeWinProb: number }
): MatchReport {
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

    const note =
      goals > 1
        ? `${goals} goals — unplayable`
        : goals === 1
        ? "On the scoresheet"
        : involve >= 2
        ? "Kept creating"
        : stam < 40
        ? "Ran himself into the ground"
        : "Solid shift";

    return { id: p.id, name: p.name, num: p.num, role: p.role, rating: round1(score), goals, note };
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

  const homeName = match.home.name;
  const oppName = match.away.name;
  const resultWord = won ? "beat" : drew ? "drew with" : "fell to";
  const realChanged =
    alt.score[0] !== match.finalScore[0] || alt.score[1] !== match.finalScore[1];

  const verdict =
    `Grade ${grade}. Directing ${homeName}, ${coachName} ${resultWord} ${oppName} ${ug}–${og} ` +
    `on a projected ${alt.homeWinProb}% win probability. ` +
    (realChanged
      ? `That rewrites the real ${match.finalScore[0]}–${match.finalScore[1]} — history bent to your tactics.`
      : `The scoreline mirrors reality, but the process behind it was all yours.`) +
    ` ${motm.name} was the difference-maker.`;

  const headlines = [
    won
      ? `${coachName.toUpperCase()}'S ${homeName.toUpperCase()} CONQUER THE WORLD`
      : drew
      ? `${homeName.toUpperCase()} DIG IN AS ${coachName.toUpperCase()} EARNS A POINT ON THE BIGGEST STAGE`
      : `HEARTBREAK FOR ${coachName.toUpperCase()} AS ${oppName.toUpperCase()} EDGE THE FINAL`,
    `${motm.name} runs the show — ${motm.rating.toFixed(1)}/10 and the Man of the Match award`,
    realChanged
      ? `Butterfly effect: bold tactics turn the ${match.finalScore[0]}–${match.finalScore[1]} on its head`
      : `Same result, new legend: ${coachName} controls the final his own way`,
  ];

  return { ratings, motm, grade, gradeScore: Math.round(gradeScore), verdict, headlines };
}
