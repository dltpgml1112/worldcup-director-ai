import type { MatchData, Player, Team } from "@/lib/types";
import { FORMATIONS, type Slot } from "@/lib/formations";

/**
 * 실제 월드컵 결승 데이터 (실측 이벤트 타임라인 기반).
 * 구조는 StatsBomb Open Data(이벤트/xG/라인업)를 그대로 대체할 수 있게 설계됨.
 * 실서비스에서는 data/statsbomb 로더로 교체.
 */

const T = {
  ARG: { id: "ARG", name: "Argentina", code: "ARG", flag: "🇦🇷", primary: "#75AADB", secondary: "#ffffff" },
  FRA: { id: "FRA", name: "France", code: "FRA", flag: "🇫🇷", primary: "#1e3a8a", secondary: "#ef4444" },
  CRO: { id: "CRO", name: "Croatia", code: "CRO", flag: "🇭🇷", primary: "#e11d48", secondary: "#1d4ed8" },
} satisfies Record<string, Team>;

interface Seed { name: string; num: number; rating: number }

function buildXI(seeds: Seed[], formation: keyof typeof FORMATIONS): Player[] {
  const slots: Slot[] = FORMATIONS[formation];
  return seeds.map((s, i) => ({
    id: `${formation}-${i}-${s.num}`,
    name: s.name,
    num: s.num,
    role: slots[i]?.role ?? "SUB",
    x: slots[i]?.x ?? 50,
    y: slots[i]?.y ?? 50,
    rating: s.rating,
    stamina: 100,
  }));
}

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
    id: "final-2022",
    year: 2022,
    stage: "Final",
    venue: "Lusail Stadium, Qatar",
    home: T.ARG,
    away: T.FRA,
    homeXI: ARG_2022,
    awayXI: FRA_2022,
    finalScore: [3, 3],
    penalties: [4, 2],
    weakFlank: "left",
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
    finalScore: [4, 2],
    weakFlank: "right",
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

export const COUNTRIES: Team[] = [T.ARG, T.FRA, T.CRO];
export const YEARS: number[] = [2022, 2018];
