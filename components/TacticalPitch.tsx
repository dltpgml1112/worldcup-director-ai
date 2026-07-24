"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt } from "@/lib/matchEngine";
import { t } from "@/lib/i18n";
import type { MatchData, Player } from "@/lib/types";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 공 목표 위치 — 재생 전/정지 시 정중앙, 재생 중엔 실제 경기 상황(최근 이벤트) 위치 */
function ballTarget(match: MatchData | undefined, minute: number, momentum: number, playing: boolean) {
  if (!match || !playing || minute <= 0) return { x: 50, y: 50 };
  let top = 50 - momentum * 0.28; // 기세: 홈 우위 → 상단(상대 골문)
  let left = 50 + Math.sin(minute * 0.9) * 7;
  const last = [...match.timeline].reverse().find((e) => e.minute <= minute);
  if (last) {
    const home = last.side === "home";
    switch (last.type) {
      case "goal":
        top = home ? 7 : 93;
        left = 50;
        break;
      case "shot":
        top = home ? 20 : 80;
        break;
      case "chance":
        top = home ? 30 : 70;
        break;
      case "corner":
        top = home ? 12 : 88;
        left = 86;
        break;
      case "whistle":
        top = 50;
        left = 50;
        break;
    }
  }
  return { x: clamp(left, 8, 92), y: clamp(top, 5, 95) };
}

/** 재생 중 선수 드리프트(살아있는 움직임) — 결정론적, 분+인덱스 기반 */
function drift(seed: number, minute: number, roleGk: boolean): { dx: number; dy: number } {
  const amp = roleGk ? 0.6 : 3.6;
  const dx = Math.sin(minute * 0.4 + seed * 1.7) * amp;
  const dy = Math.cos(minute * 0.33 + seed * 2.3) * (roleGk ? 0.5 : 3.1);
  return { dx, dy };
}

export default function TacticalPitch() {
  const players = useGame((s) => s.players);
  const setPlayerPos = useGame((s) => s.setPlayerPos);
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const lang = useGame((s) => s.lang);
  const match = getMatch(matchId);
  const home = match?.home;
  const away = match?.away;
  const awayXI = match?.awayXI ?? [];
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<string | null>(null);

  // 기세 기반 팀 전체 상하 이동 (홈: + = 전진/위로)
  const momentum = match ? snapshotAt(match, minute, tactics).momentum : 0;
  const homeShift = clamp(momentum * 0.06, -7, 7);
  const awayShift = clamp(-momentum * 0.06, -7, 7);
  const live = playing && minute > 0;
  const ball = ballTarget(match, minute, momentum, playing);

  const toPct = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const px = clamp(((clientX - r.left) / r.width) * 100, 4, 96);
    const py = clamp(((clientY - r.top) / r.height) * 100, 4, 96);
    return { x: px, y: 100 - py };
  };

  // 홈 선수 화면 좌표
  const homePos = (p: Player, i: number) => {
    const gk = p.role.toUpperCase() === "GK";
    const baseLeft = p.x;
    const baseTop = 100 - p.y;
    if (!live || drag === p.id) return { left: baseLeft, top: baseTop };
    const { dx, dy } = drift(i, minute, gk);
    return { left: clamp(baseLeft + dx, 3, 97), top: clamp(baseTop - homeShift + dy, 4, 97) };
  };

  // 상대 선수 화면 좌표 (상단, 좌우 반전 — 자기 골문이 위)
  const awayPos = (p: Player, i: number) => {
    const gk = p.role.toUpperCase() === "GK";
    const baseLeft = 100 - p.x;
    const baseTop = p.y;
    if (!live) return { left: baseLeft, top: baseTop };
    const { dx, dy } = drift(i + 20, minute, gk);
    return { left: clamp(baseLeft + dx, 3, 97), top: clamp(baseTop + awayShift + dy, 3, 96) };
  };

  return (
    <div
      ref={ref}
      className="relative aspect-[3/4] w-full select-none overflow-hidden rounded-lg border border-surface-line"
      style={{
        touchAction: "none",
        background:
          "repeating-linear-gradient(0deg,#15241c,#15241c 7.14%,#122019 7.14%,#122019 14.28%)",
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const { x, y } = toPct(e.clientX, e.clientY);
        setPlayerPos(drag, x, y);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      {/* 라인 */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <g fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4">
          <rect x="2" y="2" width="96" height="96" rx="1" />
          <line x1="2" y1="50" x2="98" y2="50" />
          <circle cx="50" cy="50" r="9" />
          <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.6)" />
          <rect x="30" y="2" width="40" height="14" />
          <rect x="40" y="2" width="20" height="6" />
          <rect x="30" y="84" width="40" height="14" />
          <rect x="40" y="92" width="20" height="6" />
        </g>
      </svg>

      {/* 상대 배치 라벨 (상단) */}
      <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-widest text-white/55">
        {away?.flag} {t(lang, "board.opponent")}
      </div>
      {/* 공격 방향 (하단→상단) */}
      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-widest text-neon-grass/70">
        {t(lang, "board.attacking")}
      </div>

      {/* 상대 선수 (고스트 토큰, 이동만·드래그 불가) */}
      {awayXI.map((p, i) => {
        const pos = awayPos(p, i);
        return (
          <motion.div
            key={`away-${p.id}`}
            className="pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            animate={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            transition={live ? { duration: 0.5, ease: "linear" } : { type: "spring", stiffness: 200, damping: 24 }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(232,238,247,0.9)",
                color: "#05070d",
                border: `2px solid ${away?.primary ?? "#888"}`,
              }}
            >
              {p.num}
            </span>
            <span className="mt-0.5 max-w-[60px] truncate rounded bg-black/50 px-1 text-[8px] font-semibold leading-tight text-white/85">
              {lang === "ko" && p.nameKo ? p.nameKo : p.name.split(" ").pop()}
            </span>
          </motion.div>
        );
      })}

      {/* 공 — 재생 전 정중앙, 재생 중 실제 상황 위치로 이동 */}
      <motion.div
        className="pointer-events-none absolute z-[8] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)]"
        animate={{ left: `${ball.x}%`, top: `${ball.y}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
        style={{ backgroundImage: "radial-gradient(circle at 35% 30%, #fff 40%, #cbd5e1 100%)" }}
      />

      {/* 홈(우리) 선수 토큰 — 드래그 가능 */}
      {players.map((p, i) => {
        const pos = homePos(p, i);
        return (
          <motion.button
            key={p.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setDrag(p.id);
            }}
            animate={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            transition={drag === p.id ? { duration: 0 } : live ? { duration: 0.5, ease: "linear" } : { type: "spring", stiffness: 260, damping: 26 }}
            className="absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center active:cursor-grabbing"
            whileTap={{ scale: 1.18 }}
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold text-white shadow-lg"
              style={{ background: home?.primary ?? "#42f59b", borderColor: p.legend ? "#ffd54a" : "#fff" }}
            >
              {p.num}
              {p.legend && (
                <span className="absolute -right-1.5 -top-1.5 text-[10px] leading-none drop-shadow">⭐</span>
              )}
            </span>
            <span className="mt-0.5 max-w-[64px] truncate rounded bg-black/60 px-1 text-[9px] font-semibold leading-tight text-white">
              {lang === "ko" && p.nameKo ? p.nameKo : p.name.split(" ").pop()}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
