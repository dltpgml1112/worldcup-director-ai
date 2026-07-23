"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { snapshotAt } from "@/lib/matchEngine";
import { t } from "@/lib/i18n";
import type { Player } from "@/lib/types";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 매 프레임 부드럽게 흐르는 공 — 기세로 상하 바이어스, 여러 사인파로 자연스러운 유동 */
function Ball({ momentum, playing }: { momentum: number; playing: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const mRef = useRef(momentum);
  const playRef = useRef(playing);
  mRef.current = momentum;
  playRef.current = playing;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const p = { x: 50, y: 50 };
    const loop = (now: number) => {
      const tt = (now - start) / 1000;
      const play = playRef.current;
      const m = mRef.current;
      // 자연스러운 유동: 서로 다른 주기의 사인파 합성
      const tx = 50 + Math.sin(tt * 0.45) * 20 + Math.sin(tt * 0.19 + 1.3) * 9;
      const ty =
        50 +
        (play ? -m * 0.26 : 0) +
        Math.sin(tt * 0.37 + 2.1) * 15 +
        Math.cos(tt * 0.61) * 7;
      const target = { x: clamp(tx, 12, 88), y: clamp(ty, 10, 90) };
      const sp = play ? 0.05 : 0.022; // 느린 러프 → 급가속 없음
      p.x += (target.x - p.x) * sp;
      p.y += (target.y - p.y) * sp;
      if (el.current) {
        el.current.style.left = `${p.x}%`;
        el.current.style.top = `${p.y}%`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={el}
      className="pointer-events-none absolute z-[8] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)]"
      style={{ left: "50%", top: "50%", backgroundImage: "radial-gradient(circle at 35% 30%, #fff 40%, #cbd5e1 100%)" }}
    />
  );
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
      className="relative aspect-[3/4] w-full select-none overflow-hidden rounded-2xl border border-white/10"
      style={{
        touchAction: "none",
        background:
          "repeating-linear-gradient(0deg,#0e7a3d,#0e7a3d 7.14%,#0c6f38 7.14%,#0c6f38 14.28%)",
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

      {/* 공 */}
      <Ball momentum={momentum} playing={playing} />

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
