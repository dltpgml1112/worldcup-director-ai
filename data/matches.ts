import type { MatchData, Player, Team } from "@/lib/types";
import { FORMATIONS, type Slot } from "@/lib/formations";

/**
 * 실제 월드컵 결승 데이터 (실측 이벤트 타임라인 기반).
 * 구조는 StatsBomb Open Data(이벤트/xG/라인업)를 그대로 대체할 수 있게 설계됨.
 * 실서비스에서는 data/statsbomb 로더로 교체.
 */

const T = {
  KOR: { id: "KOR", name: "South Korea", nameKo: "대한민국", code: "KOR", flag: "🇰🇷", primary: "#c8102e", secondary: "#0a3161" },
  RSA: { id: "RSA", name: "South Africa", nameKo: "남아프리카공화국", code: "RSA", flag: "🇿🇦", primary: "#007749", secondary: "#ffb612" },
  ARG: { id: "ARG", name: "Argentina", nameKo: "아르헨티나", code: "ARG", flag: "🇦🇷", primary: "#75AADB", secondary: "#ffffff" },
  FRA: { id: "FRA", name: "France", nameKo: "프랑스", code: "FRA", flag: "🇫🇷", primary: "#1e3a8a", secondary: "#ef4444" },
  CRO: { id: "CRO", name: "Croatia", nameKo: "크로아티아", code: "CRO", flag: "🇭🇷", primary: "#e11d48", secondary: "#1d4ed8" },
} satisfies Record<string, Team>;

interface Seed { name: string; nameKo?: string; num: number; rating: number }

function buildXI(seeds: Seed[], formation: keyof typeof FORMATIONS): Player[] {
  const slots: Slot[] = FORMATIONS[formation];
  return seeds.map((s, i) => ({
    id: `${formation}-${i}-${s.num}`,
    name: s.name,
    nameKo: s.nameKo,
    num: s.num,
    role: slots[i]?.role ?? "SUB",
    x: slots[i]?.x ?? 50,
    y: slots[i]?.y ?? 50,
    rating: s.rating,
    stamina: 100,
    onAt: 0,
  }));
}

interface BenchSeed extends Seed { role: string; legend?: boolean }

function buildBench(prefix: string, seeds: BenchSeed[]): Player[] {
  return seeds.map((s, i) => ({
    id: `bench-${prefix}-${i}-${s.num}`,
    name: s.name,
    nameKo: s.nameKo,
    num: s.num,
    role: s.role,
    x: 50,
    y: 50,
    rating: s.rating,
    stamina: 100,
    onAt: 0,
    legend: s.legend,
  }));
}

const KOR_2026 = buildXI(
  [
    { name: "Jo Hyeon-woo", nameKo: "조현우", num: 21, rating: 80 },
    { name: "Kim Jin-su", nameKo: "김진수", num: 3, rating: 77 },
    { name: "Kim Min-jae", nameKo: "김민재", num: 4, rating: 87 },
    { name: "Kim Young-gwon", nameKo: "김영권", num: 19, rating: 78 },
    { name: "Seol Young-woo", nameKo: "설영우", num: 15, rating: 78 },
    { name: "Hwang In-beom", nameKo: "황인범", num: 6, rating: 81 },
    { name: "Lee Jae-sung", nameKo: "이재성", num: 17, rating: 80 },
    { name: "Lee Kang-in", nameKo: "이강인", num: 18, rating: 84 },
    { name: "Son Heung-min", nameKo: "손흥민", num: 7, rating: 89 },
    { name: "Cho Gue-sung", nameKo: "조규성", num: 9, rating: 78 },
    { name: "Hwang Hee-chan", nameKo: "황희찬", num: 11, rating: 82 },
  ],
  "433"
);

