import type { FormationKey, MatchData, Player, Tactics } from "./types";
import type { MatchSnapshot } from "./matchEngine";
import type { Lang } from "./i18n";
import { compactness, type PitchFrame } from "./pitchPositions";
import { playerStamina } from "./stamina";
import { redCardRisk } from "./cards";
import { displayName } from "./i18n";

/**
 * 실시간 전술 피드백 (방송 로어서드).
 *
 * 사이드 패널의 AI 코치(aiCoach.ts)는 '지금 상황 전반'을 나열한다.
 * 이쪽은 다르다 — **지금 이 순간 감독이 결정해야 하는 단 하나**만 골라 화면 위로 올린다.
 * 그래서 규칙마다 (1) 발동 조건 (2) 근거 수치 (3) 원클릭 조치가 반드시 붙는다.
 *
 * 모든 판단은 실제 상태(스냅샷·배치·체력)에서 나오며 난수를 쓰지 않는다.
 */

export interface LiveInsight {
  id: string;
  /** 낮을수록 먼저 (우선순위) */
  rank: number;
  severity: "urgent" | "opportunity" | "info";
  title: string;
  detail: string;
  /** 판단 근거가 된 수치 — 주장만 하지 않고 항상 숫자를 같이 보여준다 */
  metric: { label: string; value: string };
  apply?: { formation?: FormationKey; tactics?: Partial<Tactics> };
}

export interface InsightInput {
  match: MatchData;
  snap: MatchSnapshot;
  frame: PitchFrame;
  tactics: Tactics;
  formation: FormationKey;
  players: Player[];
  minute: number;
  subsUsed: number;
  lang: Lang;
}

/** 현재 분에서 가장 중요한 인사이트 하나. 없으면 null */
export function liveInsight(input: InsightInput): LiveInsight | null {
  const all = allInsights(input);
  if (all.length === 0) return null;
  return all.sort((a, b) => a.rank - b.rank)[0];
}

