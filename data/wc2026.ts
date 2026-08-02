import type { CampaignRound } from "@/lib/campaign";
import type { Player, Tactics, Team } from "@/lib/types";
import { DEFAULT_TACTICS } from "@/lib/matchEngine";
import { RSA_2026 } from "@/data/matches";
import { REAL_OPENER_ID } from "@/lib/campaign";

/**
 * 2026 월드컵 — 한국이 남아공을 이겼다면 걸었을 길.
 *
 * 실제로 한국은 A조 3차전에서 남아공에 0-1로 져 조 3위(승점 3)로 탈락했다.
 * 그 경기를 이겼다면 승점 6으로 **A조 2위**가 되고, 남아공이 차지했던 브래킷 자리를
 * 그대로 승계한다. 아래 상대는 전부 **실제로 그 자리에 있었던 팀**이고, 선발 명단도
 * 그 팀이 해당 라운드에서 실제로 내보낸 11명이다.
 *
 *   32강  캐나다   (실제: 캐나다 1-0 남아공, 에우스타키오 후반 추가시간)
 *   16강  모로코   (실제: 모로코 3-0 캐나다, 오나히 2골)
 *    8강  프랑스   (실제: 프랑스 3-1 모로코)
 *    4강  스페인   (실제: 스페인 2-0 프랑스)
 *   결승  아르헨티나 (실제: 스페인 1-0 아르헨티나 연장, 페란 토레스)
 *
 * ⚠️ 이 경기들은 **실제로 열리지 않았다.** 상대·라운드·선발은 실측이지만 경기 내용은
 * 시뮬레이션이다 (`dataSource: "simulated"`). 화면에도 그렇게 표기된다.
 *
 * ⚠️ 상대팀 등번호는 확인된 것만 실측이고, 확인되지 않은 선수는 해당 선수가 대표팀에서
 * 통상 쓰는 번호를 넣었다. rating은 게임 내 기량 수치로 실측 데이터가 아니다.
 */

const T = {
  RSA: { id: "RSA", name: "South Africa", nameKo: "남아프리카공화국", code: "RSA", flag: "🇿🇦", primary: "#007749", secondary: "#ffb612" },
  CAN: { id: "CAN", name: "Canada", nameKo: "캐나다", code: "CAN", flag: "🇨🇦", primary: "#c8102e", secondary: "#ffffff" },
  MAR: { id: "MAR", name: "Morocco", nameKo: "모로코", code: "MAR", flag: "🇲🇦", primary: "#c1272d", secondary: "#006233" },
  FRA: { id: "FRA", name: "France", nameKo: "프랑스", code: "FRA", flag: "🇫🇷", primary: "#1e3a8a", secondary: "#ef4444" },
  ESP: { id: "ESP", name: "Spain", nameKo: "스페인", code: "ESP", flag: "🇪🇸", primary: "#c60b1e", secondary: "#ffc400" },
  ARG: { id: "ARG", name: "Argentina", nameKo: "아르헨티나", code: "ARG", flag: "🇦🇷", primary: "#75AADB", secondary: "#ffffff" },
} satisfies Record<string, Team>;

interface Seed { name: string; nameKo: string; num: number; role: string; rating: number; x: number; y: number; captain?: boolean }

function xi(prefix: string, seeds: Seed[]): Player[] {
  return seeds.map((s, i) => ({
    id: `${prefix}-${i}-${s.num}`,
    name: s.name,
    nameKo: s.nameKo,
    num: s.num,
    role: s.role,
    x: s.x,
    y: s.y,
    rating: s.rating,
    stamina: 100,
    onAt: 0,
    captain: s.captain,
  }));
}

/* 좌표계: 자기 골문 y=0 → 상대 골문 y=100 (원정은 렌더 단계에서 뒤집힌다) */

