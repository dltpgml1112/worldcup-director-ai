import type { FormationKey, MatchData, Player, Tactics } from "./types";
import type { MatchSnapshot } from "./matchEngine";
import type { Lang } from "./i18n";
import { compactness, type PitchFrame } from "./pitchPositions";
import { playerStamina } from "./stamina";

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

export const SEVERITY_COLOR: Record<LiveInsight["severity"], string> = {
  urgent: "#d03b3b",
  opportunity: "#0ca30c",
  info: "#3987e5",
};
