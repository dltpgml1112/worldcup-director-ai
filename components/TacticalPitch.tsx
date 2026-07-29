"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { t } from "@/lib/i18n";
import { clamp, pitchFrame } from "@/lib/pitchPositions";

/**
 * 2D 전술 보드.
 * 배치 계산은 lib/pitchPositions의 pitchFrame()을 3D 뷰와 공유한다 —
 * 뷰를 전환해도 선수/공 위치가 정확히 일치한다.
 * 절대 피치 좌표(y: 우리 골문 0 → 상대 골문 100)를 화면 좌표(top = 100 - y)로만 뒤집는다.
 */
export default function TacticalPitch() {
  const players = useGame((s) => s.players);
  const setPlayerPos = useGame((s) => s.setPlayerPos);
  const matchId = useGame((s) => s.matchId);
  const tactics = useGame((s) => s.tactics);
  const minute = useGame((s) => s.minute);
  const playing = useGame((s) => s.playing);
  const lang = useGame((s) => s.lang);
  const benchDrag = useGame((s) => s.benchDrag);
  const subTarget = useGame((s) => s.subTarget);
  const setSubTarget = useGame((s) => s.setSubTarget);
  const manualPositions = useGame((s) => s.manualPositions);
  const match = getMatch(matchId);
  const home = match?.home;
  const away = match?.away;
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const manualIds = useMemo(() => new Set(manualPositions), [manualPositions]);
  const frame = useMemo(
    () => pitchFrame({ match, players, tactics, minute, playing, dragId: drag, manualIds }),
    [match, players, tactics, minute, playing, drag, manualIds]
  );
  const live = frame.live;

  const toPct = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    // 범위를 넓게 — 감독이 원하는 곳에 놓을 수 있어야 한다
    const px = clamp(((clientX - r.left) / r.width) * 100, 2, 98);
    const py = clamp(((clientY - r.top) / r.height) * 100, 2, 98);
    return { x: px, y: 100 - py };
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full select-none overflow-hidden rounded-lg border border-surface-line"
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
      {frame.away.map(({ player: p, pos }) => (
        <motion.div
          key={`away-${p.id}`}
          className="pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          animate={{ left: `${pos.x}%`, top: `${100 - pos.y}%` }}
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
      ))}

      {/* 공 — 재생 전 정중앙, 재생 중 실제 상황 위치로 이동 */}
      <motion.div
        className="pointer-events-none absolute z-[8] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)]"
        animate={{ left: `${frame.ball.x}%`, top: `${100 - frame.ball.y}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
        style={{ backgroundImage: "radial-gradient(circle at 35% 30%, #fff 40%, #cbd5e1 100%)" }}
      />

      {/* 홈(우리) 선수 토큰 — 드래그 가능 + 벤치 드래그의 교체 드롭 타깃 */}
      {frame.home.map(({ player: p, pos }) => {
        const aimed = subTarget === p.id;
        return (
        <motion.button
          key={p.id}
          type="button"
          onPointerDown={(e) => {
            if (benchDrag) return; // 벤치 드래그 중엔 선수 이동을 시작하지 않는다
            e.preventDefault();
            setDrag(p.id);
          }}
          onPointerEnter={() => benchDrag && setSubTarget(p.id)}
          onPointerLeave={() => benchDrag && aimed && setSubTarget(null)}
          animate={{ left: `${pos.x}%`, top: `${100 - pos.y}%` }}
          transition={drag === p.id ? { duration: 0 } : live ? { duration: 0.5, ease: "linear" } : { type: "spring", stiffness: 260, damping: 26 }}
          className="absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center active:cursor-grabbing"
          whileTap={{ scale: 1.18 }}
        >
          <span
            className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold text-white shadow-lg ${
              aimed ? "ring-4 ring-status-critical" : ""
            }`}
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