/** 4-4-2 — 실제 32강 남아공전 선발. 알폰소 데이비스는 벤치였다. */
const CAN_XI = xi("can26", [
  { name: "Maxime Crépeau", nameKo: "막심 크레포", num: 16, role: "GK", rating: 76, x: 50, y: 7 },
  { name: "Richie Laryea", nameKo: "리치 라리아", num: 22, role: "LB", rating: 74, x: 16, y: 27 },
  { name: "Derek Cornelius", nameKo: "데릭 코닐리어스", num: 13, role: "CB", rating: 76, x: 38, y: 21 },
  { name: "Luc de Fougerolles", nameKo: "뤼크 드 푸주롤", num: 4, role: "CB", rating: 74, x: 62, y: 21 },
  { name: "Alistair Johnston", nameKo: "알리스테어 존스턴", num: 2, role: "RB", rating: 79, x: 84, y: 27 },
  { name: "Liam Millar", nameKo: "리엄 밀러", num: 19, role: "LM", rating: 75, x: 18, y: 52 },
  { name: "Nathan Saliba", nameKo: "네이선 살리바", num: 14, role: "CM", rating: 74, x: 40, y: 46 },
  { name: "Stephen Eustáquio", nameKo: "스테번 에우스타키오", num: 7, role: "CM", rating: 79, x: 60, y: 46, captain: true },
  { name: "Tajon Buchanan", nameKo: "타종 뷰캐넌", num: 11, role: "RM", rating: 77, x: 82, y: 52 },
  { name: "Jonathan David", nameKo: "조너선 데이비드", num: 20, role: "ST", rating: 84, x: 42, y: 82 },
  { name: "Cyle Larin", nameKo: "카일 라린", num: 17, role: "ST", rating: 78, x: 58, y: 82 },
]);

/** 4-2-3-1 — 실제 16강 캐나다전 선발 */
const MAR_XI = xi("mar26", [
  { name: "Yassine Bounou", nameKo: "야신 부누", num: 1, role: "GK", rating: 82, x: 50, y: 7 },
  { name: "Noussair Mazraoui", nameKo: "누사이르 마즈라위", num: 3, role: "LB", rating: 80, x: 16, y: 27 },
  { name: "Nayef Aguerd", nameKo: "나예프 아게르드", num: 5, role: "CB", rating: 79, x: 38, y: 21 },
  { name: "Chadi Riad", nameKo: "샤디 리아드", num: 24, role: "CB", rating: 76, x: 62, y: 21 },
  { name: "Achraf Hakimi", nameKo: "아슈라프 하키미", num: 2, role: "RB", rating: 86, x: 84, y: 27, captain: true },
  { name: "Neil El Aynaoui", nameKo: "닐 엘 아이나위", num: 15, role: "DM", rating: 78, x: 38, y: 42 },
  { name: "Ayyoub Bouaddi", nameKo: "아유브 부아디", num: 20, role: "DM", rating: 77, x: 62, y: 42 },
  { name: "Brahim Díaz", nameKo: "브라힘 디아스", num: 10, role: "RW", rating: 83, x: 80, y: 65 },
  { name: "Azzedine Ounahi", nameKo: "아제딘 오나히", num: 8, role: "AM", rating: 79, x: 50, y: 61 },
  { name: "Bilal El Khannouss", nameKo: "빌랄 엘 칸누스", num: 7, role: "LW", rating: 80, x: 20, y: 65 },
  { name: "Abdellah Saibari", nameKo: "압델라 사이바리", num: 9, role: "ST", rating: 80, x: 50, y: 84 },
]);

