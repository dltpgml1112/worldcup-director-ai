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

/**
 * 실측 선발용 — 그 경기에서 실제로 선 자리를 좌표로 직접 싣는다.
 *
 * buildXI()는 FORMATIONS 템플릿 11칸에 선수를 끼워넣기 때문에, 어느 팀이든 좌표가 똑같아진다.
 * "2018 크로아티아와 2022 프랑스가 같은 자리에 선다"는 뜻이라 실측 재현이 안 된다.
 * 실제로 열린 경기는 이 함수로 그 경기의 대형을 그대로 넣는다.
 *
 * 좌표계는 홈·원정 공통으로 '자기 골문 y=0, 상대 골문 y=100'. 원정은 렌더 단계에서
 * 뒤집힌다 (lib/pitchPositions.ts의 away 매핑).
 */
interface LineupSeed extends Seed { role: string; x: number; y: number; captain?: boolean }

function buildLineup(prefix: string, seeds: LineupSeed[]): Player[] {
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

/*
 * ── 2026 FIFA 월드컵 A조 3차전 · 남아프리카공화국 1-0 대한민국 (2026-06-24) ──
 *
 * 선발 22명·등번호는 실측이다 (FIFA 공식 라인업 / 2026 월드컵 최종 엔트리 26인).
 * 한국은 3백에 좌우 윙백을 올린 3-4-3, 남아공은 두 명의 홀딩을 둔 4-2-3-1로 나왔다.
 * rating은 게임 내 기량 수치(주관적 산정)이며 실측 데이터가 아니다.
 */
export const KOR_2026 = buildLineup("kor26", [
  { name: "Kim Seung-gyu", nameKo: "김승규", num: 1, role: "GK", rating: 78, x: 50, y: 7 },
  { name: "Lee Han-beom", nameKo: "이한범", num: 2, role: "CB", rating: 74, x: 30, y: 21 },
  { name: "Kim Min-jae", nameKo: "김민재", num: 4, role: "CB", rating: 86, x: 50, y: 19 },
  { name: "Lee Gi-hyuk", nameKo: "이기혁", num: 3, role: "CB", rating: 72, x: 70, y: 21 },
  { name: "Lee Tae-seok", nameKo: "이태석", num: 13, role: "LWB", rating: 74, x: 12, y: 48 },
  { name: "Hwang In-beom", nameKo: "황인범", num: 6, role: "CM", rating: 80, x: 38, y: 45 },
  { name: "Paik Seung-ho", nameKo: "백승호", num: 8, role: "CM", rating: 76, x: 58, y: 44 },
  { name: "Seol Young-woo", nameKo: "설영우", num: 22, role: "RWB", rating: 77, x: 88, y: 48 },
  { name: "Lee Jae-sung", nameKo: "이재성", num: 10, role: "LW", rating: 79, x: 28, y: 74 },
  { name: "Son Heung-min", nameKo: "손흥민", num: 7, role: "ST", rating: 88, x: 50, y: 82, captain: true },
  { name: "Lee Kang-in", nameKo: "이강인", num: 19, role: "RW", rating: 84, x: 74, y: 74 },
]);

/**
 * 벤치 = 2026 최종 엔트리 26인 중 이 경기 선발 11명을 뺀 15명 (전원 실존·실제 등번호).
 * 역대 스타(legend)는 실제 스쿼드가 아닌 가상 편성이라 '레전드 모드'에서만 노출된다.
 */
export const KOR_2026_BENCH = buildBench("kor26", [
  { name: "Oh Hyeon-gyu", nameKo: "오현규", num: 18, role: "ST", rating: 77 },
  { name: "Cho Gue-sung", nameKo: "조규성", num: 9, role: "ST", rating: 78 },
  { name: "Hwang Hee-chan", nameKo: "황희찬", num: 11, role: "LW", rating: 81 },
  { name: "Bae Jun-ho", nameKo: "배준호", num: 17, role: "AM", rating: 77 },
  { name: "Lee Dong-gyeong", nameKo: "이동경", num: 26, role: "AM", rating: 76 },
  { name: "Eom Ji-sung", nameKo: "엄지성", num: 25, role: "RW", rating: 75 },
  { name: "Yang Hyun-jun", nameKo: "양현준", num: 20, role: "LW", rating: 75 },
  { name: "Kim Jin-gyu", nameKo: "김진규", num: 24, role: "DM", rating: 76 },
  { name: "Jens Castrop", nameKo: "옌스 카스트로프", num: 23, role: "DM", rating: 76 },
  { name: "Kim Moon-hwan", nameKo: "김문환", num: 15, role: "RB", rating: 74 },
  { name: "Park Jin-seob", nameKo: "박진섭", num: 16, role: "CB", rating: 74 },
  { name: "Kim Tae-hyeon", nameKo: "김태현", num: 5, role: "LB", rating: 74 },
  { name: "Cho Wi-je", nameKo: "조위제", num: 14, role: "CB", rating: 72 },
  { name: "Jo Hyeon-woo", nameKo: "조현우", num: 21, role: "GK", rating: 77 },
  { name: "Song Bum-keun", nameKo: "송범근", num: 12, role: "GK", rating: 75 },

  // ⭐ 이하 legend: true — 역대 대표팀 스타. 실제 2026 스쿼드가 아닌 가상 편성이므로
  // '레전드 모드'가 켜졌을 때만 벤치에 노출된다 (기본 OFF = 현역 선수만).
  //
  // 번호는 27번부터 준다. 실제 엔트리가 1~26번을 다 쓰고 있어서, 예전처럼 12·13·14·24를
  // 붙이면 송범근·이태석·조위제·김진규와 겹쳐 같은 번호가 두 명 나온다.
  { name: "Cha Bum-kun", nameKo: "차범근", num: 27, role: "ST", rating: 90, legend: true },
  { name: "Park Ji-sung", nameKo: "박지성", num: 28, role: "CM", rating: 88, legend: true },
  { name: "Ahn Jung-hwan", nameKo: "안정환", num: 29, role: "ST", rating: 85, legend: true },
  { name: "Lee Chung-yong", nameKo: "이청용", num: 30, role: "RW", rating: 83, legend: true },
]);

/**
 * 남아공 벤치 — 2026 최종 엔트리 26인 중 이 경기 선발을 뺀 선수들 (실제 등번호).
 * 사용자가 남아공을 맡을 때 쓴다. 모레미·애덤스는 실제로 이 경기에 교체 투입됐다.
 */
export const RSA_2026_BENCH = buildBench("rsa26b", [
  { name: "Tshepang Moremi", nameKo: "체팡 모레미", num: 8, role: "RW", rating: 76 },
  { name: "Jayden Adams", nameKo: "제이든 애덤스", num: 23, role: "CM", rating: 75 },
  { name: "Lyle Foster", nameKo: "라일 포스터", num: 9, role: "ST", rating: 77 },
  { name: "Evidence Makgopa", nameKo: "에비던스 막고파", num: 17, role: "ST", rating: 73 },
  { name: "Teboho Mokoena", nameKo: "테보호 모코에나", num: 4, role: "CM", rating: 77 },
  { name: "Themba Zwane", nameKo: "템바 즈와네", num: 11, role: "AM", rating: 77 },
  { name: "Nkosinathi Sibisi", nameKo: "은코시나티 시비시", num: 19, role: "CB", rating: 74 },
  { name: "Khulumani Ndamane", nameKo: "쿨루마니 은다마네", num: 3, role: "CB", rating: 73 },
  { name: "Sipho Chaine", nameKo: "시포 차이네", num: 16, role: "GK", rating: 75 },
]);

export const RSA_2026 = buildLineup("rsa26", [
  { name: "Ronwen Williams", nameKo: "론웬 윌리엄스", num: 1, role: "GK", rating: 80, x: 50, y: 7, captain: true },
  { name: "Aubrey Modiba", nameKo: "오브리 모디바", num: 6, role: "LB", rating: 76, x: 16, y: 26 },
  { name: "Mbekezeli Mbokazi", nameKo: "음베케젤리 음보카지", num: 14, role: "CB", rating: 74, x: 38, y: 21 },
  { name: "Ime Okon", nameKo: "이메 오콘", num: 21, role: "CB", rating: 74, x: 62, y: 21 },
  { name: "Khuliso Mudau", nameKo: "쿨리소 무다우", num: 20, role: "RB", rating: 75, x: 84, y: 26 },
  { name: "Sphephelo Sithole", nameKo: "스페펠로 시톨레", num: 13, role: "DM", rating: 74, x: 38, y: 42 },
  { name: "Thalente Mbatha", nameKo: "탈렌테 음바타", num: 5, role: "DM", rating: 75, x: 62, y: 42 },
  { name: "Oswin Appollis", nameKo: "오스윈 아폴리스", num: 7, role: "LW", rating: 77, x: 20, y: 65 },
  { name: "Relebohile Mofokeng", nameKo: "렐레보힐레 모포켕", num: 10, role: "AM", rating: 79, x: 50, y: 61 },
  { name: "Thapelo Maseko", nameKo: "타펠로 마세코", num: 12, role: "RW", rating: 77, x: 80, y: 65 },
  { name: "Iqraam Rayners", nameKo: "이크람 라이너스", num: 15, role: "ST", rating: 77, x: 50, y: 84 },
]);

const ARG_2022_BENCH = buildBench("arg22", [
  { name: "L. Martínez", num: 22, role: "ST", rating: 84 },
  { name: "Dybala", num: 21, role: "AM", rating: 83 },
  { name: "Paredes", num: 5, role: "CM", rating: 81 },
  { name: "Montiel", num: 4, role: "RB", rating: 78 },
  { name: "Pezzella", num: 6, role: "CB", rating: 79 },
  { name: "Acuña", num: 8, role: "LB", rating: 80 },
  { name: "Palacios", num: 14, role: "CM", rating: 78 },
]);

/** 2022 결승 프랑스 벤치 — 사용자가 프랑스를 맡을 때 쓴다 (실제 교체 투입 선수 위주) */
const FRA_2022_BENCH = buildBench("fra22", [
  { name: "Kolo Muani", nameKo: "콜로 무아니", num: 12, role: "ST", rating: 83 },
  { name: "M. Thuram", nameKo: "마르퀴스 튀랑", num: 24, role: "ST", rating: 82 },
  { name: "Camavinga", nameKo: "카마빙가", num: 25, role: "CM", rating: 83 },
  { name: "Coman", nameKo: "코망", num: 20, role: "RW", rating: 83 },
  { name: "Fofana", nameKo: "포파나", num: 13, role: "DM", rating: 80 },
  { name: "Disasi", nameKo: "디사시", num: 3, role: "CB", rating: 79 },
  { name: "Areola", nameKo: "아레올라", num: 16, role: "GK", rating: 78 },
]);

/** 2018 결승 크로아티아 벤치 */
const CRO_2018_BENCH = buildBench("cro18", [
  { name: "Kramarić", nameKo: "크라마리치", num: 9, role: "ST", rating: 81 },
  { name: "Pjaca", nameKo: "피야차", num: 20, role: "LW", rating: 77 },
  { name: "Badelj", nameKo: "바델리", num: 19, role: "DM", rating: 79 },
  { name: "Kalinić", nameKo: "칼리니치", num: 16, role: "ST", rating: 78 },
  { name: "Ćorluka", nameKo: "출루카", num: 5, role: "CB", rating: 77 },
  { name: "Bradarić", nameKo: "브라다리치", num: 13, role: "LB", rating: 74 },
  { name: "Livaković", nameKo: "리바코비치", num: 1, role: "GK", rating: 79 },
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
    /*
     * 실측 경기. 스코어·득점자·득점 시각·경고·점유율·슈팅/코너 총계는 실제 기록이다
     * (한국 점유 68% / 슈팅 18-4 / 코너 6-4, 마세코 63분 결승골, 모디바 72분 경고).
     *
     * 다만 공개 자료에 **슛 하나하나의 시각과 슈터**까지는 없다. 그래서 개별 슛·코너
     * 이벤트의 분포는 위 실제 총계에 맞춰 재구성했고, 확인되지 않은 슈터는 이름을 붙이지
     * 않았다. 화면에도 이 구분을 표기한다 (lib/provenance.ts).
     */
    id: "kor-rsa-2026",
    year: 2026,
    stage: "Group A · Matchday 3",
    stageKo: "A조 3차전",
    venue: "Estadio BBVA, Guadalupe",
    venueKo: "에스타디오 BBVA, 과달루페",
    kickoff: "2026-06-24",
    home: T.KOR,
    away: T.RSA,
    homeXI: KOR_2026,
    awayXI: RSA_2026,
    homeBench: KOR_2026_BENCH,
    awayBench: RSA_2026_BENCH,
    homeShape: "3-4-3",
    awayShape: "4-2-3-1",
    // 사용자 팀(한국)을 home 슬롯에 두지만, 실제 홈은 남아공이었다
    actualHome: "away",
    finalScore: [0, 1],
    weakFlank: "right",
    dataSource: "real",
    timelineNoteKo:
      "스코어·득점자·득점 시각·경고·점유율·슈팅/코너 총계는 실측. 개별 슛의 시각과 슈터는 공개 자료에 없어 실제 총계(18-4, 6-4)에 맞춰 재구성했고, 확인되지 않은 슈터는 이름을 붙이지 않았다.",
    timelineNote:
      "Score, scorer, goal time, card, possession and shot/corner totals are real. Individual shot timings and shooters are not in the public record, so they are reconstructed to match the real totals (18-4, 6-4); unverified shooters are left unnamed.",
    realNarrative:
      "Korea needed a win to reach the last 16 and played like it — 68% of the ball, 18 shots, six corners. But only three of those shots hit the target. South Africa defended a low block for an hour, then broke once: Thapelo Maseko finished in the 63rd minute. It was their only goal from four shots. Korea went out in third place; South Africa reached the knockout rounds for the first time in their history.",
    realNarrativeKo:
      "이기면 16강이었다. 한국은 그렇게 뛰었다 — 점유율 68%, 슈팅 18개, 코너킥 6개. 그런데 유효슈팅은 3개뿐이었다. 남아공은 한 시간을 내려앉아 버티다 딱 한 번 나왔고, 63분 타펠로 마세코가 마무리했다. 그들의 슈팅 4개 중 유일한 골이었다. 한국은 조 3위로 탈락했고, 남아공은 사상 처음으로 조별리그를 통과했다. — 이제 당신이 감독이다. 다시 써라.",
    timeline: [
      { minute: 4, side: "home", type: "shot", detail: "Korea start on the front foot — first effort from range", detailKo: "한국이 초반부터 몰아친다 — 첫 중거리 슈팅", xg: 0.05 },
      { minute: 8, side: "away", type: "corner", detail: "South Africa's first corner", detailKo: "남아공의 첫 코너킥" },
      { minute: 9, side: "home", type: "shot", detail: "Blocked in a crowded box", detailKo: "밀집한 박스 안에서 차단된다", xg: 0.04 },
      { minute: 11, side: "home", type: "corner", detail: "Korea swing one in", detailKo: "한국의 코너킥" },
      { minute: 13, side: "home", type: "shot", player: "Lee Kang-in", detail: "Lee Kang-in curls one over", detailKo: "이강인의 감아차기, 골문을 넘긴다", xg: 0.09 },
      { minute: 17, side: "home", type: "shot", detail: "Deflected wide off a defender", detailKo: "수비 맞고 굴절되어 벗어난다", xg: 0.03 },
      { minute: 19, side: "away", type: "shot", detail: "South Africa's first sight of goal on the counter", detailKo: "남아공의 첫 역습 슈팅", xg: 0.06 },
      { minute: 22, side: "home", type: "shot", player: "Son Heung-min", detail: "Son forces Williams into a save", detailKo: "손흥민의 슈팅, 윌리엄스가 막아낸다", xg: 0.12 },
      { minute: 25, side: "home", type: "corner", detail: "Another Korean corner, cleared", detailKo: "한국의 코너킥, 걷어낸다" },
      { minute: 27, side: "home", type: "shot", detail: "Snapshot from the edge, wide", detailKo: "박스 외곽에서의 슈팅, 벗어난다", xg: 0.06 },
      { minute: 31, side: "away", type: "corner", detail: "South Africa win a corner against the run of play", detailKo: "흐름과 반대로 남아공이 코너킥을 얻는다" },
      { minute: 33, side: "home", type: "shot", detail: "Header from the corner, off target", detailKo: "코너킥 상황 헤더, 골문을 벗어난다", xg: 0.04 },
      { minute: 36, side: "home", type: "corner", detail: "Korea keep the pressure on", detailKo: "한국이 계속 몰아붙인다" },
      { minute: 38, side: "home", type: "shot", player: "Lee Jae-sung", detail: "Lee Jae-sung drags it just past the post", detailKo: "이재성의 슈팅, 골대를 살짝 빗나간다", xg: 0.11 },
      { minute: 42, side: "home", type: "shot", detail: "Blocked again — South Africa throwing bodies at it", detailKo: "또 막힌다 — 남아공이 몸을 던진다", xg: 0.05 },
      { minute: 44, side: "away", type: "shot", detail: "Rayners tests the keeper before the break", detailKo: "라이너스가 전반 종료 전 골키퍼를 시험한다", xg: 0.09 },
      { minute: 45, side: "home", type: "whistle", detail: "Half time — 0–0, Korea dominating without a breakthrough", detailKo: "전반 종료 — 0-0, 한국이 지배하고도 뚫지 못한다" },
      { minute: 49, side: "home", type: "shot", detail: "Straight at Williams", detailKo: "윌리엄스 정면으로 향한다", xg: 0.07 },
      { minute: 53, side: "home", type: "shot", player: "Son Heung-min", detail: "Son's best chance — Williams claws it away", detailKo: "손흥민의 결정적 기회 — 윌리엄스가 쳐낸다", xg: 0.14 },
      { minute: 55, side: "home", type: "corner", detail: "Korea's fifth corner", detailKo: "한국의 다섯 번째 코너킥" },
      { minute: 57, side: "home", type: "shot", detail: "Scrambled clear off the line", detailKo: "골라인 앞에서 혼전 끝에 걷어낸다", xg: 0.04 },
      { minute: 58, side: "away", type: "corner", detail: "South Africa relieve the pressure", detailKo: "남아공이 압박을 덜어낸다" },
      { minute: 61, side: "home", type: "shot", detail: "Another effort blocked", detailKo: "또 한 번의 슈팅이 차단된다", xg: 0.06 },
      { minute: 63, side: "away", type: "goal", player: "Thapelo Maseko", detail: "The one break — Maseko finishes it. South Africa lead 1–0", detailKo: "단 한 번의 역습 — 마세코가 마무리한다. 남아공 1-0 리드", xg: 0.22 },
      { minute: 68, side: "home", type: "shot", detail: "Korea pour forward in search of an equaliser", detailKo: "한국이 동점골을 향해 쏟아붓는다", xg: 0.09 },
      { minute: 70, side: "home", type: "corner", detail: "Everyone up for the corner", detailKo: "코너킥에 전원이 올라간다" },
      { minute: 72, side: "away", type: "card", card: "yellow", player: "Aubrey Modiba", detail: "Modiba booked", detailKo: "모디바, 경고를 받는다" },
      { minute: 73, side: "home", type: "shot", detail: "Deflected behind", detailKo: "굴절되어 라인 밖으로 나간다", xg: 0.05 },
      { minute: 76, side: "away", type: "corner", detail: "South Africa run the clock down", detailKo: "남아공이 시간을 흘려보낸다" },
      { minute: 77, side: "home", type: "shot", detail: "Wild from distance", detailKo: "먼 거리에서의 무리한 슈팅", xg: 0.08 },
      { minute: 79, side: "away", type: "shot", detail: "A late counter almost makes it two", detailKo: "후반 역습, 하마터면 두 번째 골", xg: 0.05 },
      { minute: 82, side: "home", type: "shot", player: "Son Heung-min", detail: "Son again — over the bar", detailKo: "다시 손흥민 — 크로스바를 넘긴다", xg: 0.10 },
      { minute: 85, side: "home", type: "corner", detail: "Korea's last corner", detailKo: "한국의 마지막 코너킥" },
      { minute: 88, side: "home", type: "shot", detail: "The final effort is smothered", detailKo: "마지막 슈팅마저 덮친다", xg: 0.06 },
      { minute: 90, side: "home", type: "whistle", detail: "Full time — South Africa 1–0 Korea. Korea are out.", detailKo: "경기 종료 — 남아공 1-0 대한민국. 한국은 탈락한다." },
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
    awayBench: FRA_2022_BENCH,
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
    awayBench: CRO_2018_BENCH,
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

/**
 * 런타임에 생성된 경기 (캠페인의 32강~결승).
 *
 * 이 경기들은 실제로 열린 적이 없어서 MATCHES에 넣을 수 없고, 전술·라인업에 따라
 * 내용이 달라지므로 정적 데이터도 될 수 없다. 대신 생성 시점에 여기 등록해두고
 * getMatch()가 같이 찾게 한다 — 화면 곳곳의 `getMatch(matchId)` 호출부를 그대로 둘 수 있다.
 */
const generated = new Map<string, MatchData>();

export function registerMatch(match: MatchData): void {
  generated.set(match.id, match);
}

export function getMatch(id: string): MatchData | undefined {
  return generated.get(id) ?? MATCHES.find((m) => m.id === id);
}

/**
 * 실제로 열린 대진만 찾는다. 없으면 undefined.
 *
 * 예전에는 못 찾으면 "그 나라가 낀 아무 경기"로 폴백했다. 그래서 한국 vs 아르헨티나
 * 2018을 골라도 화면에는 전혀 다른 경기가 떴다 — 사용자는 자기가 고른 경기를 보고 있다고
 * 믿는데 아니었다. 없는 대진은 없다고 말해야 한다.
 */
export function findMatch(countryId: string, opponentId: string, year: number): MatchData | undefined {
  return MATCHES.find(
    (m) =>
      m.year === year &&
      ((m.home.id === countryId && m.away.id === opponentId) ||
        (m.away.id === countryId && m.home.id === opponentId))
  );
}

/** 캠페인의 주인공 — 사용자 팀 */
export const KOREA: Team = T.KOR;

export const COUNTRIES: Team[] = [T.KOR, T.RSA, T.ARG, T.FRA, T.CRO];
export const YEARS: number[] = [2026, 2022, 2018];
