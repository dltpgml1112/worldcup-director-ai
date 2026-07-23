"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/store";
import { getMatch } from "@/data/matches";
import { t } from "@/lib/i18n";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function TacticalPitch() {
  const players = useGame((s) => s.players);
  const setPlayerPos = useGame((s) => s.setPlayerPos);
  const matchId = useGame((s) => s.matchId);
  const lang = useGame((s) => s.lang);
  const home = getMatch(matchId)?.home;
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const toPct = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const px = clamp(((clientX - r.left) / r.width) * 100, 4, 96);
    const py = clamp(((clientY - r.top) / r.height) * 100, 4, 96);
    return { x: px, y: 100 - py };
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

      {/* 공격 방향 */}
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-widest text-white/60">
        {t(lang, "board.attacking")}
      </div>

      {/* 선수 토큰 */}
      {players.map((p) => (
        <motion.button
          key={p.id}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setDrag(p.id);
          }}
          animate={{ left: `${p.x}%`, top: `${100 - p.y}%` }}
          transition={drag === p.id ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
          className="absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center active:cursor-grabbing"
          whileTap={{ scale: 1.18 }}
          style={{ left: `${p.x}%`, top: `${100 - p.y}%` }}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold text-night-900 shadow-lg"
            style={{ background: home?.primary ?? "#42f59b", borderColor: "#fff" }}
          >
            {p.num}
          </span>
          <span className="mt-0.5 max-w-[64px] truncate rounded bg-black/60 px-1 text-[9px] font-semibold leading-tight text-white">
            {lang === "ko" && p.nameKo ? p.nameKo : p.name.split(" ").pop()}
          </span>
        </motion.button>
      ))}

      {/* 상대 실루엣 (상단) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-25">
        {[20, 40, 60, 80].map((x) => (
          <span key={x} className="absolute h-3 w-3 rounded-full bg-neon-red" style={{ left: `${x}%`, top: "22%" }} />
        ))}
      </div>
    </div>
  );
}