/** 4-2-3-1 — 실제 8강 모로코전 선발 */
const FRA_XI = xi("fra26", [
  { name: "Mike Maignan", nameKo: "마이크 메냥", num: 16, role: "GK", rating: 85, x: 50, y: 7 },
  { name: "Lucas Digne", nameKo: "뤼카 디뉴", num: 21, role: "LB", rating: 79, x: 16, y: 27 },
  { name: "William Saliba", nameKo: "윌리앙 살리바", num: 17, role: "CB", rating: 87, x: 38, y: 21 },
  { name: "Dayot Upamecano", nameKo: "다요 우파메카노", num: 4, role: "CB", rating: 84, x: 62, y: 21 },
  { name: "Jules Koundé", nameKo: "쥘 쿤데", num: 5, role: "RB", rating: 84, x: 84, y: 27 },
  { name: "Kouadio Koné", nameKo: "쿠아디오 코네", num: 13, role: "DM", rating: 81, x: 38, y: 42 },
  { name: "Adrien Rabiot", nameKo: "아드리앵 라비오", num: 14, role: "DM", rating: 83, x: 62, y: 42 },
  { name: "Ousmane Dembélé", nameKo: "우스만 뎀벨레", num: 11, role: "RW", rating: 88, x: 80, y: 65 },
  { name: "Michael Olise", nameKo: "미카엘 올리세", num: 7, role: "AM", rating: 85, x: 50, y: 61 },
  { name: "Désiré Doué", nameKo: "데지레 두에", num: 20, role: "LW", rating: 83, x: 20, y: 65 },
  { name: "Kylian Mbappé", nameKo: "킬리안 음바페", num: 10, role: "ST", rating: 92, x: 50, y: 84, captain: true },
]);

/** 4-2-3-1 — 실제 4강 프랑스전 선발 (이 대회 우승팀) */
const ESP_XI = xi("esp26", [
  { name: "Unai Simón", nameKo: "우나이 시몬", num: 23, role: "GK", rating: 82, x: 50, y: 7 },
  { name: "Marc Cucurella", nameKo: "마르크 쿠쿠레야", num: 24, role: "LB", rating: 82, x: 16, y: 27 },
  { name: "Aymeric Laporte", nameKo: "에메리크 라포르트", num: 14, role: "CB", rating: 82, x: 38, y: 21 },
  { name: "Pau Cubarsí", nameKo: "파우 쿠바르시", num: 5, role: "CB", rating: 84, x: 62, y: 21 },
  { name: "Pedro Porro", nameKo: "페드로 포로", num: 2, role: "RB", rating: 79, x: 84, y: 27 },
  { name: "Rodri", nameKo: "로드리", num: 16, role: "DM", rating: 90, x: 38, y: 42, captain: true },
  { name: "Fabián Ruiz", nameKo: "파비안 루이스", num: 8, role: "DM", rating: 84, x: 62, y: 42 },
  { name: "Lamine Yamal", nameKo: "라민 야말", num: 19, role: "RW", rating: 91, x: 80, y: 65 },
  { name: "Dani Olmo", nameKo: "다니 올모", num: 10, role: "AM", rating: 85, x: 50, y: 61 },
  { name: "Álex Baena", nameKo: "알렉스 바에나", num: 17, role: "LW", rating: 81, x: 20, y: 65 },
  { name: "Mikel Oyarzabal", nameKo: "미켈 오야르사발", num: 9, role: "ST", rating: 83, x: 50, y: 84 },
]);

/** 4-4-2 — 실제 결승 스페인전 선발 (메시 선발) */
const ARG_XI = xi("arg26", [
  { name: "Emiliano Martínez", nameKo: "에밀리아노 마르티네스", num: 23, role: "GK", rating: 86, x: 50, y: 7 },
  { name: "Nicolás Tagliafico", nameKo: "니콜라스 탈리아피코", num: 3, role: "LB", rating: 79, x: 16, y: 27 },
  { name: "Lisandro Martínez", nameKo: "리산드로 마르티네스", num: 25, role: "CB", rating: 83, x: 38, y: 21 },
  { name: "Cristian Romero", nameKo: "크리스티안 로메로", num: 13, role: "CB", rating: 86, x: 62, y: 21 },
  { name: "Gonzalo Montiel", nameKo: "곤살로 몬티엘", num: 4, role: "RB", rating: 77, x: 84, y: 27 },
  { name: "Nicolás González", nameKo: "니콜라스 곤살레스", num: 11, role: "LM", rating: 80, x: 18, y: 52 },
  { name: "Alexis Mac Allister", nameKo: "알렉시스 맥알리스터", num: 20, role: "CM", rating: 85, x: 40, y: 46 },
  { name: "Enzo Fernández", nameKo: "엔소 페르난데스", num: 24, role: "CM", rating: 86, x: 60, y: 46 },
  { name: "Rodrigo De Paul", nameKo: "로드리고 데 파울", num: 7, role: "RM", rating: 83, x: 82, y: 52 },
  { name: "Lionel Messi", nameKo: "리오넬 메시", num: 10, role: "ST", rating: 90, x: 42, y: 80, captain: true },
  { name: "Julián Álvarez", nameKo: "훌리안 알바레스", num: 9, role: "ST", rating: 86, x: 58, y: 82 },
]);

