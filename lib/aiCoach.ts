import type { FormationKey, MatchData, Tactics } from "./types";
import type { MatchSnapshot } from "./matchEngine";

export interface CoachTip {
  id: string;
  headline: string;
  reason: string;
  confidence: number; // 0-100
  severity: "info" | "opportunity" | "warning";
}

/**
 * 결정론적 택티컬 어시스턴트.
 * 경기 스냅샷 + 현재 택틱 + 포메이션을 읽어 근거 있는 추천을 생성한다.
 * confidence = 근거 지표의 강도(설명 가능).
 */
export function coachTips(
  match: MatchData,
  snap: MatchSnapshot,
  tactics: Tactics,
  formation: FormationKey
): CoachTip[] {
  const tips: CoachTip[] = [];
  const [hs, as] = snap.score;
  const diff = hs - as;

  // 1) 상대 약점 사이드 공략
  const flank = match.away.name;
  tips.push({
    id: "weak-flank",
    headline:
      match.weakFlank === "left"
        ? `${flank}'s left channel is exposed — attack down your right.`
        : `${flank}'s right channel is exposed — overload your left.`,
    reason: `Opponent full-back on that side is caught high; heatmap shows space in behind. Widen play (Width ↑) and push your winger 1-v-1.`,
    confidence: 76,
    severity: "opportunity",
  });

  // 2) 점수차 기반 공격/수비 조정
  if (diff < 0) {
    tips.push({
      id: "chase",
      headline: "You're behind — raise Attack & push the line up.",
      reason: `Trailing ${hs}–${as} with time slipping. Increasing Attack Level and Defensive Line commits more bodies forward and compresses the pitch.`,
      confidence: 82,
      severity: "warning",
    });
  } else if (diff > 1) {
    tips.push({
      id: "manage",
      headline: "Two-goal cushion — consider dropping the line & tempo.",
      reason: `Protect the lead: lower Defensive Line to kill the space in behind and slow Tempo to control possession.`,
      confidence: 71,
      severity: "info",
    });
  }

  // 3) 압박/체력 경고
  if (tactics.press > 75 && snap.minute > 60) {
    tips.push({
      id: "press-fatigue",
      headline: "High press is burning stamina late on.",
      reason: `Press at ${tactics.press}% after minute ${snap.minute} risks gaps. Ease off or make an energetic substitution.`,
      confidence: 68,
      severity: "warning",
    });
  }

  // 4) 모멘텀 대응
  if (snap.momentum < -35) {
    tips.push({
      id: "stem-momentum",
      headline: "Opponent has the momentum — switch to 352 to add a midfielder.",
      reason: `Momentum swung ${Math.round(snap.momentum)} toward ${flank}. A back three steadies the middle and frees wing-backs to relieve pressure.`,
      confidence: 64,
      severity: "warning",
    });
  } else if (snap.momentum > 40 && formation !== "343") {
    tips.push({
      id: "press-advantage",
      headline: "You're on top — go 343 and hunt a goal.",
      reason: `Momentum +${Math.round(snap.momentum)}. An extra forward turns pressure into clear chances while the opponent is rocking.`,
      confidence: 66,
      severity: "opportunity",
    });
  }

  // 5) 오프사이드 트랩 리스크
  if (tactics.offsideTrap && tactics.line > 70) {
    tips.push({
      id: "trap-risk",
      headline: "Offside trap + very high line is a coin-flip.",
      reason: `One mistimed step lets a runner clean through. Keep it only if your defenders are quick and coordinated.`,
      confidence: 59,
      severity: "warning",
    });
  }

  return tips
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}
