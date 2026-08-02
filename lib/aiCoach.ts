import type { FormationKey, MatchData, Player, Tactics } from "./types";
import type { MatchSnapshot } from "./matchEngine";
import type { Lang } from "./i18n";
import { displayName } from "./i18n";
import { playerStamina } from "./stamina";

export interface CoachTip {
  id: string;
  headline: string;
  reason: string;
  confidence: number; // 0-100
  severity: "info" | "opportunity" | "warning";
  apply?: { formation?: FormationKey; tactics?: Partial<Tactics> }; // 원클릭 반영 payload
}

/**
 * 결정론적 택티컬 어시스턴트 (한/영).
 * 경기 스냅샷 + 현재 택틱 + 포메이션 + 스쿼드를 읽어 근거 있는 추천을 생성한다.
 * confidence = 근거 지표의 강도(설명 가능).
 */
export function coachTips(
  match: MatchData,
  snap: MatchSnapshot,
  tactics: Tactics,
  formation: FormationKey,
  players: Player[] = [],
  subsUsed = 0,
  lang: Lang = "en"
): CoachTip[] {
  const tips: CoachTip[] = [];
  const [hs, as] = snap.score;
  const diff = hs - as;
  const ko = lang === "ko";
  const opp = ko ? match.away.nameKo : match.away.name;

  /*
   * 0) 이 경기에 무엇이 걸렸는가.
   *
   * 같은 2-1도 8강이냐 조별리그냐에 따라 감독의 판단이 달라진다. 토너먼트는 비기면
   * 연장·승부차기라 "지지만 않으면 된다"가 성립하지 않는다 — 그걸 먼저 말해준다.
   */
  if (match.id.startsWith("campaign-")) {
    const round = (ko ? match.stageKo : match.stage) ?? match.stage;
    const isFinalRound = /final/i.test(match.stage) && !/quarter|semi/i.test(match.stage);
    const groupStage = /group/i.test(match.stage);
    tips.push({
      id: "stake",
      headline: ko
        ? isFinalRound
          ? `결승이다. ${opp}만 넘으면 우승이다.`
          : groupStage
          ? `${round} — 비기기만 해도 16강이다.`
          : `${round} — 이기면 다음 라운드, 비기면 연장·승부차기다.`
        : isFinalRound
        ? `The final. Beat ${opp} and it's yours.`
        : groupStage
        ? `${round} — a draw is enough to go through.`
        : `${round} — win to advance; a draw means extra time and penalties.`,
      reason: ko
        ? groupStage
          ? "승점 3의 한국, 1의 남아공. 무승부면 조 2위로 통과한다. 무리한 공격이 오히려 역습을 부른다."
          : diff === 0
          ? "동점으로 끝나면 연장 30분과 승부차기다. 체력 관리를 교체 계획에 반영하라."
          : diff > 0
          ? "앞서 있다. 남은 시간 관리와 실점 위험 사이에서 선택하라."
          : "뒤지고 있다. 토너먼트에서는 무승부도 탈락이 아니지만, 지고 있으면 시간이 적이다."
        : groupStage
        ? "Korea on 3 points, South Africa on 1 — a draw sends you through. Over-committing invites the counter."
        : diff === 0
        ? "Level means 30 minutes of extra time and penalties. Factor that into your substitutions."
        : diff > 0
        ? "You're ahead — balance game management against the risk of conceding."
        : "You're behind, and in a knockout the clock is the opponent.",
      confidence: 92,
      severity: diff < 0 ? "warning" : "info",
    });
  }

  // 1) 상대 약점 사이드 공략
  tips.push({
    id: "weak-flank",
    headline: ko
      ? match.weakFlank === "left"
        ? `${opp}의 왼쪽이 열려 있다 — 오른쪽으로 공략하라.`
        : `${opp}의 오른쪽이 열려 있다 — 왼쪽에 수적 우위를 만들어라.`
      : match.weakFlank === "left"
      ? `${opp}'s left channel is exposed — attack down your right.`
      : `${opp}'s right channel is exposed — overload your left.`,
    reason: ko
      ? "그쪽 풀백이 높이 올라가 뒷공간이 비었다. 폭(Width)을 넓히고 윙어의 1대1을 유도하라."
      : "Opponent full-back on that side is caught high; heatmap shows space in behind. Widen play (Width ↑) and push your winger 1-v-1.",
    confidence: 76,
    severity: "opportunity",
    apply: { tactics: { width: 82, attack: Math.max(tactics.attack, 62) } },
  });

  // 2) 점수차 기반 공격/수비 조정
  if (diff < 0) {
    tips.push({
      id: "chase",
      headline: ko ? "뒤지고 있다 — 공격 성향을 올리고 라인을 끌어올려라." : "You're behind — raise Attack & push the line up.",
      reason: ko
        ? `${hs}–${as}로 뒤진 채 시간이 흐른다. 공격 성향과 수비 라인을 높이면 더 많은 인원이 전진하고 상대를 압축할 수 있다.`
        : `Trailing ${hs}–${as} with time slipping. Increasing Attack Level and Defensive Line commits more bodies forward and compresses the pitch.`,
      confidence: 82,
      severity: "warning",
      apply: { tactics: { attack: 82, line: 70, tempo: 68 } },
    });
  } else if (diff > 1) {
    tips.push({
      id: "manage",
      headline: ko ? "두 골 차 리드 — 라인과 템포를 낮추는 걸 고려하라." : "Two-goal cushion — consider dropping the line & tempo.",
      reason: ko
        ? "리드를 지켜라: 수비 라인을 낮춰 뒷공간을 죽이고 템포를 늦춰 점유율을 관리하라."
        : "Protect the lead: lower Defensive Line to kill the space in behind and slow Tempo to control possession.",
      confidence: 71,
      severity: "info",
      apply: { tactics: { line: 34, tempo: 40, attack: 42 } },
    });
  }

  // 3) 압박/체력 경고
  if (tactics.press > 75 && snap.minute > 60) {
    tips.push({
      id: "press-fatigue",
      headline: ko ? "후반 강한 압박이 체력을 갉아먹고 있다." : "High press is burning stamina late on.",
      reason: ko
        ? `${snap.minute}분에 압박 ${tactics.press}%는 공간을 내줄 위험이 있다. 강도를 낮추거나 활력 있는 교체를 하라.`
        : `Press at ${tactics.press}% after minute ${snap.minute} risks gaps. Ease off or make an energetic substitution.`,
      confidence: 68,
      severity: "warning",
      apply: { tactics: { press: 45, highPress: false } },
    });
  }

  // 4) 모멘텀 대응
  if (snap.momentum < -35) {
    tips.push({
      id: "stem-momentum",
      headline: ko ? "상대에게 기세가 넘어갔다 — 352로 중원을 보강하라." : "Opponent has the momentum — switch to 352 to add a midfielder.",
      reason: ko
        ? `기세가 ${opp} 쪽으로 ${Math.abs(Math.round(snap.momentum))}만큼 기울었다. 스리백이 중원을 안정시키고 윙백을 풀어 압박을 덜어준다.`
        : `Momentum swung ${Math.round(snap.momentum)} toward ${opp}. A back three steadies the middle and frees wing-backs to relieve pressure.`,
      confidence: 64,
      severity: "warning",
      apply: { formation: "352" },
    });
  } else if (snap.momentum > 40 && formation !== "343") {
    tips.push({
      id: "press-advantage",
      headline: ko ? "흐름을 잡았다 — 343으로 득점을 노려라." : "You're on top — go 343 and hunt a goal.",
      reason: ko
        ? `기세 +${Math.round(snap.momentum)}. 공격수 한 명을 더 두면 흔들리는 상대를 상대로 확실한 기회를 만든다.`
        : `Momentum +${Math.round(snap.momentum)}. An extra forward turns pressure into clear chances while the opponent is rocking.`,
      confidence: 66,
      severity: "opportunity",
      apply: { formation: "343", tactics: { attack: Math.max(tactics.attack, 68) } },
    });
  }

  // 5) 오프사이드 트랩 리스크
  if (tactics.offsideTrap && tactics.line > 70) {
    tips.push({
      id: "trap-risk",
      headline: ko ? "오프사이드 트랩 + 매우 높은 라인은 도박이다." : "Offside trap + very high line is a coin-flip.",
      reason: ko
        ? "타이밍이 한 번만 어긋나도 침투에 그대로 뚫린다. 수비진이 빠르고 호흡이 맞을 때만 유지하라."
        : "One mistimed step lets a runner clean through. Keep it only if your defenders are quick and coordinated.",
      confidence: 59,
      severity: "warning",
      apply: { tactics: { offsideTrap: false, line: Math.min(tactics.line, 55) } },
    });
  }

  // 6) 체력 고갈 → 교체 권고
  if (players.length && snap.minute > 55 && subsUsed < 5) {
    const gassed = players
      .filter((p) => p.role.toUpperCase() !== "GK")
      .map((p) => ({ p, s: playerStamina(p, snap.minute, tactics) }))
      .filter((x) => x.s < 42)
      .sort((a, b) => a.s - b.s);
    if (gassed.length) {
      const worst = gassed[0];
      const nm = displayName(lang, worst.p.name, worst.p.nameKo);
      tips.push({
        id: "sub-fatigue",
        headline: ko
          ? `${nm} 체력 고갈 (${Math.round(worst.s)}%) — 활력 있는 선수를 투입하라.`
          : `${nm} is gassed (${Math.round(worst.s)}%) — bring on fresh legs.`,
        reason: ko
          ? `${snap.minute}분 현재 필드 선수 ${gassed.length}명이 체력 42% 미만이다. 교체로 강도를 회복하고 ${diff >= 0 ? "리드" : "추격"}을 지켜라. 교체 ${5 - subsUsed}명 남음.`
          : `${gassed.length} of your outfield players are below 42% stamina at minute ${snap.minute}. A substitution restores intensity and protects the ${diff >= 0 ? "lead" : "chase"}. You have ${5 - subsUsed} left.`,
        confidence: Math.min(88, 60 + Math.round((42 - worst.s) * 1.5)),
        severity: "warning",
      });
    }
  }

  return tips.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}