/** 상대 감독의 성향 — 강팀일수록 주도적으로 나온다 */
const tactics = (t: Partial<Tactics>): Tactics => ({ ...DEFAULT_TACTICS, ...t });

export const CAMPAIGN_ROUNDS: CampaignRound[] = [
  {
    /*
     * 출발점. 이 경기는 **실제로 열렸고 한국이 0-1로 졌다** — 그 실측 기록은
     * data/matches.ts의 kor-rsa-2026에 그대로 있고 홈 화면에서 다시 볼 수 있다.
     *
     * 캠페인에서는 같은 상대(실제 선발 그대로)를 두고 감독이 다시 치른다. 실측 결과를
     * 재생만 하면 이길 방법이 없어서 캠페인이 시작조차 되지 않기 때문이다.
     * "다시 쓰는 역사"는 여기서부터다.
     */
    id: "group3",
    order: 0,
    stage: "Group A · Matchday 3",
    stageKo: "A조 3차전",
    venue: "Estadio BBVA, Guadalupe",
    venueKo: "에스타디오 BBVA, 과달루페",
    kickoff: "2026-06-24",
    opponent: T.RSA,
    opponentXI: RSA_2026,
    opponentShape: "4-2-3-1",
    // 실제로 한 시간을 내려앉아 버티다 한 번의 역습으로 이겼다
    opponentTactics: tactics({ attack: 32, line: 26, press: 44, tempo: 40, counter: true }),
    weakFlank: "right",
    realContext:
      "Korea went into this match on 3 points, South Africa on 1 — a draw was enough to go through. They had 68% of the ball and 18 shots, but only three on target. South Africa sat deep for an hour, broke once, and Thapelo Maseko finished it in the 63rd minute. Korea went out in third place.",
    realContextKo:
      "한국은 승점 3, 남아공은 1이었다. 비기기만 해도 16강이었다. 점유율 68%에 슈팅 18개를 퍼부었지만 유효슈팅은 3개뿐. 남아공은 한 시간을 내려앉아 버티다 딱 한 번 나왔고, 63분 타펠로 마세코가 마무리했다. 한국은 조 3위로 탈락했다.",
    /** 이 라운드에는 대응하는 실측 경기가 있다 — 브리핑에서 "실제 경기 보기"로 연결된다 */
    realScoreline: { left: "RSA", right: "KOR", score: [1, 0] },
    realMatchId: REAL_OPENER_ID,
    // 조별리그 — 무승부도 통과
    needsWinner: false,
  },
  {
    id: "r32",
    order: 1,
    stage: "Round of 32",
    stageKo: "32강",
    venue: "Los Angeles Stadium, Inglewood",
    venueKo: "로스앤젤레스 스타디움, 잉글우드",
    kickoff: "2026-06-28",
    opponent: T.CAN,
    opponentXI: CAN_XI,
    opponentShape: "4-4-2",
    opponentTactics: tactics({ attack: 58, line: 55, press: 62, tempo: 60 }),
    weakFlank: "left",
    realContext:
      "Canada took this slot by beating South Africa 1–0 with a stoppage-time strike from Stephen Eustáquio, reaching the last 16 for the first time in their history. Alphonso Davies watched it from the bench.",
    realContextKo:
      "캐나다는 남아공을 1-0으로 꺾고 이 자리에 왔다. 후반 추가시간 스테번 에우스타키오의 중거리 결승골이었고, 캐나다는 사상 처음으로 16강에 올랐다. 알폰소 데이비스는 벤치에서 그 경기를 지켜봤다.",
    realScoreline: { left: "CAN", right: "RSA", score: [1, 0] },
  },
  {
    id: "r16",
    order: 2,
    stage: "Round of 16",
    stageKo: "16강",
    venue: "Houston Stadium",
    venueKo: "휴스턴 스타디움",
    kickoff: "2026-07-04",
    opponent: T.MAR,
    opponentXI: MAR_XI,
    opponentShape: "4-2-3-1",
    opponentTactics: tactics({ attack: 62, line: 58, press: 66, tempo: 64, counter: true }),
    weakFlank: "left",
    realContext:
      "Morocco ended Canada's tournament here, winning 3–0 with two second-half goals from Azzedine Ounahi. Canada were the first co-host to go out.",
    realContextKo:
      "모로코는 이 자리에서 캐나다의 대회를 끝냈다. 3-0 완승이었고 후반에만 아제딘 오나히가 두 골을 넣었다. 캐나다는 개최국 중 가장 먼저 탈락한 팀이 됐다.",
    realScoreline: { left: "MAR", right: "CAN", score: [3, 0] },
  },
  {
    id: "qf",
    order: 3,
    stage: "Quarter-final",
    stageKo: "8강",
    venue: "Boston Stadium, Foxborough",
    venueKo: "보스턴 스타디움, 폭스버러",
    kickoff: "2026-07-09",
    opponent: T.FRA,
    opponentXI: FRA_XI,
    opponentShape: "4-2-3-1",
    opponentTactics: tactics({ attack: 70, line: 64, press: 68, tempo: 72, counter: true }),
    weakFlank: "right",
    realContext:
      "France beat Morocco 3–1 here — a rematch of the 2022 semi-final. Mbappé led a front line that also carried Dembélé and Olise.",
    realContextKo:
      "프랑스가 이 자리에서 모로코를 3-1로 꺾었다. 2022 4강의 리턴 매치였다. 음바페가 이끄는 전방에 뎀벨레와 올리세까지 붙어 있었다.",
    realScoreline: { left: "FRA", right: "MAR", score: [3, 1] },
  },
  {
    id: "sf",
    order: 4,
    stage: "Semi-final",
    stageKo: "4강",
    venue: "AT&T Stadium, Arlington",
    venueKo: "AT&T 스타디움, 알링턴",
    kickoff: "2026-07-14",
    opponent: T.ESP,
    opponentXI: ESP_XI,
    opponentShape: "4-2-3-1",
    opponentTactics: tactics({ attack: 72, line: 70, press: 76, tempo: 78, highPress: true }),
    weakFlank: "right",
    realContext:
      "Spain beat France 2–0 here and went on to win the tournament. Rodri controlled midfield; Lamine Yamal started every knockout match. This is the team that lifted the trophy.",
    realContextKo:
      "스페인이 이 자리에서 프랑스를 2-0으로 꺾고 결승에 올라 우승했다. 로드리가 중원을 지배했고 라민 야말은 토너먼트 전 경기를 선발로 뛰었다. 이 대회의 우승팀이다.",
    realScoreline: { left: "ESP", right: "FRA", score: [2, 0] },
  },
  {
    id: "final",
    order: 5,
    stage: "Final",
    stageKo: "결승",
    venue: "MetLife Stadium, East Rutherford",
    venueKo: "메트라이프 스타디움, 이스트러더퍼드",
    kickoff: "2026-07-19",
    opponent: T.ARG,
    opponentXI: ARG_XI,
    opponentShape: "4-4-2",
    opponentTactics: tactics({ attack: 66, line: 60, press: 64, tempo: 66, counter: true }),
    weakFlank: "left",
    realContext:
      "The defending champions reached the final and lost it 0–1 to Spain in extra time, Ferran Torres scoring off the bench. Messi started. If you are here, you are playing the match Argentina lost.",
    realContextKo:
      "디펜딩 챔피언 아르헨티나가 결승에 올랐고, 연장에서 교체 투입된 페란 토레스에게 실점하며 0-1로 졌다. 메시가 선발로 나섰다. 당신이 여기까지 왔다면, 아르헨티나가 졌던 그 경기를 대신 치르는 것이다.",
    realScoreline: { left: "ESP", right: "ARG", score: [1, 0] },
  },
];