const KOR_2026_BENCH = buildBench("kor26", [
  { name: "Oh Hyeon-gyu", nameKo: "오현규", num: 22, role: "ST", rating: 78 },
  { name: "Bae Jun-ho", nameKo: "배준호", num: 10, role: "AM", rating: 78 },
  { name: "Won Du-jae", nameKo: "원두재", num: 8, role: "DM", rating: 76 },
  { name: "Kim Moon-hwan", nameKo: "김문환", num: 2, role: "RB", rating: 75 },
  { name: "Kim Ju-sung", nameKo: "김주성", num: 20, role: "CB", rating: 76 },
  { name: "Jung Woo-yeong", nameKo: "정우영", num: 16, role: "CM", rating: 77 },
  { name: "Song Bum-keun", nameKo: "송범근", num: 1, role: "GK", rating: 77 },
  // 현역 · 선출 경쟁권 (레전드 아님 — 기본 벤치에 항상 노출)
  { name: "Lee Seung-woo", nameKo: "이승우", num: 25, role: "AM", rating: 82 },

  // ⭐ 이하 legend: true — 역대 대표팀 스타. 실제 2026 스쿼드가 아닌 가상 편성이므로
  // '레전드 모드'가 켜졌을 때만 벤치에 노출된다 (기본 OFF = 현역 선수만).
  { name: "Cha Bum-kun", nameKo: "차범근", num: 12, role: "ST", rating: 90, legend: true },
  { name: "Park Ji-sung", nameKo: "박지성", num: 13, role: "CM", rating: 88, legend: true },
  { name: "Ahn Jung-hwan", nameKo: "안정환", num: 24, role: "ST", rating: 85, legend: true },
  { name: "Lee Chung-yong", nameKo: "이청용", num: 14, role: "RW", rating: 83, legend: true },
]);

const RSA_2026 = buildXI(
  [
    { name: "Ronwen Williams", num: 1, rating: 79 },
    { name: "Khuliso Mudau", num: 22, rating: 74 },
    { name: "Nkosinathi Sibisi", num: 5, rating: 73 },
    { name: "Grant Kekana", num: 4, rating: 73 },
    { name: "Aubrey Modiba", num: 3, rating: 75 },
    { name: "Teboho Mokoena", num: 8, rating: 77 },
    { name: "Sphephelo Sithole", num: 15, rating: 73 },
    { name: "Themba Zwane", num: 10, rating: 78 },
    { name: "Percy Tau", num: 21, rating: 79 },
    { name: "Lyle Foster", num: 9, rating: 77 },
    { name: "Evidence Makgopa", num: 11, rating: 73 },
  ],
  "433"
);

const ARG_2022_BENCH = buildBench("arg22", [
  { name: "L. Martínez", num: 22, role: "ST", rating: 84 },
  { name: "Dybala", num: 21, role: "AM", rating: 83 },
  { name: "Paredes", num: 5, role: "CM", rating: 81 },
  { name: "Montiel", num: 4, role: "RB", rating: 78 },
  { name: "Pezzella", num: 6, role: "CB", rating: 79 },
  { name: "Acuña", num: 8, role: "LB", rating: 80 },
  { name: "Palacios", num: 14, role: "CM", rating: 78 },
]);

const FRA_2018_BENCH = buildBench("fra18", [
  { name: "Fekir", num: 12, role: "AM", rating: 81 },
  { name: "N'Zonzi", num: 15, role: "CM", rating: 80 },
  { name: "Dembélé", num: 11, role: "RW", rating: 82 },
  { name: "Lemar", num: 8, role: "LM", rating: 80 },
  { name: "Sidibé", num: 19, role: "RB", rating: 78 },
  { name: "Thauvin", num: 26, role: "RW", rating: 80 },
  { name: "Mendy", num: 22, role: "LB", rating: 79 },
]);

const ARG_2022 = buildXI(
  [
    { name: "E. Martínez", num: 23, rating: 87 },
    { name: "Molina", num: 26, rating: 80 },
    { name: "Romero", num: 13, rating: 85 },
    { name: "Otamendi", num: 19, rating: 82 },
    { name: "Tagliafico", num: 3, rating: 79 },
    { name: "De Paul", num: 7, rating: 84 },
    { name: "E. Fernández", num: 24, rating: 85 },
    { name: "Mac Allister", num: 20, rating: 84 },
    { name: "Di María", num: 11, rating: 86 },
    { name: "Messi", num: 10, rating: 93 },
    { name: "J. Álvarez", num: 9, rating: 84 },
  ],
  "433"
);

