import type { MatchData, Tactics } from "./types";
import type { Lang } from "./i18n";

/**
 * 장면별 데이터 근거 · 한계.
 * "이 화면의 무엇이 어떤 데이터로 계산되었고, 어떤 데이터는 빠졌는가"를
 * 자막처럼 보여주기 위한 매핑. 심사자가 기능과 데이터 근거를 동시에 이해하게 한다.
 */

export type Scene = "setup" | "tactics" | "attack" | "goal" | "break" | "inplay";

export interface Provenance {
  scene: Scene;
  sceneLabel: string;
  used: string[]; // 이 장면에서 실제로 사용한 데이터
  excluded: string[]; // 빠졌거나 추정으로 대체한 데이터(해석 한계)
  source: "real" | "scenario";
}

const L = {
  ko: {
    setup: "상황 · 라인업",
    tactics: "전술 설정",
    attack: "공격 전개",
    goal: "득점 장면",
    break: "경기 분기(휘슬)",
    inplay: "경기 진행",
  },
  en: {
    setup: "Situation · Lineup",
    tactics: "Tactics",
    attack: "Attacking phase",
    goal: "Goal",
    break: "Whistle",
    inplay: "In play",
  },
} satisfies Record<Lang, Record<Scene, string>>;

export function sceneProvenance(match: MatchData, minute: number, _tactics: Tactics, lang: Lang): Provenance {
  const ko = lang === "ko";
  const source = match.dataSource ?? "real";
  const last = [...match.timeline].reverse().find((e) => e.minute <= minute);

  let scene: Scene = "inplay";
  if (minute <= 0) scene = "setup";
  else if (last?.type === "goal") scene = "goal";
  else if (last && ["shot", "chance", "corner"].includes(last.type)) scene = "attack";
  else if (last?.type === "whistle") scene = "break";

  // 공통 한계 (본 도구가 반영하지 않는 데이터)
  const commonExcl = ko
    ? ["실시간 위치 트래킹", "패스 네트워크·히트맵", "부상·컨디션"]
    : ["Live positional tracking", "Pass network·heatmap", "Injury·condition"];

  const srcUsed = ko
    ? source === "scenario"
      ? "시나리오 이벤트(가상)"
      : "실측 이벤트 타임라인"
    : source === "scenario"
    ? "Scenario events (illustrative)"
    : "Real event timeline";

  let used: string[];
  let excluded: string[];

  switch (scene) {
    case "setup":
      used = ko
        ? [srcUsed, "라인업·포메이션 좌표", "선수 기량(OVR)"]
        : [srcUsed, "Lineup·formation coords", "Player rating (OVR)"];
      excluded = ko
        ? [source === "scenario" ? "실제 경기 결과 아님(시나리오)" : "라인업 세부 변동", "실제 선수 히트맵"]
        : [source === "scenario" ? "Not a real result (scenario)" : "Lineup micro-changes", "Actual player heatmaps"];
      break;
    case "attack":
      used = ko ? [srcUsed, "슈팅·기회 이벤트", "xG(추정)"] : [srcUsed, "Shot·chance events", "xG (estimated)"];
      excluded = ko ? ["슛 위치 좌표", "xG 모델 세부 요인", commonExcl[0]] : ["Shot location coords", "xG model internals", commonExcl[0]];
      break;
    case "goal":
      used = ko ? [srcUsed, "골 이벤트", "xG(해당 슛)"] : [srcUsed, "Goal event", "xG (this shot)"];
      excluded = ko ? ["슛 좌표·어시스트 체인", "수비 배치 상세", commonExcl[0]] : ["Shot coords·assist chain", "Defensive setup detail", commonExcl[0]];
      break;
    case "break":
      used = ko ? [srcUsed, "누적 스코어·지표"] : [srcUsed, "Cumulative score·stats"];
      excluded = ko ? ["추가시간 세부", ...commonExcl.slice(0, 2)] : ["Stoppage-time detail", ...commonExcl.slice(0, 2)];
      break;
    default:
      used = ko ? [srcUsed, "누적 점유율·기세(추정)", "전술 계수"] : [srcUsed, "Possession·momentum (est.)", "Tactic coefficients"];
      excluded = commonExcl;
  }

  return { scene, sceneLabel: L[lang][scene], used, excluded, source };
}
