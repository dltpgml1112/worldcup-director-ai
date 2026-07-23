# ⚽ World Cup Director AI

> *What if YOU were the coach?* — an immersive World Cup tactical simulator built on **real final data**.

Hackathon entry for the *World Cup Manager / Tactics Web Challenge*. Replay real World Cup
finals minute-by-minute, command an interactive tactical board, get live AI coaching, and
rewrite history.

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
- **AI Coach** — deterministic tactical assistant with **confidence scores** and per-tip explanations.
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

## Roadmap (next tickets)
- Substitution system with stamina + tactical-impact prediction
- Post-match report (formation timeline, heatmaps, pass network, ratings) with shareable image export
- AI press conference → generated headlines / fan reactions / social posts
- Procedural Web Audio crowd ambience + goal roar
- Full StatsBomb loader + more matches/eras
