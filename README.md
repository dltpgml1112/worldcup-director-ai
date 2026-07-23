# ⚽ World Cup Director AI · 월드컵 디렉터 AI

> *당신이 감독이라면?* — **2026 월드컵**을 다시 쓰는 몰입형 전술 시뮬레이터.
> *What if YOU were the coach?* — an immersive World Cup tactical simulator.

2026 월드컵 데이터 기반 해커톤 출품작. 경기를 분 단위로 리플레이하고, 인터랙티브 전술 보드를
지휘하고, 실시간 AI 코칭을 받아 **역사를 다시 쓴다.** UI 전체가 **한국어/영어** (기본 한국어).

### 🇰🇷 한국 대표팀 & 2026 시나리오
기본 데모는 **대한민국 vs 남아프리카공화국 (2026 조별리그)**. 실제 대회에서 한국은 피파 랭킹이
낮은 상대에게 1–2로 패해 32강 진출이 좌절됐다 — 이제 **당신이 감독이 되어 그 경기를 다시 쓴다.**
전술을 조정하면 대체역사(Alternate History) 스코어라인이 실시간으로 바뀐다.

> ⚠️ **데이터 고지**: 2026 경기 데이터는 **시나리오(가상) 데이터**로, 실측 결과가 아니며 앱 내
> `시나리오 데이터` 태그로 명시된다. 2018/2022 결승은 실측 이벤트 기반(`실측 데이터`).
> 대회에서 실제 2026 데이터셋을 제공하면 StatsBomb 스키마로 그대로 교체 가능.

## Stack
**Next.js 14 (App Router) · TypeScript · TailwindCSS · Framer Motion · Zustand**

## Run
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## What's implemented (vertical slice, AAA feel)
- **Home** — dark stadium hero, canvas crowd + camera flashes + light sweep, coach name,
  country / opponent / year pickers, animated "Start My World Cup".
- **Match engine** — real minute-by-minute timeline (2022 & 2018 finals), play/pause/scrub,
  1–12× speed, live score, xG, possession, shots, corners, momentum, **live win-probability graph**,
  goal celebration overlay.
- **Tactical board** — interactive pitch, **drag-and-drop players**, 5 formations
  (433 / 4231 / 352 / 343 / 541) with players springing into position.
- **Tactical controls** — Attack / Line / Press / Tempo / Width sliders + Counter / High Press /
  Offside Trap toggles that feed the engine live.
- **AI Coach** — deterministic tactical assistant with **confidence scores** and per-tip explanations,
  now including **fatigue-based substitution advice**.
- **Substitutions & stamina** — live stamina model (role × Press/Tempo/High-Press intensity), 5-sub limit,
  bench with OVR, one-tap swaps; incoming players start fresh and slot into the replaced role.
- **Post-Match Report** — full-time modal with **player ratings + Man of the Match**, AI verdict & grade,
  generated **back-page headlines** (press conference), substitution log, and a **shareable PNG card**
  (native canvas, no deps) plus copy-to-clipboard summary.
- **Crowd audio** — dependency-free Web Audio ambience that swells with momentum + a **goal roar** (toggle).
- **Alternate History** — Poisson re-simulation from real xG adjusted by your tactics → REAL vs YOUR scoreline.

## Data
`data/matches.ts` holds real final timelines (goals, shots, cards, subs, xG). The schema mirrors
**StatsBomb Open Data** (events / xG / lineups) so it can be swapped for the full StatsBomb feed
(2018/2022 men's + Women's World Cup) without touching the UI.

## Architecture
```
app/            page.tsx (Home), match/page.tsx (experience), layout, globals.css
components/      CrowdCanvas, Scoreboard, StatBars, MomentumBar, WinProbChart,
                 EventFeed, TacticalPitch, TacticalControls, AICoachPanel
lib/            types, formations, matchEngine (snapshot + Poisson sim), aiCoach (rules), store (zustand)
data/           matches.ts (real final data)
```

## Demo flow (end-to-end)
Home → pick coach/country/opponent/year → **Start** → Play (▶, up to 12×) → drag players & tune tactics
→ AI Coach flags a gassed player → **substitute** from the bench → match reaches full time
→ **Post-Match Report auto-opens** (ratings, MOTM, grade, headlines) → **Download share card** / copy summary.
Toggle **🔊 Sound** any time for crowd ambience + goal roars.

## Roadmap (next tickets)
- ✅ ~~Substitution system with stamina + tactical-impact prediction~~
- ✅ ~~Post-match report (ratings, MOTM, grade) with shareable image export~~
- ✅ ~~AI press conference → generated headlines~~
- ✅ ~~Procedural Web Audio crowd ambience + goal roar~~
- ✅ ~~한국 대표팀 + 2026 시나리오(한국 vs 남아공) & 대체역사 훅~~
- ✅ ~~한국어/영어 전체 현지화 (UI·AI 코치·헤드라인·중계, 기본 한국어)~~
- Heatmaps & pass-network visualisations in the post-match report
- Full StatsBomb loader + more matches/eras (Women's World Cup, older finals)
- Fan reactions / social-post generation from the match narrative