const FRA_2022 = buildXI(
  [
    { name: "Lloris", num: 1, rating: 84 },
    { name: "Koundé", num: 5, rating: 82 },
    { name: "Varane", num: 4, rating: 84 },
    { name: "Konaté", num: 18, rating: 82 },
    { name: "T. Hernández", num: 22, rating: 84 },
    { name: "Tchouaméni", num: 8, rating: 83 },
    { name: "Rabiot", num: 14, rating: 82 },
    { name: "Dembélé", num: 11, rating: 84 },
    { name: "Griezmann", num: 7, rating: 87 },
    { name: "Mbappé", num: 10, rating: 92 },
    { name: "Giroud", num: 9, rating: 82 },
  ],
  "4231"
);

const FRA_2018 = buildXI(
  [
    { name: "Lloris", num: 1, rating: 85 },
    { name: "Pavard", num: 2, rating: 81 },
    { name: "Varane", num: 4, rating: 85 },
    { name: "Umtiti", num: 5, rating: 82 },
    { name: "L. Hernández", num: 21, rating: 82 },
    { name: "Kanté", num: 13, rating: 88 },
    { name: "Pogba", num: 6, rating: 87 },
    { name: "Matuidi", num: 14, rating: 81 },
    { name: "Mbappé", num: 10, rating: 89 },
    { name: "Griezmann", num: 7, rating: 88 },
    { name: "Giroud", num: 9, rating: 82 },
  ],
  "433"
);

const CRO_2018 = buildXI(
  [
    { name: "Subašić", num: 23, rating: 82 },
    { name: "Vrsaljko", num: 2, rating: 80 },
    { name: "Lovren", num: 6, rating: 81 },
    { name: "Vida", num: 21, rating: 79 },
    { name: "Strinić", num: 3, rating: 77 },
    { name: "Brozović", num: 11, rating: 83 },
    { name: "Rakitić", num: 7, rating: 85 },
    { name: "Modrić", num: 10, rating: 90 },
    { name: "Rebić", num: 18, rating: 80 },
    { name: "Mandžukić", num: 17, rating: 83 },
    { name: "Perišić", num: 4, rating: 84 },
  ],
  "4231"
);