function allInsights(input: InsightInput): LiveInsight[] {
  const { match, snap, frame, tactics, formation, players, minute, subsUsed, lang } = input;
  const ko = lang === "ko";
  const out: LiveInsight[] = [];

  const opp = ko ? match.away.nameKo : match.away.name;
  const [hs, as] = snap.score;
  const diff = hs - as;
  const gap = Math.round(frame.awayLine - frame.homeLine);
  const compact = compactness(frame.home);

  // 1) 방금 실점 — 최우선
  const conceded = match.timeline.find(
    (e) => e.type === "goal" && e.side === "away" && minute - e.minute >= 0 && minute - e.minute <= 2
  );
  if (conceded) {
    out.push({
      id: "conceded",
      rank: 0,
      severity: "urgent",
      title: ko ? "실점 직후 — 15분이 가장 위험하다" : "Just conceded — the next 15 min are the danger zone",
      detail: ko
        ? `${conceded.minute}분 실점. 통계적으로 실점 직후에 연속 실점이 가장 많이 나온다. 라인을 한 단계 내려 안정시킨 뒤 다시 올려라.`
        : `Conceded at ${conceded.minute}'. Teams concede again most often right after conceding. Drop the line a notch to steady, then push back up.`,
      metric: { label: ko ? "스코어" : "Score", value: `${hs}–${as}` },
      apply: { tactics: { line: Math.max(30, tactics.line - 18), press: Math.max(35, tactics.press - 10) } },
    });
  }

  // 2) 블록이 늘어졌다 — 두 라인 사이가 벌어지면 중원을 그냥 내준다
  if (frame.live && gap > 52) {
    out.push({
      id: "stretched",
      rank: 1,
      severity: "urgent",
      title: ko ? "두 라인 사이가 벌어졌다" : "Your block is stretched",
      detail: ko
        ? `우리 수비 라인과 상대 라인 간격이 ${gap}%다. 이 공간이 상대 미드필더에게 그대로 열려 있다. 라인을 올려 간격을 좁혀라.`
        : `The gap between the two defensive lines is ${gap}%. That space belongs to the opponent's midfield right now. Push up to compress it.`,
      metric: { label: ko ? "라인 간격" : "Line gap", value: `${gap}%` },
      apply: { tactics: { line: Math.min(78, tactics.line + 16), press: Math.min(80, tactics.press + 12) } },
    });
  }

  // 3) 팀이 흩어졌다
  if (frame.live && compact < 34) {
    out.push({
      id: "loose",
      rank: 2,
      severity: "urgent",
      title: ko ? "팀 간격이 흩어졌다" : "Your shape has come apart",
      detail: ko
        ? `컴팩트니스 ${compact}/100. 선수 간 거리가 멀어 압박이 걸리지 않고 세컨볼을 계속 내준다. 폭을 좁혀 밀집도를 회복하라.`
        : `Compactness ${compact}/100. Distances are too big to press and you keep losing second balls. Narrow up to restore density.`,
      metric: { label: ko ? "컴팩트니스" : "Compactness", value: `${compact}/100` },
      apply: { tactics: { width: Math.max(24, tactics.width - 20) } },
    });
  }

  // 4) 우리 진영에 갇혔다
  if (frame.live && frame.possession === "away" && frame.ball.y < 30) {
    out.push({
      id: "pinned",
      rank: 3,
      severity: "urgent",
      title: ko ? "우리 진영에 갇혔다" : "You're pinned in your own third",
      detail: ko
        ? `공이 우리 진영 ${Math.round(frame.ball.y)}% 지점에 머물고 상대가 점유 중이다. 역습 옵션을 켜서 탈출 경로를 만들어라.`
        : `The ball is sitting at ${Math.round(frame.ball.y)}% in your own half with the opponent on it. Switch on Counter to create an exit route.`,
      metric: { label: ko ? "공 위치" : "Ball zone", value: `${Math.round(frame.ball.y)}%` },
      apply: { tactics: { counter: true, tempo: Math.min(85, tactics.tempo + 15) } },
    });
  }

  // 5) 높은 라인 + 트랩 = 역습 한 방에 뚫린다
  if (tactics.line > 72 && tactics.offsideTrap) {
    out.push({
      id: "trap-gamble",
      rank: 4,
      severity: "urgent",
      title: ko ? "높은 라인 + 오프사이드 트랩은 도박이다" : "High line + offside trap is a coin flip",
      detail: ko
        ? `라인 ${tactics.line}%에서 트랩을 유지 중이다. 타이밍이 한 번만 어긋나면 일대일을 그대로 내준다.`
        : `Holding the trap with the line at ${tactics.line}%. One mistimed step concedes a clean one-on-one.`,
      metric: { label: ko ? "수비 라인" : "Line", value: `${tactics.line}%` },
      apply: { tactics: { offsideTrap: false, line: 58 } },
    });
  }

  // 5.5) 경고 보유 선수의 퇴장 위험 — 카드가 전술 제약으로 작동하는 지점
  const risks = redCardRisk(match, players, minute, tactics, ko ? "ko" : "en");
  const hot = risks.find((r) => r.risk >= 55);
  if (frame.live && hot) {
    const nm = displayName(lang, hot.player.name, hot.player.nameKo);
    out.push({
      id: `red-risk-${hot.player.id}`,
      rank: 1.5, // 라인 간격보다 급하다 — 수적 열세는 되돌릴 수 없다
      severity: "urgent",
      title: ko ? `${nm} 퇴장 위험 — 지금 손봐라` : `${nm} is a red card waiting to happen`,
      detail: ko
        ? `${hot.booking.minute}분 경고 보유 중. 위험도 ${hot.risk}/100 (${hot.drivers.join(" · ")}). 압박을 낮추거나 교체하라 — 수적 열세는 어떤 전술로도 못 되돌린다.`
        : `Booked at ${hot.booking.minute}'. Risk ${hot.risk}/100 (${hot.drivers.join(" · ")}). Ease the press or take them off — you cannot tactic your way out of ten men.`,
      metric: { label: ko ? "퇴장 위험" : "Red risk", value: `${hot.risk}/100` },
      apply: {
        tactics: {
          press: Math.max(25, tactics.press - 25),
          highPress: false,
          line: Math.min(tactics.line, 60),
        },
      },
    });
  }

  // 6) 체력 절벽 — 교체 카드가 남아 있을 때만
  if (frame.live && minute > 55 && subsUsed < 5) {
    const gassed = players
      .filter((p) => p.role.toUpperCase() !== "GK")
      .map((p) => playerStamina(p, minute, tactics))
      .filter((s) => s < 45);
    if (gassed.length >= 3) {
      out.push({
        id: "stamina-cliff",
        rank: 5,
        severity: "urgent",
        title: ko ? "체력이 무너지고 있다" : "Your legs are going",
        detail: ko
          ? `필드 ${gassed.length}명이 체력 45% 미만이다. 지금 교체하지 않으면 강도를 유지할 수 없다. 교체 ${5 - subsUsed}장 남음.`
          : `${gassed.length} outfield players are under 45% stamina. Intensity will collapse without a change. ${5 - subsUsed} subs left.`,
        metric: { label: ko ? "위험 인원" : "At risk", value: `${gassed.length}${ko ? "명" : ""}` },
        apply: { tactics: { press: Math.max(30, tactics.press - 18) } },
      });
    }
  }

  // 7) 약점 사이드가 열려 있다 (기회)
  if (frame.live && frame.possession === "home") {
    const onWeak =
      match.weakFlank === "left" ? frame.ball.x > 62 : frame.ball.x < 38;
    if (onWeak) {
      out.push({
        id: "weak-flank-live",
        rank: 6,
        severity: "opportunity",
        title: ko
          ? `지금 ${opp}의 약한 쪽이다 — 폭을 벌려라`
          : `You're on ${opp}'s weak side — stretch it`,
        detail: ko
          ? `공이 상대가 취약한 ${match.weakFlank === "left" ? "왼쪽(우리 오른쪽)" : "오른쪽(우리 왼쪽)"} 채널에 있다. 폭을 넓혀 윙어 1대1을 만들어라.`
          : `The ball is in the channel ${opp} struggles to cover. Widen up and isolate your winger one-on-one.`,
        metric: { label: ko ? "공 좌우" : "Ball x", value: `${Math.round(frame.ball.x)}%` },
        apply: { tactics: { width: Math.min(88, tactics.width + 20), attack: Math.min(85, tactics.attack + 10) } },
      });
    }
  }

  // 8) 기세를 잡았다 (기회)
  if (frame.live && snap.momentum > 42 && formation !== "343") {
    out.push({
      id: "momentum-push",
      rank: 7,
      severity: "opportunity",
      title: ko ? "흐름을 잡았다 — 지금 밀어붙여라" : "You have the momentum — press it now",
      detail: ko
        ? `기세 +${Math.round(snap.momentum)}. 상대가 흔들리는 이 구간에 공격수를 한 명 더 두면 확실한 기회로 바뀐다.`
        : `Momentum +${Math.round(snap.momentum)}. An extra forward while they're rocking turns pressure into clear chances.`,
      metric: { label: ko ? "기세" : "Momentum", value: `+${Math.round(snap.momentum)}` },
      apply: { formation: "343", tactics: { attack: Math.max(tactics.attack, 70) } },
    });
  }

  // 9) 리드 관리 (막판)
  if (frame.live && diff > 0 && minute > 75 && tactics.line > 55) {
    out.push({
      id: "close-out",
      rank: 8,
      severity: "info",
      title: ko ? "리드 중 — 경기를 닫아라" : "Leading — close the game out",
      detail: ko
        ? `${minute}분 ${hs}–${as} 리드. 라인을 내려 뒷공간을 지우고 템포를 낮춰 시간을 관리하라.`
        : `${minute}' and ${hs}–${as} up. Drop the line to erase the space in behind and slow the tempo to manage the clock.`,
      metric: { label: ko ? "잔여" : "Left", value: `${Math.max(0, 90 - minute)}'` },
      apply: { tactics: { line: 36, tempo: 40, attack: 42 } },
    });
  }

  return out;
}

