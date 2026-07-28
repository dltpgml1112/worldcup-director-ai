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
**Next.js 14 (App Router) · TypeScript · TailwindCSS · Framer Motion · Zustand · three.js (react-three-fiber)**

## Run
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## 🔎 심사자용 30초 체험 경로
설치·회원가입·API 키 없이 아래 순서만 따라가면 핵심 기능을 모두 확인할 수 있습니다.

1. 첫 화면에서 **[⚽ 내 월드컵 시작하기]** 바로 클릭 — 이름 입력은 선택 사항입니다.
2. 전술 보드가 **3D 경기장**으로 열립니다. 마우스로 끌어 **시점 회전**, 상단 버튼으로
   **골문 뒤 / 중계 캠 / 탑다운 / 터치라인** 카메라 전환.
3. **선수를 직접 끌어 재배치** → 아래 `컴팩트니스 / 라인 높이 / 라인 간격` 수치가 즉시 반응합니다.
4. 보드 아래 **벤치 카드를 필드 선수 위로 드래그** → 대상 선수에 적색 링이 뜨고, 놓으면 **교체 완료**.
5. 우측 슬라이더(공격 성향·수비 라인·압박)를 움직이면 **팀 블록·압박 존 오버레이**가 실시간 변형됩니다.
6. **[▶ 재생]** (최대 12배속) → 풀타임 도달 시 **경기 후 리포트**가 자동으로 열립니다.
7. 좌측 하단 **대체 역사** 패널에서 실제 결과 vs 내 전술 결과를 비교합니다.

> 2D 보드만 보고 싶다면 상단 **[2D]** 토글로 즉시 전환됩니다 (배치·수치 완전 동일).

## What's implemented (vertical slice, AAA feel)
- **Home** — dark stadium hero, canvas crowd + camera flashes + light sweep, coach name,
  country / opponent / year pickers, animated "Start My World Cup".
- **Match engine** — real minute-by-minute timeline (2022 & 2018 finals), play/pause/scrub,
  1–12× speed, live score, xG, possession, shots, corners, momentum, **live win-probability graph**,
  goal celebration overlay.
- **Tactical board (2D ⇄ 3D)** — interactive pitch, **drag-and-drop players**, 5 formations
  (433 / 4231 / 352 / 343 / 541) with players springing into position.
- **3D stadium view (three.js)** — full WebGL pitch rendered from the *same* placement math as the
  2D board, so switching views never desyncs a single player:
  - procedurally generated turf (mow stripes + FIFA-spec markings), goals with nets, corner flags,
    tiered stands with a 3 600-point crowd, floodlights — **zero external assets**, all canvas-drawn
  - 4 camera presets (**골문 뒤 / 중계 캠 / 탑다운 / 터치라인**) with smooth tweening, free orbit,
    and a **cinematic** slow-orbit mode
  - **drag players in 3D** — raycast onto the pitch plane writes straight back into the same store
  - **tactical overlays**: team block (convex hull), both defensive lines, ball-centred press zone
    (radius scales with the Press slider), per-player influence radii
  - live shape metrics: **compactness / line height / line gap**
  - fullscreen mode; graceful **fallback to the 2D board** if WebGL is unavailable
  - lazy-loaded via `next/dynamic` — three.js stays out of the main bundle
- **Tactical controls** — Attack / Line / Press / Tempo / Width sliders + Counter / High Press /
  Offside Trap toggles that feed the engine live.
- **AI Coach** — deterministic tactical assistant with **confidence scores** and per-tip explanations,
  now including **fatigue-based substitution advice**.
- **Substitutions & stamina** — live stamina model (role × Press/Tempo/High-Press intensity), 5-sub limit,
  bench with OVR, one-tap swaps; incoming players start fresh and slot into the replaced role.
- **벤치 드래그 교체** — 벤치 카드를 집어 **2D 보드든 3D 경기장이든** 필드 선수 위로 끌어다 놓으면 교체.
  드래그 상태가 스토어에 있어 두 뷰가 같은 드롭 타깃으로 동작하고, 조준 대상에는 적색 링 + 수직 기둥이
  떠서 어느 카메라 각도에서도 식별된다. (터치 환경에서는 기존 교체 패널의 탭 선택 방식이 그대로 동작)
- **레전드 모드 (기본 OFF)** — 기본값은 **실제 선출 가능한 현역 스쿼드만** 사용한다.
  역대 대표팀 스타(차범근·박지성 등)는 *가상 편성*으로 분리해 명시적으로 켤 때만 벤치에 등장하며,
  켜는 순간 "실제 2026 스쿼드가 아님"을 화면에 고지한다. 실측과 가상을 **구조적으로** 나누는
  이 앱의 데이터 원칙(`DataProvenance`)을 스쿼드 구성에도 동일하게 적용한 것.
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
components/      CrowdCanvas, Scoreboard, StatBars, MomentumBar, WinProbChart, EventFeed,
                 TacticalBoard (2D/3D 전환 셸), TacticalPitch (2D), Pitch3D (three.js 씬),
                 TacticalControls, AICoachPanel
lib/            types, formations, matchEngine (snapshot + Poisson sim), aiCoach (rules), store (zustand),
                pitchPositions (2D·3D 공유 배치 계산), pitchTextures (캔버스 텍스처), pitchView (뷰 설정)
data/           matches.ts (real final data)
```

### 2D/3D 단일 소스 원칙
선수·공 위치는 `lib/pitchPositions.ts`의 `pitchFrame()` **한 곳**에서만 계산한다.
절대 피치 좌표(`x` 0–100 폭, `y` 0=우리 골문 → 100=상대 골문)를 2D는 `top = 100 - y`로,
3D는 `toWorld()`로 미터 단위 월드 좌표로 투영할 뿐이다. 전술 슬라이더·기세 이동·드리프트가
두 뷰에 항상 동일하게 반영되고, 뷰를 바꿔도 배치가 어긋나지 않는다.

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
- ✅ ~~three.js 3D 경기장 뷰 (카메라 프리셋·전술 오버레이·3D 드래그·전체화면)~~
- Heatmaps & pass-network visualisations in the post-match report
- Full StatsBomb loader + more matches/eras (Women's World Cup, older finals)
- Fan reactions / social-post generation from the match narrative