export const MATCHES: MatchData[] = [
  {
    id: "kor-rsa-2026",
    year: 2026,
    stage: "Group Stage",
    venue: "2026 FIFA World Cup",
    home: T.KOR,
    away: T.RSA,
    homeXI: KOR_2026,
    awayXI: RSA_2026,
    homeBench: KOR_2026_BENCH,
    finalScore: [1, 2],
    weakFlank: "right",
    dataSource: "scenario",
    realNarrative:
      "In this scenario, Korea dominated the ball but couldn't break down a well-organised South Africa. A first-half counter and a second-half set-piece punished defensive lapses; Son Heung-min's equaliser wasn't enough. The 1–2 result ended Korea's group-stage campaign before the Round of 32.",
    realNarrativeKo:
      "이 시나리오에서 대한민국은 점유율을 지배하고도 조직적인 남아공의 수비를 끝내 뚫지 못했다. 전반 역습과 후반 세트피스에서 실점했고, 손흥민의 동점골도 승부를 뒤집지 못했다. 조별리그 최종전에서의 1-2 패배로 32강 진출이 좌절됐다. — 이제 당신이 감독이다. 다시 써라.",
    timeline: [
      { minute: 6, side: "home", type: "chance", player: "Son", detail: "Son Heung-min drives at the RSA back line early", detailKo: "손흥민이 초반부터 남아공 수비를 흔든다" },
      { minute: 14, side: "home", type: "shot", player: "Lee Kang-in", detail: "Lee Kang-in curls one just wide", detailKo: "이강인의 감아차기, 골문을 살짝 벗어난다", xg: 0.06 },
      { minute: 23, side: "away", type: "goal", player: "Foster", detail: "Against the run of play — Foster finishes a counter, 0–1", detailKo: "흐름과 반대로 — 포스터가 역습을 마무리, 0-1", xg: 0.18 },
      { minute: 31, side: "home", type: "chance", player: "Cho Gue-sung", detail: "Cho Gue-sung heads over from the corner", detailKo: "조규성의 헤더, 코너킥 상황에서 크로스바를 넘긴다" },
      { minute: 39, side: "home", type: "shot", player: "Hwang Hee-chan", detail: "Hwang Hee-chan stings the keeper's palms", detailKo: "황희찬의 슈팅, 골키퍼가 쳐낸다", xg: 0.09 },
      { minute: 45, side: "home", type: "whistle", detail: "Half time — Korea 0–1 down despite controlling the ball", detailKo: "전반 종료 — 점유율 우위에도 0-1로 끌려간다" },
      { minute: 52, side: "home", type: "goal", player: "Son", detail: "Son Heung-min lashes in the equaliser — 1–1!", detailKo: "손흥민이 동점골을 터뜨린다 — 1-1!", xg: 0.24 },
      { minute: 58, side: "home", type: "chance", player: "Lee Kang-in", detail: "Lee Kang-in threads Cho in, blocked", detailKo: "이강인이 조규성에게 스루패스, 막힌다" },
      { minute: 67, side: "away", type: "goal", player: "Tau", detail: "Set-piece scramble, Tau pounces — 1–2", detailKo: "세트피스 혼전, 타우가 밀어넣는다 — 1-2", xg: 0.16 },
      { minute: 74, side: "home", type: "shot", player: "Cho Gue-sung", detail: "Cho Gue-sung forces a fine save", detailKo: "조규성의 슈팅, 선방에 막힌다", xg: 0.1 },
      { minute: 80, side: "home", type: "chance", player: "Oh Hyeon-gyu", detail: "Fresh legs — Oh Hyeon-gyu can't quite connect", detailKo: "교체 투입 오현규, 마무리가 아쉽다" },
      { minute: 88, side: "home", type: "shot", player: "Son", detail: "Son's late free-kick tipped over", detailKo: "손흥민의 후반 프리킥, 골키퍼가 넘긴다", xg: 0.12 },
      { minute: 90, side: "home", type: "whistle", detail: "Full time — Korea 1–2 South Africa, eliminated", detailKo: "경기 종료 — 대한민국 1-2 남아공, 조별리그 탈락" },
    ],
  },
  {
    id: "final-2022",
    year: 2022,
    stage: "Final",
    venue: "Lusail Stadium, Qatar",
    home: T.ARG,
    away: T.FRA,
    homeXI: ARG_2022,
    awayXI: FRA_2022,
    homeBench: ARG_2022_BENCH,
    finalScore: [3, 3],
    penalties: [4, 2],
    weakFlank: "left",
    dataSource: "real",
    realNarrativeKo:
      "아르헨티나는 메시의 페널티킥과 디마리아의 역습골로 2-0으로 앞섰지만, 음바페가 97초 만에 두 골을 몰아쳤다. 연장에서 메시가 다시 앞서갔고 음바페가 페널티로 해트트릭을 완성. 승부차기 끝에 아르헨티나가 우승했다.",
    realNarrative:
      "Argentina raced to a 2–0 lead through a Messi penalty and a flowing Di María counter, only for Mbappé to strike twice in 97 seconds. Messi restored the lead in extra time; Mbappé completed his hat-trick from the spot. Argentina won on penalties.",
    timeline: [
      { minute: 2, side: "home", type: "chance", detail: "Argentina settle early, patient build-up" },
      { minute: 17, side: "home", type: "shot", player: "Di María", detail: "Di María drives at Koundé", xg: 0.05 },
      { minute: 21, side: "home", type: "chance", player: "Álvarez", detail: "Di María wins a penalty, drawing the foul" },
      { minute: 23, side: "home", type: "goal", player: "Messi", detail: "Messi rolls in the penalty — 1–0", xg: 0.78 },
      { minute: 30, side: "home", type: "chance", player: "Mac Allister", detail: "Argentina swarm forward" },
      { minute: 36, side: "home", type: "goal", player: "Di María", detail: "Five-pass counter finished by Di María — 2–0", xg: 0.31 },
      { minute: 41, side: "away", type: "shot", player: "Griezmann", detail: "France's first sight of goal", xg: 0.04 },
      { minute: 48, side: "away", type: "corner", detail: "France press for a way back in" },
      { minute: 55, side: "home", type: "chance", player: "Messi", detail: "Messi threads a pass, Álvarez blocked" },
      { minute: 64, side: "away", type: "sub", detail: "Deschamps rolls the dice: Kolo Muani & Thuram on" },
      { minute: 71, side: "away", type: "shot", player: "Kolo Muani", detail: "Fresh legs test Martínez", xg: 0.09 },
      { minute: 79, side: "away", type: "chance", player: "Kolo Muani", detail: "Otamendi trips Kolo Muani — penalty!" },
      { minute: 80, side: "away", type: "goal", player: "Mbappé", detail: "Mbappé thunders in the penalty — 2–1", xg: 0.78 },
      { minute: 81, side: "away", type: "goal", player: "Mbappé", detail: "97 seconds later — Mbappé volley, 2–2!", xg: 0.14 },
      { minute: 86, side: "away", type: "shot", player: "Mbappé", detail: "France with the momentum now", xg: 0.08 },
      { minute: 90, side: "home", type: "whistle", detail: "Full time 2–2 — to extra time" },
      { minute: 108, side: "home", type: "goal", player: "Messi", detail: "Messi bundles in the rebound — 3–2", xg: 0.35 },
      { minute: 116, side: "away", type: "chance", player: "Mbappé", detail: "Handball in the box — penalty France" },
      { minute: 118, side: "away", type: "goal", player: "Mbappé", detail: "Hat-trick! Mbappé makes it 3–3", xg: 0.78 },
      { minute: 120, side: "home", type: "whistle", detail: "Full time 3–3 — penalty shootout" },
    ],
  },
  {
    id: "final-2018",
    year: 2018,
    stage: "Final",
    venue: "Luzhniki Stadium, Moscow",
    home: T.FRA,
    away: T.CRO,
    homeXI: FRA_2018,
    awayXI: CRO_2018,
    homeBench: FRA_2018_BENCH,
    finalScore: [4, 2],
    weakFlank: "right",
    dataSource: "real",
    realNarrativeKo:
      "크로아티아가 점유율을 지배했지만 프랑스는 효율적이었다. 자책골과 VAR 페널티로 전반에 앞서갔고, 후반 포그바와 음바페의 득점으로 승부를 갈랐다. 만주키치의 만회골에도 4-2로 프랑스가 우승했다.",
    realNarrative:
      "Croatia dominated possession but France were ruthless. An own goal and a VAR penalty put France ahead by the break; second-half strikes from Pogba and Mbappé settled it despite a Mandžukić gift late on.",
    timeline: [
      { minute: 5, side: "away", type: "chance", player: "Modrić", detail: "Croatia dominate the ball early" },
      { minute: 18, side: "home", type: "goal", player: "Mandžukić (OG)", detail: "Griezmann free-kick, Mandžukić heads into his own net — 1–0", xg: 0.12 },
      { minute: 28, side: "away", type: "goal", player: "Perišić", detail: "Perišić lashes in the equaliser — 1–1", xg: 0.10 },
      { minute: 34, side: "home", type: "chance", detail: "VAR check — Perišić handball in the box" },
      { minute: 38, side: "home", type: "goal", player: "Griezmann", detail: "Griezmann converts the penalty — 2–1", xg: 0.78 },
      { minute: 48, side: "away", type: "shot", player: "Rakitić", detail: "Croatia push for parity", xg: 0.05 },
      { minute: 59, side: "home", type: "goal", player: "Pogba", detail: "Pogba fires in off a rebound — 3–1", xg: 0.15 },
      { minute: 65, side: "home", type: "goal", player: "Mbappé", detail: "Mbappé rifles a low shot — 4–1", xg: 0.20 },
      { minute: 69, side: "away", type: "goal", player: "Mandžukić", detail: "Lloris error, Mandžukić pounces — 4–2", xg: 0.30 },
      { minute: 82, side: "away", type: "shot", player: "Kramarić", detail: "Croatia keep probing", xg: 0.06 },
      { minute: 90, side: "home", type: "whistle", detail: "Full time 4–2 — France are World Champions" },
    ],
  },
];

export function getMatch(id: string): MatchData | undefined {
  return MATCHES.find((m) => m.id === id);
}

export function findMatch(countryId: string, opponentId: string, year: number): MatchData | undefined {
  return (
    MATCHES.find(
      (m) =>
        m.year === year &&
        ((m.home.id === countryId && m.away.id === opponentId) ||
          (m.away.id === countryId && m.home.id === opponentId))
    ) ?? MATCHES.find((m) => m.home.id === countryId || m.away.id === countryId)
  );
}

export const COUNTRIES: Team[] = [T.KOR, T.RSA, T.ARG, T.FRA, T.CRO];
export const YEARS: number[] = [2026, 2022, 2018];
