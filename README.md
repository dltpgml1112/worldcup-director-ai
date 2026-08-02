# ⚽ World Cup Director AI · 월드컵 디렉터 AI

### ▶ **[지금 바로 실행 — worldcup-director-ai.vercel.app](https://worldcup-director-ai.vercel.app)**
> 설치·회원가입·API 키 없이 브라우저에서 바로 동작합니다. 아래 [심사자용 30초 체험 경로](#-심사자용-30초-체험-경로) 참고.

> *당신이 감독이라면?* — **2026 월드컵**을 다시 쓰는 몰입형 전술 시뮬레이터.
> *What if YOU were the coach?* — an immersive World Cup tactical simulator.

2026 월드컵 데이터 기반 해커톤 출품작. 경기를 분 단위로 리플레이하고, 인터랙티브 전술 보드를
지휘하고, 실시간 AI 코칭을 받아 **역사를 다시 쓴다.** UI 전체가 **한국어/영어** (기본 한국어).

### 🇰🇷 다시 쓰는 2026 — 한국이 결승까지 가는 길

**출발점은 실제로 일어난 일이다.** 2026년 6월 24일, A조 3차전. 한국은 승점 3, 남아공은 1이었다.
**비기기만 해도 16강**이었다. 한국은 점유율 68%에 슈팅 18개를 퍼부었지만 유효슈팅은 3개뿐,
63분 타펠로 마세코의 한 방에 0–1로 무너져 조 3위로 탈락했다.

이제 당신이 감독이다. 그 경기를 통과하면 한국은 **승점 6으로 A조 2위**가 되어
**남아공이 차지했던 브래킷 자리를 그대로 승계한다.** 그 다음부터 만나는 상대는 전부
실제 2026 대진표에서 그 자리에 있던 팀이고, **선발 11명도 그 팀이 그 라운드에서 실제로 낸 명단**이다.

| 라운드 | 상대 | 실제로 그 자리에서 벌어진 일 |
|---|---|---|
| A조 3차전 | 🇿🇦 남아공 | 남아공 1–0 한국 — 한국 탈락 |
| 32강 | 🇨🇦 캐나다 | 캐나다 1–0 남아공 (에우스타키오 후반 추가시간) |
| 16강 | 🇲🇦 모로코 | 모로코 3–0 캐나다 (오나히 2골) |
| 8강 | 🇫🇷 프랑스 | 프랑스 3–1 모로코 |
| 4강 | 🇪🇸 스페인 | 스페인 2–0 프랑스 — **이 대회 우승팀** |
| 결승 | 🇦🇷 아르헨티나 | 스페인 1–0 아르헨티나 (연장, 페란 토레스) |

지면 캠페인은 거기서 끝난다 — 실제 역사대로. 대신 전술을 바꿔 같은 경기를 다시 치를 수 있다.

### ⚠️ 어디까지가 실측인가

이 프로젝트는 **실측과 시뮬레이션의 경계를 화면에 상시 표기한다** (`데이터 출처` 패널).

| 구분 | 내용 |
|---|---|
| **실측** (`실측 데이터`) | 2026 A조 3차전 원본, 2022·2018 결승. 스코어·득점자·시각·경고·점유율·슈팅 총계가 실제 기록 |
| **시뮬레이션** (`시뮬레이션`) | 캠페인의 각 라운드. **상대·라운드·상대 선발 11명은 실측**이지만, 그 경기 자체는 열린 적이 없으므로 내용(골·슛·경고)은 전술과 라인업에서 생성된다 |

세부 한계도 숨기지 않는다. 예를 들어 A조 3차전은 스코어·득점자·슈팅 총계(18–4)가 실측이지만,
**개별 슛의 시각과 슈터는 공개 자료에 없어** 실제 총계에 맞춰 재구성했고 확인되지 않은 슈터는
이름을 붙이지 않았다 — 이 문장이 앱 안에도 그대로 뜬다.

상대팀 등번호는 확인된 것만 실측이고, `rating`(기량 수치)은 게임 내 값으로 실측 데이터가 아니다.

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

1. 첫 화면에서 **[내 월드컵을 시작한다]** 바로 클릭 — 이름 입력은 선택 사항입니다.
   A조 3차전 브리핑("실제로는 이랬다")을 읽고 **[전술을 짠다]**를 누르세요.
2. 전술 보드가 **3D 경기장**으로 열립니다. 마우스로 끌어 **시점 회전**, 상단 버튼으로
   **골문 뒤 / 중계 캠 / 탑다운 / 터치라인** 카메라 전환.
3. **선수를 직접 끌어 재배치** → 아래 `컴팩트니스 / 라인 높이 / 라인 간격` 수치가 즉시 반응합니다.
4. 보드 아래 **벤치 카드를 필드 선수 위로 드래그** → 대상 선수에 적색 링이 뜨고, 놓으면 **교체 완료**.
5. 오버레이에서 **[점유 히트맵]** · **[패스 네트워크]** 를 켜보세요. 히트맵은 등번호를 누르면
   선수 개인 열지도로 바뀝니다. 슬라이더(공격 성향·수비 라인·압박)를 움직이면
   **팀 블록·압박 존·패스 연결**이 실시간으로 변형됩니다.
6. **[▶ 재생]** (최대 12배속) → 풀타임 도달 시 **경기 후 리포트**가 자동으로 열립니다.
7. 좌측 **대체 역사** 패널에서 실제 결과 vs 내 전술의 최빈 스코어·승/무/패 확률을 비교합니다.
8. 리포트를 닫으면 하단에 **[다음 라운드]** / **[전술 바꿔 다시]** 가 뜹니다.
   통과하면 32강 캐나다전으로 넘어갑니다 — 좌측 **다시 쓰는 2026** 브래킷에서 진행이 보입니다.

> 2D 보드만 보고 싶다면 상단 **[2D]** 토글로 즉시 전환됩니다 (배치·수치 완전 동일).

## What's implemented (vertical slice, AAA feel)
- **Home** — dark stadium hero, canvas crowd + camera flashes + light sweep, coach name,
  campaign briefing, and a replay list of the real matches.
- **Campaign ("Rewriting 2026")** — six rounds from the group decider to the final, every opponent
  taken from the real 2026 bracket. Win to advance, lose and it ends exactly as history did.
  Knockout draws go to extra time and penalties. Progress is saved locally, so a refresh in the
  semi-final doesn't cost you the run.
- **In-match tactical changes** — change your setup mid-game and re-run from that minute: everything
  already played stays fixed, only what's left is regenerated. Switching to all-out attack at 60'
  raises expected goals for the remaining half-hour from 0.51 to 0.76.
- **Match engine** — minute-by-minute timeline, play/pause/scrub, 1–12× speed, live score, xG,
  possession, shots, corners, momentum, **live win-probability graph**, goal celebration overlay.
- **Scoreline model** — expected goals are turned into a **full Poisson joint distribution**; the app
  shows the *most likely* scoreline plus win/draw/loss probabilities summed from that matrix, not a
  single random draw. Tactical coefficients are normalised so the default setup is exactly neutral.
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
- **점유 히트맵** — 0분부터 현재까지 매 분 배치를 재계산해 누적한 열지도를 잔디 위에 렌더링.
  **팀 전체 / 선수 개인** 전환 가능.
  색은 **파랑 단일 계조(sequential)** 를 쓴다 — 중계 방송식 무지개(파랑→초록→노랑→빨강) 램프는
  ⑴ 색만 보고 값의 크기 순서를 복원할 수 없고 ⑵ 녹색 잔디 위의 적·녹 구간이 적록색약에서
  잔디와 구분되지 않는다. 파랑 단일 계조는 녹색 표면 위에서 모든 색각 유형에 분리된다.
- **패스 네트워크** — 평균 위치를 노드로, 연결 강도를 선 굵기로 표현.
  ⚠️ 실측 패스 이벤트가 없으므로 배치·거리 감쇠·템포·공격 성향에서 유도한 **추정 모델**이며,
  오버레이가 켜져 있는 동안 화면에 항상 '추정'으로 명시된다. StatsBomb 패스 이벤트가 들어오면
  `passNetwork()` 함수 하나만 교체하면 실측으로 전환된다.
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
- **Alternate History** — expected goals adjusted by your tactics → full Poisson joint matrix →
  most likely scoreline + win/draw/loss probabilities, next to the REAL result.

## Data
`data/matches.ts` holds the **real** match timelines (goals, shots, cards, xG) — the 2026 Group A
decider plus the 2022 and 2018 finals. `data/wc2026.ts` holds the **campaign bracket**: the five real
knockout opponents Korea would have faced, with the starting XI each of them actually fielded in that
round. The schema mirrors **StatsBomb Open Data** (events / xG / lineups) so it can be swapped for a
full StatsBomb feed without touching the UI.

Matches that never took place are generated at runtime by `lib/simulateMatch.ts` and tagged
`simulated` — see [어디까지가 실측인가](#️-어디까지가-실측인가).

### 검증 스크립트
데이터·엔진이 주장한 대로 동작하는지 직접 돌려볼 수 있습니다.
```bash
npx tsx scripts/check-scoreline.mts   # 전술별 최빈 스코어·승무패 확률
npx tsx scripts/check-sim.mts         # 스코어 분포 200경기 · 결정론 검사
npx tsx scripts/check-campaign.mts    # 캠페인 완주 · 탈락 경로 · 대진 · 등번호 검증
npx tsx scripts/check-midmatch.mts    # 경기 중 전술 변경 — 과거 보존 · 이후 변화
```

## Architecture
```
app/            page.tsx (Home), match/page.tsx (experience), layout, globals.css
components/      CrowdCanvas, Scoreboard, StatBars, MomentumBar, WinProbChart, EventFeed,
                 TacticalBoard (2D/3D 전환 셸), TacticalPitch (2D), Pitch3D (three.js 씬),
                 TacticalControls, AICoachPanel
lib/            types, formations, matchEngine (snapshot + 포아송 스코어라인), simulateMatch (타임라인 생성),
                campaign (라운드 진행·진출 판정), aiCoach (rules), store (zustand),
                pitchPositions (2D·3D 공유 배치 계산), pitchAnalytics (히트맵·패스네트워크),
                pitchTextures (캔버스 텍스처), pitchView (뷰 설정), provenance (데이터 출처)
data/           matches.ts (실측 경기), wc2026.ts (캠페인 대진 + 상대 실제 선발)
scripts/        check-scoreline / check-sim / check-campaign (검증 스크립트)
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
- ✅ ~~한국 대표팀 + 2026 A조 3차전 실측 데이터 & 대체역사 훅~~
- ✅ ~~"다시 쓰는 2026" 캠페인 — 실제 대진표를 따라 조별리그부터 결승까지 6라운드~~
- ✅ ~~한국어/영어 전체 현지화 (UI·AI 코치·헤드라인·중계, 기본 한국어)~~
- ✅ ~~three.js 3D 경기장 뷰 (카메라 프리셋·전술 오버레이·3D 드래그·전체화면)~~
- ✅ ~~점유 히트맵 + 패스 네트워크 3D 시각화~~
- ✅ ~~벤치 드래그 교체 (2D/3D 공통 드롭 타깃)~~
- 히트맵/패스 네트워크를 경기 후 리포트에도 스냅샷으로 첨부
- Full StatsBomb loader + more matches/eras (Women's World Cup, older finals)
- Fan reactions / social-post generation from the match narrative