/**
 * 득점/실점 직후 조언.
 *
 * 골 장면은 감독이 가장 크게 흔들리는 순간이다 — 세리머니가 도는 몇 초 동안
 * "그래서 지금 뭘 바꿔야 하는가"를 같이 보여준다. 일반 인사이트와 달리
 * 점수 상황과 남은 시간만으로 결정되므로 항상 하나가 나온다.
 */
export function postGoalAdvice(params: {
  snap: MatchSnapshot;
  tactics: Tactics;
  scoredBy: "home" | "away";
  minute: number;
  lang: Lang;
}): { title: string; detail: string; metric: { label: string; value: string }; apply: NonNullable<LiveInsight["apply"]> } {
  const { snap, tactics, scoredBy, minute, lang } = params;
  const ko = lang === "ko";
  const [hs, as] = snap.score;
  const diff = hs - as;
  const left = Math.max(0, 90 - minute);
  const late = minute > 70;
  const M = (label: string, value: string) => ({ label, value });

  if (scoredBy === "home") {
    if (diff > 0 && late) {
      return {
        title: ko ? "리드 — 이제 경기를 닫아라" : "Ahead — now close it out",
        detail: ko
          ? `${minute}분 ${hs}–${as}. 남은 ${left}분은 지키는 시간이다. 라인을 내려 뒷공간을 지우고 템포를 낮춰 시간을 관리하라.`
          : `${minute}' and ${hs}–${as} up. The remaining ${left} minutes are about control. Drop the line and slow the tempo.`,
        metric: M(ko ? "잔여" : "Left", `${left}'`),
        apply: { tactics: { line: 36, tempo: 40, attack: 44 } },
      };
    }
    if (diff > 0) {
      return {
        title: ko ? "앞서간다 — 흐름을 놓지 마라" : "In front — keep the pressure on",
        detail: ko
          ? `${hs}–${as}. 지금 물러서면 상대가 살아난다. 압박을 유지해 두 번째 골로 승부를 끝내라.`
          : `${hs}–${as}. Sitting back now invites them in. Hold the press and go for the second.`,
        metric: M(ko ? "기세" : "Momentum", `+${Math.round(Math.abs(snap.momentum))}`),
        apply: { tactics: { press: Math.min(78, tactics.press + 12), attack: Math.min(72, tactics.attack + 6) } },
      };
    }
    if (diff === 0) {
      return {
        title: ko ? "동점 — 지금이 뒤집을 구간이다" : "Level — this is the window",
        detail: ko
          ? `${hs}–${as}. 득점 직후 5~10분은 상대가 가장 흔들리는 시간이다. 라인을 올리고 밀어붙여 역전까지 가라.`
          : `${hs}–${as}. The 5–10 minutes after a goal are when the opponent is most rattled. Push the line up and take the lead.`,
        metric: M(ko ? "잔여" : "Left", `${left}'`),
        apply: { formation: "343", tactics: { attack: 76, line: 68, press: 70 } },
      };
    }
    return {
      title: ko ? "한 골 따라붙었다 — 계속 간다" : "One back — keep going",
      detail: ko
        ? `${hs}–${as}로 아직 뒤진다. 남은 ${left}분에 총력전이 필요하다. 공격 성향과 템포를 최대로 올려라.`
        : `Still behind at ${hs}–${as} with ${left} minutes left. Go all in on Attack and Tempo.`,
      metric: M(ko ? "득실차" : "Goal diff", `${diff}`),
      apply: { tactics: { attack: 88, line: 74, tempo: 76 } },
    };
  }

  // 실점
  if (diff < 0) {
    return {
      title: ko ? "실점 — 되찾아야 한다" : "Conceded — you have to respond",
      detail: ko
        ? `${hs}–${as}로 뒤진다. 남은 ${left}분. ${late ? "지금부터는 위험을 감수해야 한다 — 라인을 끌어올려 상대를 가둬라." : "서두르지 말고 라인을 올려 점유를 되찾아라."}`
        : `Down ${hs}–${as} with ${left} left. ${late ? "Time to take risks — push the line and trap them in." : "Don't panic — raise the line and win the ball back higher."}`,
      metric: M(ko ? "잔여" : "Left", `${left}'`),
      apply: { tactics: { attack: late ? 86 : 70, line: late ? 76 : 64, tempo: 72 } },
    };
  }
  if (diff === 0) {
    return {
      title: ko ? "동점을 허용했다 — 먼저 안정시켜라" : "Pegged back — steady first",
      detail: ko
        ? `${hs}–${as}. 실점 직후 연속 실점이 가장 많이 나온다. 5분만 라인을 내려 안정시킨 뒤 다시 올려라.`
        : `${hs}–${as}. Teams concede again most often right after conceding. Steady for five minutes, then push again.`,
      metric: M(ko ? "스코어" : "Score", `${hs}–${as}`),
      apply: { tactics: { line: Math.max(34, tactics.line - 16), press: Math.max(38, tactics.press - 10) } },
    };
  }
  return {
    title: ko ? "리드는 유지 중 — 뒷공간을 지워라" : "Still ahead — kill the space behind",
    detail: ko
      ? `${hs}–${as}로 앞서 있지만 흐름이 넘어갔다. 라인을 내려 뒷공간을 없애고 다시 잡아라.`
      : `${hs}–${as} up but the momentum shifted. Drop the line to erase the space in behind and reset.`,
    metric: M(ko ? "스코어" : "Score", `${hs}–${as}`),
    apply: { tactics: { line: 40, press: Math.max(40, tactics.press - 8) } },
  };
}

export const SEVERITY_COLOR: Record<LiveInsight["severity"], string> = {
  urgent: "#d03b3b",
  opportunity: "#0ca30c",
  info: "#3987e5",
};
